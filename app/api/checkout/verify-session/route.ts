import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

/**
 * Verify a checkout session status
 * GET /api/checkout/verify-session?sessionId=cs_test_xxxxx
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return NextResponse.json({
      sessionId: session.id,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      metadata: session.metadata,
      client_reference_id: session.client_reference_id,
      customer_email: session.customer_email,
      created: new Date(session.created * 1000).toISOString(),
      webhook_should_fire: session.payment_status === "paid" && session.status === "complete",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

