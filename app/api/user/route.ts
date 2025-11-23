import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserExists } from "@/app/actions/user";

/**
 * GET /api/user
 * Get current authenticated user data
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

    // Get user data from database
    let { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    // If user doesn't exist, create it (fallback if trigger didn't fire)
    if (!userData) {
      const result = await ensureUserExists(
        authUser.id,
        authUser.email || ""
      );

      if (!result.success || !result.user) {
        return NextResponse.json(
          { 
            error: "User not found and could not be created",
            details: result.error 
          },
          { status: 500 }
        );
      }

      userData = result.user;
    }

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("[API] Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

