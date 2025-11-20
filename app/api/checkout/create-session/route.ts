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

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      redirect_on_completion: "never",
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
      mode: "payment",
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        packageId: product.id,
        credits: product.credits.toString(),
      },
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
    });
  } catch (error) {
    console.error("[v0] Checkout session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

