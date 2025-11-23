import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/user/videos
 * Get user's video history
 * Query params:
 *   - status: Filter by status (optional)
 *   - limit: Limit number of results (optional)
 *   - order: Order by field (default: created_at)
 *   - ascending: Order direction (default: false)
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
    const status = searchParams.get("status");
    const limit = searchParams.get("limit");
    const order = searchParams.get("order") || "created_at";
    const ascending = searchParams.get("ascending") === "true";

    // Build query
    let query = supabase
      .from("video_history")
      .select("*")
      .eq("user_id", user.id);

    // Apply status filter if provided
    if (status) {
      if (status.includes(",")) {
        // Multiple statuses (comma-separated)
        const statuses = status.split(",").map(s => s.trim());
        query = query.in("status", statuses);
      } else {
        query = query.eq("status", status);
      }
    }

    // Apply ordering
    query = query.order(order, { ascending });

    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }
    }

    const { data: videos, error: videosError } = await query;

    if (videosError) {
      console.error("[API] Error fetching videos:", videosError);
      return NextResponse.json(
        { error: "Failed to fetch videos", details: videosError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      videos: videos || [],
    });
  } catch (error) {
    console.error("[API] Error fetching videos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

