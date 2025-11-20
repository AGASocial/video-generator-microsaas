import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { CREDIT_PACKAGES } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

// Option 1: Pre-configured Payment Links
// Map package IDs to Stripe Payment Link codes
// You can provide these codes from your Stripe dashboard
const PAYMENT_LINK_CODES: Record<string, string> = {
  "starter-pack": process.env.STRIPE_PAYMENT_LINK_STARTER || "",
  "creator-pack": process.env.STRIPE_PAYMENT_LINK_CREATOR || "",
  "pro-pack": process.env.STRIPE_PAYMENT_LINK_PRO || "",
  "enterprise-pack": process.env.STRIPE_PAYMENT_LINK_ENTERPRISE || "",
};

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

    // Option 1: Use pre-configured Payment Link URL
    if (product?.stripePaymentLinkUrl) {
      // Add user ID and email to Payment Link URL for tracking
      const separator = product.stripePaymentLinkUrl.includes('?') ? '&' : '?';
      const paymentLinkUrl = `${product.stripePaymentLinkUrl}${separator}client_reference_id=${user.id}&prefilled_email=${encodeURIComponent(user.email || "")}`;
      
      return NextResponse.json({
        paymentLinkUrl,
      });
    }

    // Option 2: Use Payment Link code (fallback)
    const paymentLinkCode = PAYMENT_LINK_CODES[packageId];
    if (paymentLinkCode) {
      // Construct Payment Link URL from code
      const paymentLinkUrl = `https://buy.stripe.com/${paymentLinkCode}?client_reference_id=${user.id}&prefilled_email=${encodeURIComponent(user.email || "")}`;
      
      return NextResponse.json({
        paymentLinkUrl,
      });
    }

    // Option 2: Create Payment Link dynamically via API
    const paymentLink = await stripe.paymentLinks.create({
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
      metadata: {
        userId: user.id,
        packageId: product.id,
        credits: product.credits.toString(),
      },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${request.nextUrl.origin}/credits?success=true`,
        },
      },
    });

    // Add user ID to the URL for webhook tracking
    const paymentLinkUrl = `${paymentLink.url}?client_reference_id=${user.id}&prefilled_email=${encodeURIComponent(user.email || "")}`;

    return NextResponse.json({
      paymentLinkUrl,
    });
  } catch (error) {
    console.error("[v0] Payment Link creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment link" },
      { status: 500 }
    );
  }
}

