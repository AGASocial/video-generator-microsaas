import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { CREDIT_PACKAGES } from "@/lib/products";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    console.error("[v0] Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Extract the package info from the line items
    const lineItem = session.line_items?.data[0];
    if (!lineItem) {
      return NextResponse.json({ error: "No line items" }, { status: 400 });
    }

    // Find the matching package by price
    const packageInfo = CREDIT_PACKAGES.find(
      (pkg) => pkg.priceInCents === lineItem.price?.unit_amount
    );

    if (!packageInfo) {
      return NextResponse.json({ error: "Package not found" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get user from session metadata, client_reference_id, or customer email
    // Payment Links can pass client_reference_id via URL parameter
    // Buy Buttons will have customer email in the session
    let userId = session.client_reference_id || session.metadata?.userId;

    // If no user ID, try to match by customer email (for Buy Buttons)
    if (!userId && session.customer_email) {
      const { data: userByEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.customer_email)
        .single();
      
      if (userByEmail) {
        userId = userByEmail.id;
      }
    }

    // If still no user ID, try to get from customer object
    if (!userId && session.customer) {
      try {
        const customer = await stripe.customers.retrieve(session.customer as string);
        if (customer && !customer.deleted && customer.email) {
          const { data: userByEmail } = await supabase
            .from("users")
            .select("id")
            .eq("email", customer.email)
            .single();
          
          if (userByEmail) {
            userId = userByEmail.id;
          }
        }
      } catch (error) {
        console.error("[v0] Error retrieving customer:", error);
      }
    }

    if (!userId) {
      console.error("[v0] No user ID found in session", {
        client_reference_id: session.client_reference_id,
        metadata: session.metadata,
        customer_email: session.customer_email,
        customer: session.customer,
      });
      return NextResponse.json({ error: "No user ID found" }, { status: 400 });
    }

    // Add credits to user
    const { data: user } = await supabase
      .from("users")
      .select("credits")
      .eq("id", userId)
      .single();

    if (user) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ credits: user.credits + packageInfo.credits })
        .eq("id", userId);

      if (updateError) {
        console.error("[v0] Failed to update credits:", updateError);
      }

      // Record transaction
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          amount: packageInfo.priceInCents,
          credits_purchased: packageInfo.credits,
          stripe_session_id: session.id,
          status: "completed",
        });

      if (transactionError) {
        console.error("[v0] Failed to record transaction:", transactionError);
      }
    }
  }

  return NextResponse.json({ received: true });
}
