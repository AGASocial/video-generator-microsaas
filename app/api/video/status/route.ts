import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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

    const videoId = request.nextUrl.searchParams.get("videoId");
    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId parameter" },
        { status: 400 }
      );
    }

    // Get video entry
    const { data: video, error: videoError } = await supabase
      .from("video_history")
      .select("*")
      .eq("id", videoId)
      .eq("user_id", authUser.id)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      videoId: video.id,
      status: video.status,
      videoUrl: video.video_url,
    });
  } catch (error) {
    console.error("[v0] Status check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

