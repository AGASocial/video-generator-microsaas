import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET endpoint to fetch predefined prompts
export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user (optional - we can make prompts public or require auth)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // For now, we'll allow unauthenticated access to prompts
    // If you want to restrict, uncomment the following:
    // if (authError || !user) {
    //   return NextResponse.json(
    //     { error: "Unauthorized" },
    //     { status: 401 }
    //   );
    // }

    // Fetch active predefined prompts, ordered by display_order
    const { data: prompts, error } = await supabase
      .from("predefined_prompts")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("[Prompts] Error fetching prompts:", error);
      return NextResponse.json(
        { error: "Failed to fetch prompts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prompts: prompts || [],
    });
  } catch (error) {
    console.error("[Prompts] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

