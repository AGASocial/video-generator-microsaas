import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/user/videos/recent
 * Get user's recent completed or queued videos
 * Query params:
 *   - limit: Number of videos to return (default: 6)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "6", 10);

    const { data: videos, error: videosError } = await supabase
      .from("video_history")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["completed", "queued"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (videosError) {
      console.error("[API] Error fetching recent videos:", videosError);
      return NextResponse.json(
        { error: "Failed to fetch recent videos", details: videosError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      videos: videos || [],
    });
  } catch (error) {
    console.error("[API] Error fetching recent videos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

