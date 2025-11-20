import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadAndStoreVideoFromOpenAI, downloadAndStoreVideo } from "@/lib/video-storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, videoUrl, status, soraVideoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get video entry to find user_id
    const { data: videoEntry, error: videoError } = await supabase
      .from("video_history")
      .select("user_id, job_id")
      .eq("id", videoId)
      .single();

    if (videoError || !videoEntry) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Update status first
    await supabase
      .from("video_history")
      .update({ status: status || "completed" })
      .eq("id", videoId);

    // If video is completed, download and store it in Supabase Storage
    if ((status || "completed") === "completed") {
      let storageResult;

      if (soraVideoId) {
        // Store soraVideoId in job_id if not already set
        if (!videoEntry.job_id) {
          await supabase
            .from("video_history")
            .update({ job_id: soraVideoId })
            .eq("id", videoId);
        }

        // Download from OpenAI and store in Supabase
        console.log(`[Webhook] Downloading and storing video ${videoId} from OpenAI`);
        storageResult = await downloadAndStoreVideoFromOpenAI(
          videoId,
          soraVideoId,
          videoEntry.user_id
        );
      } else if (videoUrl) {
        // Download from provided URL and store in Supabase
        console.log(`[Webhook] Downloading and storing video ${videoId} from external URL`);
        storageResult = await downloadAndStoreVideo(
          videoId,
          videoUrl,
          videoEntry.user_id
        );
      } else {
        return NextResponse.json(
          { error: "Missing videoUrl or soraVideoId" },
          { status: 400 }
        );
      }

      if (!storageResult.success) {
        console.error("[Webhook] Failed to store video:", storageResult.error);
        // Don't fail the webhook - video is still completed, just not stored
        // You might want to retry storage later
        return NextResponse.json({
          success: true,
          warning: "Video completed but storage failed. Will retry.",
        });
      }

      console.log(`[Webhook] Video ${videoId} stored successfully at: ${storageResult.supabaseUrl}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
