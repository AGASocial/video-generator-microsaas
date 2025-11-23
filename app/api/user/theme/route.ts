import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/user/theme
 * Get current user's theme preference
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's theme preference from database
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("theme_preference")
      .eq("id", authUser.id)
      .single();

    if (userError && userError.code !== "PGRST116") {
      // PGRST116 is "not found" - we'll return default theme
      console.error("[API] Error fetching theme preference:", userError);
    }

    return NextResponse.json({
      success: true,
      theme: userData?.theme_preference || "christmas",
    });
  } catch (error) {
    console.error("[API] Error fetching theme preference:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/theme
 * Update current user's theme preference
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { theme } = body;

    if (!theme || typeof theme !== "string") {
      return NextResponse.json(
        { error: "Theme preference is required" },
        { status: 400 }
      );
    }

    // Update user's theme preference
    const { data: userData, error: updateError } = await supabase
      .from("users")
      .update({ theme_preference: theme })
      .eq("id", authUser.id)
      .select("theme_preference")
      .single();

    if (updateError) {
      console.error("[API] Error updating theme preference:", updateError);
      return NextResponse.json(
        { error: "Failed to update theme preference" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      theme: userData?.theme_preference || theme,
    });
  } catch (error) {
    console.error("[API] Error updating theme preference:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

