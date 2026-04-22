import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreditCost } from "@/lib/products";
import { generateKlingToken } from "@/lib/kling-auth";

// Allowed model names for Kling AI (T-03-01: model validation)
const ALLOWED_MODELS = ["kling-v1", "kling-v1-5", "kling-v2"] as const;
type AllowedModel = typeof ALLOWED_MODELS[number];

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
    const userPrompt = formData.get("prompt") as string;
    const duration = parseInt(formData.get("duration") as string);
    const model = formData.get("model") as string;
    const size = formData.get("size") as string;
    const imageFile = formData.get("image") as File | null;

    if (!userPrompt || !duration || !model) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // T-03-01: Validate model is an allowed Kling model name
    if (!ALLOWED_MODELS.includes(model as AllowedModel)) {
      return NextResponse.json(
        { error: "Invalid model. Allowed models: kling-v1, kling-v1-5, kling-v2" },
        { status: 400 }
      );
    }

    // Fetch active prefix prompt from database
    let finalPrompt = userPrompt;
    try {
      const { data: promptSetting, error: promptError } = await supabase
        .from("prompt_settings")
        .select("prefix_prompt")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!promptError && promptSetting?.prefix_prompt) {
        // Prepend the prefix prompt to the user's prompt
        finalPrompt = `${promptSetting.prefix_prompt}. ${userPrompt}`;
        console.log("[Generate] Applied prefix prompt to user input");
      } else {
        console.log("[Generate] No active prefix prompt found, using user prompt as-is");
      }
    } catch (error) {
      console.error("[Generate] Error fetching prefix prompt:", error);
      // Continue with user prompt if prefix fetch fails
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
      console.log("[Kling] Received image file:", {
        name: imageFile.name,
        type: imageFile.type,
        size: imageFile.size,
      });
      const arrayBuffer = await imageFile.arrayBuffer();
      imageBinary = Buffer.from(arrayBuffer);
      imageMimeType = imageFile.type || 'image/jpeg';
      console.log("[Kling] Image binary size:", imageBinary.length, "bytes");
    } else {
      console.log("[Kling] No image file received");
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
    // Store the original user prompt (not the final prompt with prefix)
    const { data: videoEntry, error: videoError } = await supabase
      .from("video_history")
      .insert({
        user_id: authUser.id,
        prompt: userPrompt, // Store original user prompt, not the final one with prefix
        image_url: imageFile ? imageFile.name : null,
        duration,
        model,
        status: "processing",
      })
      .select()
      .single();

    if (videoError) {
      console.error("[Kling] Video history error:", videoError);
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

    // Kling API endpoint (per KLING-API-NOTES.md Q4 / RESEARCH.md Pattern 2)
    const klingApiUrl = process.env.KLING_API_URL || "https://api.klingai.com";

    try {
      let klingToken: string;
      try {
        klingToken = generateKlingToken();
      } catch (tokenError) {
        console.error("[Kling] Failed to generate auth token:", tokenError);
        // Refund credits
        await supabase
          .from("users")
          .update({ credits: user.credits })
          .eq("id", authUser.id);
        await supabase
          .from("video_history")
          .update({ status: "failed" })
          .eq("id", videoEntry.id);
        return NextResponse.json(
          { error: "errors.kling.unknownError" },
          { status: 500 }
        );
      }

      console.log("[Kling] Sending request to Kling API:", {
        url: klingApiUrl,
        model: model,
        duration: duration,
        hasImage: !!imageBinary,
      });

      // Map size param to Kling aspect_ratio (portrait → "9:16", landscape/default → "16:9")
      const aspectRatio = size === "portrait" ? "9:16" : "16:9";

      let klingResponse: Response;

      if (imageBinary && imageFile) {
        // Image-to-video: POST /v1/videos/image2video
        // Field name confirmed from KLING-API-NOTES.md Q4:
        // "image" for base64-encoded content (used here since we have binary in memory)
        // "image_url" for a publicly accessible URL (preferred when image is in Supabase Storage)
        // Using base64 here as the image has not yet been uploaded to Supabase Storage
        const imageBase64 = imageBinary.toString("base64");
        const imageDataUrl = `data:${imageMimeType || "image/jpeg"};base64,${imageBase64}`;

        klingResponse = await fetch(`${klingApiUrl}/v1/videos/image2video`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${klingToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model_name: model,
            prompt: finalPrompt,
            duration: duration,
            aspect_ratio: aspectRatio,
            image: imageDataUrl, // base64 data URL (KLING-API-NOTES.md Q4 confirmed field name)
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/video-complete`,
          }),
        });
      } else {
        // Text-to-video: POST /v1/videos/text2video
        klingResponse = await fetch(`${klingApiUrl}/v1/videos/text2video`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${klingToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model_name: model,
            prompt: finalPrompt,
            duration: duration,
            aspect_ratio: aspectRatio,
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/video-complete`,
          }),
        });
      }

      if (!klingResponse.ok) {
        const errorText = await klingResponse.text();
        console.error("[Kling] Kling API failed:", { status: klingResponse.status, body: errorText });

        // Map Kling error codes to i18n keys (per ERR-01, T-03-03)
        // T-03-03: Return i18n key only — never expose raw Kling error body to client
        let errorKey: string;
        if (klingResponse.status === 429) {
          errorKey = "errors.kling.rateLimit";
        } else if (klingResponse.status === 400 && errorText.toLowerCase().includes("content")) {
          errorKey = "errors.kling.contentPolicy";
        } else if (klingResponse.status === 503 || klingResponse.status === 502) {
          errorKey = "errors.kling.modelUnavailable";
        } else {
          errorKey = "errors.kling.unknownError";
        }

        throw new Error(errorKey);
      }

      const klingData = await klingResponse.json();
      console.log("[Kling] Kling API response:", { code: klingData.code, taskId: klingData.data?.task_id });

      const taskId = klingData.data?.task_id;
      if (!taskId) {
        console.error("[Kling] No task_id returned from Kling API:", klingData);
        throw new Error("errors.kling.unknownError");
      }

      // Store Kling task_id in job_id column — always status: "processing" (Kling is always async)
      await supabase
        .from("video_history")
        .update({
          job_id: taskId,
          status: "processing",
        })
        .eq("id", videoEntry.id);

      return NextResponse.json({
        success: true,
        videoId: videoEntry.id,
        message: "Video generation started",
        status: "processing",
        videoUrl: null,
      });
    } catch (klingError) {
      console.error("[Kling] Kling API error:", klingError);

      const errorMessage = klingError instanceof Error
        ? klingError.message
        : "errors.kling.unknownError";

      // Update status to failed and refund credits
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
    console.error("[Kling] Generate API error:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
