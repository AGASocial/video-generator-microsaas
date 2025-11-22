import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

/**
 * Verify that the Stripe keys are from the same account
 * GET /api/checkout/verify-keys
 */
export async function GET(request: NextRequest) {
  try {
    // Get account info from the secret key
    const account = await stripe.accounts.retrieve();
    
    // Also try to get a test balance to verify the key works
    let balance;
    try {
      balance = await stripe.balance.retrieve();
    } catch (e) {
      // Balance might not be accessible
    }

    return NextResponse.json({
      account: {
        id: account.id,
        type: account.type,
        email: account.email,
        country: account.country,
        default_currency: account.default_currency,
        created: new Date(account.created * 1000).toISOString(),
      },
      balance: balance ? {
        available: balance.available,
        pending: balance.pending,
        instant_available: balance.instant_available,
      } : null,
      keys: {
        secretKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
        secretKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10) || "not set",
        secretKeyLength: process.env.STRIPE_SECRET_KEY?.length || 0,
        webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
        webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) || "not set",
        webhookSecretLength: process.env.STRIPE_WEBHOOK_SECRET?.length || 0,
      },
      instructions: {
        step1: "Check if the account ID matches your Stripe Dashboard",
        step2: "Run 'stripe listen --print-secret' to see which account Stripe CLI is listening to",
        step3: "Make sure Stripe CLI is logged into the same account as your STRIPE_SECRET_KEY",
        step4: "To check Stripe CLI account: 'stripe config --list' or 'stripe whoami'",
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || "Failed to verify keys",
      keys: {
        secretKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
        secretKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10) || "not set",
        webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
        webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) || "not set",
      },
    }, { status: 500 });
  }
}

