import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // If soraVideoId is provided, store it in job_id and use proxy URL
    // Otherwise, if videoUrl is provided, use it directly (for backward compatibility)
    let finalVideoUrl: string;
    
    if (soraVideoId) {
      // Use proxy endpoint to keep API key secure
      finalVideoUrl = `/api/video/${videoId}/content`;
      
      // Update job_id with sora_video_id if not already set
      const { data: existingVideo } = await supabase
        .from("video_history")
        .select("job_id")
        .eq("id", videoId)
        .single();
      
      if (!existingVideo?.job_id) {
        await supabase
          .from("video_history")
          .update({ job_id: soraVideoId })
          .eq("id", videoId);
      }
    } else if (videoUrl) {
      // Fallback: use provided URL directly (for backward compatibility)
      finalVideoUrl = videoUrl;
    } else {
      return NextResponse.json(
        { error: "Missing videoUrl or soraVideoId" },
        { status: 400 }
      );
    }

    // Update video history with the completed video URL
    const { error } = await supabase
      .from("video_history")
      .update({
        video_url: finalVideoUrl,
        status: status || "completed",
      })
      .eq("id", videoId);

    if (error) {
      console.error("[v0] Failed to update video:", error);
      return NextResponse.json(
        { error: "Failed to update video" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
