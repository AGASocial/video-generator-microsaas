import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { CREDIT_PACKAGES } from "@/lib/products";

// Disable body parsing to ensure raw body is available for signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Force immediate log output
  console.error("[WEBHOOK] ========== STRIPE WEBHOOK RECEIVED ==========");
  console.error("[WEBHOOK] Timestamp:", new Date().toISOString());
  console.error("[WEBHOOK] URL:", request.url);
  console.error("[WEBHOOK] Method:", request.method);
  
  const body = await request.text();
  
  // Try multiple ways to get the signature header (case-insensitive)
  const signature = 
    request.headers.get("stripe-signature") ||
    request.headers.get("Stripe-Signature") ||
    request.headers.get("STRIPE-SIGNATURE") ||
    (request.headers as any).get("stripe-signature");
  
  // Log all headers for debugging
  const allHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    allHeaders[key] = value;
  });
  
  console.error("[WEBHOOK] All headers:", allHeaders);
  console.error("[WEBHOOK] Stripe signature header:", signature || "MISSING");
  
  // Log if webhook secret is configured
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  console.error("[WEBHOOK] Webhook secret configured:", hasWebhookSecret);

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
    console.log("[WEBHOOK] ✅ Signature verified successfully");
    console.log("[WEBHOOK] Event type:", event.type);
    console.log("[WEBHOOK] Event ID:", event.id);
  } catch (err: any) {
    console.error("[WEBHOOK] ❌ Signature verification failed:", err);
    console.error("[WEBHOOK] Error message:", err.message);
    console.error("[WEBHOOK] Webhook secret configured:", !!process.env.STRIPE_WEBHOOK_SECRET);
    console.error("[WEBHOOK] Webhook secret length:", process.env.STRIPE_WEBHOOK_SECRET?.length || 0);
    console.error("[WEBHOOK] Expected secret starts with:", process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) || "none");
    console.error("[WEBHOOK] Signature header:", signature ? signature.substring(0, 20) + "..." : "missing");
    return NextResponse.json(
      { 
        error: "Webhook signature verification failed",
        message: err.message,
        secretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET
      },
      { status: 400 }
    );
  }

  // Log all event types for debugging
  console.log("[WEBHOOK] Event details:", {
    type: event.type,
    id: event.id,
    created: new Date(event.created * 1000).toISOString(),
    livemode: event.livemode,
  });

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    console.log("[WEBHOOK] ========== PROCESSING checkout.session.completed ==========");
    const session = event.data.object;
    console.log("[WEBHOOK] ✅ Received checkout.session.completed event for session:", session.id);

    // Log full session object for debugging
    console.log("[WEBHOOK] Session object:", {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      currency: session.currency,
      client_reference_id: session.client_reference_id,
      customer_email: session.customer_email,
      customer: session.customer,
      metadata: session.metadata || {},
      metadata_keys: session.metadata ? Object.keys(session.metadata) : [],
      mode: session.mode,
      payment_intent: session.payment_intent,
      has_line_items: !!session.line_items,
    });

    // Validate payment status - only process if payment was actually successful
    if (session.payment_status !== "paid") {
      console.warn(`[WEBHOOK] ⚠️ Payment not completed for session ${session.id}`);
      console.warn(`[WEBHOOK] Payment status: ${session.payment_status} (expected: paid)`);
      console.warn(`[WEBHOOK] Session status: ${session.status}`);
      return NextResponse.json(
        { 
          received: true,
          message: `Payment status is ${session.payment_status}, not processing credits`
        },
        { status: 200 }
      );
    }
    console.log("[WEBHOOK] ✅ Payment status: paid");

    // Check if session status is complete
    if (session.status !== "complete") {
      console.warn(`[WEBHOOK] ⚠️ Session ${session.id} is not complete`);
      console.warn(`[WEBHOOK] Session status: ${session.status} (expected: complete)`);
      return NextResponse.json(
        { 
          received: true,
          message: `Session status is ${session.status}, not processing credits`
        },
        { status: 200 }
      );
    }
    console.log("[WEBHOOK] ✅ Session status: complete");

    // Check for duplicate processing (idempotency)
    console.log("[WEBHOOK] Checking for existing transaction...");
    // Use service role client to bypass RLS (webhooks don't have user sessions)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[WEBHOOK] ❌ SUPABASE_SERVICE_ROLE_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    const { data: existingTransaction, error: checkError } = await supabase
      .from("transactions")
      .select("id")
      .eq("stripe_session_id", session.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("[WEBHOOK] Error checking for existing transaction:", checkError);
    }

    if (existingTransaction) {
      console.log(`[WEBHOOK] ⚠️ Transaction for session ${session.id} already processed. Skipping.`);
      return NextResponse.json(
        { 
          received: true,
          message: "Transaction already processed"
        },
        { status: 200 }
      );
    }
    console.log("[WEBHOOK] ✅ No existing transaction found, proceeding...");

    // Expand line items if not already included
    console.log("[WEBHOOK] Retrieving line items...");
    let lineItem = session.line_items?.data?.[0];
    console.log("[WEBHOOK] Line items in session:", {
      has_line_items: !!session.line_items,
      line_items_count: session.line_items?.data?.length || 0,
      first_item_price: lineItem?.price?.unit_amount || null,
    });

    if (!lineItem && session.id) {
      try {
        console.log("[WEBHOOK] Expanding session to get line items...");
        const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        });
        lineItem = expandedSession.line_items?.data?.[0];
        console.log("[WEBHOOK] Expanded line item:", {
          price: lineItem?.price?.unit_amount || null,
          quantity: lineItem?.quantity || null,
        });
      } catch (error) {
        console.error("[WEBHOOK] ❌ Error expanding line items:", error);
      }
    }

    // If still no line item, try to get package from metadata
    console.log("[WEBHOOK] Finding package info...");
    let packageInfo;
    if (lineItem) {
      console.log("[WEBHOOK] Looking for package by price:", lineItem.price?.unit_amount);
      // Find the matching package by price
      packageInfo = CREDIT_PACKAGES.find(
        (pkg) => pkg.priceInCents === lineItem.price?.unit_amount
      );
      if (packageInfo) {
        console.log("[WEBHOOK] ✅ Found package by price:", packageInfo.id);
      } else {
        console.log("[WEBHOOK] ❌ No package found for price:", lineItem.price?.unit_amount);
        console.log("[WEBHOOK] Available packages:", CREDIT_PACKAGES.map(p => ({ id: p.id, price: p.priceInCents })));
      }
    } else if (session.metadata?.packageId) {
      console.log("[WEBHOOK] Looking for package by metadata packageId:", session.metadata.packageId);
      // Fallback to metadata if line items aren't available
      packageInfo = CREDIT_PACKAGES.find(
        (pkg) => pkg.id === session.metadata?.packageId
      );
      if (packageInfo) {
        console.log("[WEBHOOK] ✅ Found package by metadata:", packageInfo.id);
      } else {
        console.log("[WEBHOOK] ❌ No package found for metadata packageId:", session.metadata?.packageId);
      }
    } else {
      console.log("[WEBHOOK] ❌ No line item and no metadata.packageId");
    }

    if (!packageInfo) {
      console.error("[WEBHOOK] ❌ Package not found", {
        lineItem: lineItem ? { price: lineItem.price?.unit_amount } : null,
        metadata: session.metadata || {},
        metadata_keys: session.metadata ? Object.keys(session.metadata) : [],
        client_reference_id: session.client_reference_id,
        amount_total: session.amount_total,
        availablePackages: CREDIT_PACKAGES.map(p => ({ id: p.id, price: p.priceInCents })),
      });
      
      // For test events from stripe trigger, this is expected - they don't have metadata
      // Return 200 to acknowledge receipt but don't process
      if (!session.metadata || Object.keys(session.metadata).length === 0) {
        console.warn("[WEBHOOK] ⚠️ Test event detected (no metadata) - skipping credit processing");
        return NextResponse.json({ 
          received: true,
          message: "Test event - no metadata available, skipping processing"
        }, { status: 200 });
      }
      
      return NextResponse.json({ 
        error: "Package not found",
        message: "Unable to determine credit package from session data"
      }, { status: 400 });
    }
    console.log("[WEBHOOK] ✅ Package found:", { id: packageInfo.id, credits: packageInfo.credits, price: packageInfo.priceInCents });

    // Get user from session metadata, client_reference_id, or customer email
    console.log("[WEBHOOK] Finding user...");
    let userId = session.client_reference_id || session.metadata?.userId;
    console.log("[WEBHOOK] User ID from client_reference_id or metadata:", userId);

    // If no user ID, try to match by customer email (for Buy Buttons)
    if (!userId && session.customer_email) {
      console.log("[WEBHOOK] Looking up user by email:", session.customer_email);
      const { data: userByEmail, error: emailError } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.customer_email)
        .single();
      
      if (emailError) {
        console.error("[WEBHOOK] Error looking up user by email:", emailError);
      }
      
      if (userByEmail) {
        userId = userByEmail.id;
        console.log("[WEBHOOK] ✅ Found user by email:", userId);
      } else {
        console.log("[WEBHOOK] ❌ No user found with email:", session.customer_email);
      }
    }

    // If still no user ID, try to get from customer object
    if (!userId && session.customer) {
      console.log("[WEBHOOK] Retrieving customer from Stripe:", session.customer);
      try {
        const customer = await stripe.customers.retrieve(session.customer as string);
        if (customer && !customer.deleted && customer.email) {
          console.log("[WEBHOOK] Customer email from Stripe:", customer.email);
          const { data: userByEmail, error: customerEmailError } = await supabase
            .from("users")
            .select("id")
            .eq("email", customer.email)
            .single();
          
          if (customerEmailError) {
            console.error("[WEBHOOK] Error looking up user by customer email:", customerEmailError);
          }
          
          if (userByEmail) {
            userId = userByEmail.id;
            console.log("[WEBHOOK] ✅ Found user by customer email:", userId);
          } else {
            console.log("[WEBHOOK] ❌ No user found with customer email:", customer.email);
          }
        }
      } catch (error) {
        console.error("[WEBHOOK] ❌ Error retrieving customer:", error);
      }
    }

    if (!userId) {
      console.error("[WEBHOOK] ❌ No user ID found in session", {
        client_reference_id: session.client_reference_id,
        metadata: session.metadata,
        customer_email: session.customer_email,
        customer: session.customer,
      });
      return NextResponse.json({ error: "No user ID found" }, { status: 400 });
    }
    console.log("[WEBHOOK] ✅ User ID found:", userId);

    // Add credits to user
    console.log("[WEBHOOK] Fetching current user credits...");
    const { data: user, error: userFetchError } = await supabase
      .from("users")
      .select("credits")
      .eq("id", userId)
      .single();

    if (userFetchError) {
      console.error("[WEBHOOK] ❌ Error fetching user:", userFetchError);
      return NextResponse.json(
        { error: "User not found", details: userFetchError.message },
        { status: 404 }
      );
    }

    if (!user) {
      console.error("[WEBHOOK] ❌ User object is null after fetch");
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log("[WEBHOOK] Current user credits:", user.credits);
    const newCredits = user.credits + packageInfo.credits;
    console.log("[WEBHOOK] Updating credits:", `${user.credits} + ${packageInfo.credits} = ${newCredits}`);
    
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ credits: newCredits })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("[WEBHOOK] ❌ Failed to update credits:", updateError);
      return NextResponse.json(
        { error: "Failed to update credits", details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[WEBHOOK] ✅ Credits updated successfully: ${user.credits} -> ${newCredits} (added ${packageInfo.credits})`);

    // Record transaction
    console.log("[WEBHOOK] Recording transaction...");
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        amount: packageInfo.priceInCents,
        credits_purchased: packageInfo.credits,
        stripe_session_id: session.id,
        status: "completed",
      })
      .select()
      .single();

    if (transactionError) {
      console.error("[WEBHOOK] ❌ Failed to record transaction:", transactionError);
      // Don't fail the webhook if transaction recording fails - credits are already added
    } else {
      console.log(`[WEBHOOK] ✅ Transaction recorded:`, {
        transactionId: transaction.id,
        userId: userId,
        credits: packageInfo.credits,
        amount: packageInfo.priceInCents / 100,
        sessionId: session.id,
      });
    }
    
    console.log("[WEBHOOK] ========== WEBHOOK PROCESSING COMPLETE ==========");
  } else {
    console.log("[WEBHOOK] ⚠️ Event type not handled:", event.type);
    console.log("[WEBHOOK] Full event:", JSON.stringify(event, null, 2));
  }

  console.log("[WEBHOOK] ========== WEBHOOK RESPONSE SENT ==========");
  return NextResponse.json({ received: true });
}
