import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/user/transactions
 * Get user's transaction history
 * Query params:
 *   - limit: Limit number of results (optional, default: 10)
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
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const order = searchParams.get("order") || "created_at";
    const ascending = searchParams.get("ascending") === "true";

    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order(order, { ascending })
      .limit(limit);

    if (transactionsError) {
      console.error("[API] Error fetching transactions:", transactionsError);
      return NextResponse.json(
        { error: "Failed to fetch transactions", details: transactionsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("[API] Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

