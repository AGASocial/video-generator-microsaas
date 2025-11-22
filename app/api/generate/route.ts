import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreditCost } from "@/lib/products";
import { downloadAndStoreVideoFromOpenAI } from "@/lib/video-storage";

// Background polling function for async video generation
async function pollVideoStatus(videoId: string, soraVideoId: string, maxAttempts = 60) {
  const supabase = await createClient();
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds between polls
    attempts++;

    try {
      // Use correct OpenAI API endpoint for status check
      const statusUrl = `https://api.openai.com/v1/videos/${soraVideoId}`;

      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        console.error(`[v0] Status check failed for video ${soraVideoId}`);
        continue;
      }

      const statusData = await statusResponse.json();

      // Check if video is ready
      if (statusData.status === "completed") {
        // Get user_id from video entry
        const { data: videoEntry } = await supabase
          .from("video_history")
          .select("user_id")
          .eq("id", videoId)
          .single();

        if (videoEntry?.user_id) {
          // Download video from OpenAI and store in Supabase Storage
          console.log(`[Polling] Downloading and storing video ${videoId} from OpenAI`);
          const storageResult = await downloadAndStoreVideoFromOpenAI(
            videoId,
            soraVideoId,
            videoEntry.user_id
          );

          if (storageResult.success) {
            console.log(`[Polling] Video ${videoId} stored successfully at: ${storageResult.supabaseUrl}`);
            // Status is already updated to "completed" by downloadAndStoreVideoFromOpenAI
          } else {
            console.error(`[Polling] Failed to store video ${videoId}:`, storageResult.error);
            // Fallback: use proxy URL if storage fails
            const proxyUrl = `/api/video/${videoId}/content`;
            await supabase
              .from("video_history")
              .update({
                video_url: proxyUrl,
                status: "completed",
              })
              .eq("id", videoId);
          }
        } else {
          // Fallback if user_id not found
          const proxyUrl = `/api/video/${videoId}/content`;
          await supabase
            .from("video_history")
            .update({
              video_url: proxyUrl,
              status: "completed",
            })
            .eq("id", videoId);
        }
        return;
      } else if (statusData.status === "failed") {
        // Update video entry with failed status
        await supabase
          .from("video_history")
          .update({
            status: "failed",
          })
          .eq("id", videoId);
        return;
      }
      // If still processing, continue polling
    } catch (error) {
      console.error(`[v0] Error polling video status:`, error);
    }
  }

  // Max attempts reached - mark as failed
  await supabase
    .from("video_history")
    .update({
      status: "failed",
    })
    .eq("id", videoId);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user data to check credits
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const duration = parseInt(formData.get("duration") as string);
    const model = formData.get("model") as string;
    const size = formData.get("size") as string;
    const imageFile = formData.get("image") as File | null;

    if (!prompt || !duration || !model) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get credit cost for this model
    const creditCost = getCreditCost(model);

    // Check if user has enough credits
    if (user.credits < creditCost) {
      return NextResponse.json(
        { 
          error: "Insufficient credits",
          required: creditCost,
          available: user.credits
        },
        { status: 402 }
      );
    }

    let imageBinary: Buffer | null = null;
    let imageMimeType: string | null = null;
    if (imageFile) {
      console.log("[API] Received image file:", {
        name: imageFile.name,
        type: imageFile.type,
        size: imageFile.size,
      });
      const arrayBuffer = await imageFile.arrayBuffer();
      imageBinary = Buffer.from(arrayBuffer);
      imageMimeType = imageFile.type || 'image/jpeg';
      console.log("[API] Image binary size:", imageBinary.length, "bytes");
    } else {
      console.log("[API] No image file received");
    }

    // Deduct credits based on model
    const { error: updateError } = await supabase
      .from("users")
      .update({ credits: user.credits - creditCost })
      .eq("id", authUser.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to deduct credits" },
        { status: 500 }
      );
    }

    // Create video history entry first (before API call)
    const { data: videoEntry, error: videoError } = await supabase
      .from("video_history")
      .insert({
        user_id: authUser.id,
        prompt,
        image_url: imageFile ? imageFile.name : null,
        duration,
        model,
        status: "processing",
      })
      .select()
      .single();

    if (videoError) {
      console.error("[v0] Video history error:", videoError);
      // Refund credit if we failed to create entry
      await supabase
        .from("users")
        .update({ credits: user.credits })
        .eq("id", authUser.id);
      return NextResponse.json(
        { error: "Failed to create video entry" },
        { status: 500 }
      );
    }

    // Use correct OpenAI API endpoint for video generation
    const openaiApiUrl = process.env.OPENAI_API_URL || "https://api.openai.com/v1/videos";
    
    // Check if API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("[v0] OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }
    
    try {
      console.log("[v0] Sending request to OpenAI:", {
        url: openaiApiUrl,
        model: model,
        size: size,
        duration: duration,
        hasImage: !!imageBinary,
      });

      let openaiResponse: Response;
      
      // OpenAI Sora API expects multipart/form-data when image is provided
      if (imageBinary && imageFile) {
        console.log("[API] Sending request with image reference");
        // Use FormData for requests with images
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("model", model);
        formData.append("size", size);
        formData.append("seconds", duration.toString());
        
        // Convert Buffer to Blob for FormData
        // Buffer needs to be converted to Uint8Array for Blob
        const imageUint8Array = new Uint8Array(imageBinary);
        const imageBlob = new Blob([imageUint8Array], { type: imageMimeType || 'image/jpeg' });
        const fileName = imageFile.name || "reference.jpg";
        console.log("[API] Appending image to OpenAI request:", {
          fileName,
          blobSize: imageBlob.size,
          mimeType: imageMimeType,
        });
        formData.append("input_reference", imageBlob, fileName);

        openaiResponse = await fetch(openaiApiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            // Don't set Content-Type header - browser will set it with boundary for FormData
          },
          body: formData,
        });
      } else {
        // Use JSON for requests without images
        const requestBody = {
          prompt: prompt,
          model: model,
          size: size,
          seconds: duration.toString(), // API expects string, not integer
        };

        openaiResponse = await fetch(openaiApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify(requestBody),
        });
      }

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error("[v0] OpenAI API failed:", errorText);
        let errorMessage = "OpenAI API request failed";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorText;
        } catch {
          errorMessage = errorText || "OpenAI API request failed";
        }
        throw new Error(errorMessage);
      }

      const openaiData = await openaiResponse.json();
      console.log("[v0] OpenAI response:", openaiData);

      // OpenAI returns a video object with id (sora_video_id) and status
      // Response format: { id: "sora_video_id", status: "processing" | "completed", ... }
      
      const soraVideoId = openaiData.id;
      
      if (!soraVideoId) {
        throw new Error("No video ID returned from OpenAI");
      }

      // Store sora_video_id in job_id column (reusing existing column)
      await supabase
        .from("video_history")
        .update({
          job_id: soraVideoId,
          status: openaiData.status || "processing",
        })
        .eq("id", videoEntry.id);

      if (openaiData.status === "completed") {
        // Video is already complete - download and store in Supabase
        console.log(`[Generate] Video ${videoEntry.id} is already complete, storing in Supabase`);
        const storageResult = await downloadAndStoreVideoFromOpenAI(
          videoEntry.id,
          soraVideoId,
          authUser.id
        );

        let finalVideoUrl: string;
        if (storageResult.success && storageResult.supabaseUrl) {
          finalVideoUrl = storageResult.supabaseUrl;
          console.log(`[Generate] Video stored successfully at: ${finalVideoUrl}`);
          // Status is already updated to "completed" by downloadAndStoreVideoFromOpenAI
        } else {
          // Fallback to proxy URL if storage fails
          console.warn(`[Generate] Storage failed, using proxy URL as fallback`);
          finalVideoUrl = `/api/video/${videoEntry.id}/content`;
          // Update status to completed even if storage failed
          await supabase
            .from("video_history")
            .update({
              video_url: finalVideoUrl,
              status: "completed",
            })
            .eq("id", videoEntry.id);
        }

        return NextResponse.json({
          success: true,
          videoId: videoEntry.id,
          message: "Video generated successfully",
          status: "completed",
          videoUrl: finalVideoUrl,
        });
      } else {
        // Video is processing - start background polling
        pollVideoStatus(videoEntry.id, soraVideoId).catch(console.error);

        return NextResponse.json({
          success: true,
          videoId: videoEntry.id,
          message: "Video generation started",
          status: "processing",
          videoUrl: null,
        });
      }
    } catch (openaiError) {
      console.error("[v0] OpenAI API error:", openaiError);
      
      const errorMessage = openaiError instanceof Error 
        ? openaiError.message 
        : "Failed to generate video";
      
      // Update status to failed and refund credit
      await supabase
        .from("video_history")
        .update({ status: "failed" })
        .eq("id", videoEntry.id);
      
      // Refund the credits
      await supabase
        .from("users")
        .update({ credits: user.credits })
        .eq("id", authUser.id);

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[v0] Generate API error:", error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
