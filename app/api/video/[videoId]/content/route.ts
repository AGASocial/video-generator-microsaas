import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
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

    // Get video entry and verify user owns it
    const { data: video, error: videoError } = await supabase
      .from("video_history")
      .select("job_id, user_id, status")
      .eq("id", videoId)
      .eq("user_id", authUser.id)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    if (video.status !== "completed") {
      return NextResponse.json(
        { error: "Video not ready" },
        { status: 400 }
      );
    }

    if (!video.job_id) {
      return NextResponse.json(
        { error: "Video ID not found" },
        { status: 400 }
      );
    }

    // Fetch video content from OpenAI with API key
    const contentUrl = `https://api.openai.com/v1/videos/${video.job_id}/content`;
    
    const openaiResponse = await fetch(contentUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    if (!openaiResponse.ok) {
      console.error("[v0] Failed to fetch video content:", await openaiResponse.text());
      return NextResponse.json(
        { error: "Failed to fetch video content" },
        { status: 500 }
      );
    }

    // Get the video content as a blob
    const videoBlob = await openaiResponse.blob();

    // Return the video with proper headers
    return new NextResponse(videoBlob, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `inline; filename="video-${videoId}.mp4"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[v0] Video content proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

