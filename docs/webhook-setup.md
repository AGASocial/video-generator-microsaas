# Stripe Webhook Setup Guide

## Problem
After payment, credits are not being added because the webhook is not being called.

## Solution

### For Local Development (localhost)

You need to use Stripe CLI to forward webhooks to your local server:

1. **Install Stripe CLI** (if not already installed):
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server** (run this in a separate terminal):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```

4. **Copy the webhook signing secret** that appears in the terminal output. It will look like:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxx
   ```

5. **Add it to your `.env.dev` file**:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

6. **Restart your dev server** to load the new environment variable

### For Production

You have two options:

#### Option 1: Manual Setup (Recommended)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://yourdomain.com/api/webhook/stripe`
4. Select event: `checkout.session.completed`
5. Copy the webhook signing secret
6. Add it as `STRIPE_WEBHOOK_SECRET` in your production environment variables

#### Option 2: Programmatic Setup (Alternative)
You can create the webhook endpoint programmatically using the provided script:

```bash
npx tsx scripts/setup-stripe-webhook.ts https://yourdomain.com/api/webhook/stripe
```

This will:
- Create the webhook endpoint in Stripe
- Display the webhook secret
- You'll need to add `STRIPE_WEBHOOK_SECRET` to your environment variables

**Note**: The script requires `STRIPE_SECRET_KEY` to be set in your environment.

## Testing

After setting up the webhook:

1. Make a test payment
2. Check your server logs - you should see `[WEBHOOK] ========== STRIPE WEBHOOK RECEIVED ==========`
3. If you see webhook logs, the webhook is working
4. If you don't see webhook logs, the webhook is not being called

## Troubleshooting

- **No webhook logs**: Webhook is not configured or not reaching your server
- **Signature verification failed**: Wrong `STRIPE_WEBHOOK_SECRET`
- **Payment status not paid**: Payment might have failed or is still processing
- **User not found**: `client_reference_id` or metadata not being passed correctly


