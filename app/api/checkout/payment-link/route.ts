import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { CREDIT_PACKAGES } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json(
        { error: "Package ID is required" },
        { status: 400 }
      );
    }

    const product = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!product) {
      return NextResponse.json(
        { error: `Package with id "${packageId}" not found` },
        { status: 404 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    // Use Checkout Sessions instead of Payment Links for more reliable redirects
    // Payment Links created via API sometimes don't respect after_completion redirects
    const successUrl = new URL("/credits", request.nextUrl.origin);
    successUrl.searchParams.set("success", "true");
    
    const cancelUrl = new URL("/credits", request.nextUrl.origin);
    
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: {
        userId: user.id,
        packageId: product.id,
        credits: product.credits.toString(),
      },
    });

    console.log("[v0] Checkout Session created:", {
      sessionId: session.id,
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });

    // Return the checkout session URL instead of payment link URL
    return NextResponse.json({
      paymentLinkUrl: session.url, // Keep the same response format for compatibility
    });
  } catch (error) {
    console.error("[v0] Checkout Session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

