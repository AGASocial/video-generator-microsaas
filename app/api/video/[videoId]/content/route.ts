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
      .select("video_url, user_id, status")
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

    if (!video.video_url) {
      return NextResponse.json(
        { error: "Video URL not found" },
        { status: 400 }
      );
    }

    return NextResponse.redirect(video.video_url, 302);
  } catch (error) {
    console.error("[VideoProxy] Video content proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
