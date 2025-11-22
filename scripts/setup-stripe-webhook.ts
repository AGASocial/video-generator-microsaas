/**
 * Script to programmatically create a Stripe webhook endpoint
 * 
 * Usage:
 *   npm run setup:webhook <webhook-url>
 *   OR
 *   npx tsx scripts/setup-stripe-webhook.ts <webhook-url>
 * 
 * Example:
 *   npm run setup:webhook https://yourdomain.com/api/webhook/stripe
 */

import Stripe from "stripe";

const webhookUrl = process.argv[2];

if (!webhookUrl) {
  console.error("❌ Error: Webhook URL is required");
  console.log("\nUsage: npx tsx scripts/setup-stripe-webhook.ts <webhook-url>");
  console.log("Example: npx tsx scripts/setup-stripe-webhook.ts https://yourdomain.com/api/webhook/stripe");
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ Error: STRIPE_SECRET_KEY environment variable is not set");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});

async function createWebhookEndpoint() {
  try {
    console.log(`\n🔧 Creating Stripe webhook endpoint...`);
    console.log(`   URL: ${webhookUrl}`);
    console.log(`   Events: checkout.session.completed\n`);

    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: ["checkout.session.completed"],
      description: "Payment webhook for credit purchases",
    });

    console.log("✅ Webhook endpoint created successfully!\n");
    console.log("📋 Webhook Details:");
    console.log(`   ID: ${endpoint.id}`);
    console.log(`   URL: ${endpoint.url}`);
    console.log(`   Status: ${endpoint.status}`);
    console.log(`   Secret: ${endpoint.secret}\n`);
    console.log("⚠️  IMPORTANT: Add this to your environment variables:");
    console.log(`   STRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`);
  } catch (error: any) {
    if (error.code === "resource_already_exists") {
      console.error("❌ Error: A webhook endpoint with this URL already exists");
      console.log("\n💡 You can:");
      console.log("   1. Delete the existing endpoint in Stripe Dashboard");
      console.log("   2. Or use the existing endpoint's secret");
    } else {
      console.error("❌ Error creating webhook endpoint:", error.message);
    }
    process.exit(1);
  }
}

createWebhookEndpoint();

