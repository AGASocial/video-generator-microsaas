# Webhook Debugging Guide

## Where to Look for Logs

### 1. Next.js Dev Server Terminal
This is where you run `npm run dev`. You should see:
```
[WEBHOOK] ========== STRIPE WEBHOOK RECEIVED ==========
[WEBHOOK] Timestamp: ...
```

### 2. Stripe CLI Terminal
This is where you run `stripe listen`. You should see:
```
--> checkout.session.completed [evt_xxxxx]
<--  [200] POST http://localhost:3000/api/webhook/stripe
```

## Troubleshooting

### No logs in Next.js terminal?
1. **Check if dev server is running**: Look for `npm run dev` terminal
2. **Check if webhook secret is loaded**: Restart dev server after adding `STRIPE_WEBHOOK_SECRET`
3. **Check Stripe CLI**: Make sure `stripe listen` is running and shows "Ready!"

### No logs in Stripe CLI terminal?
1. **Check if Stripe CLI is running**: Should show "Ready!" message
2. **Check the forward URL**: Should be `localhost:3000/api/webhook/stripe`
3. **Try triggering a test event**: `stripe trigger checkout.session.completed`

### Webhook received but credits not updating?
1. Check webhook logs for errors
2. Verify payment status is "paid"
3. Check if user ID is found in session
4. Check database for transaction records

## Test Webhook Manually

```bash
# Trigger a test event
stripe trigger checkout.session.completed

# Check if webhook was received
# Look in Next.js dev server terminal for [WEBHOOK] logs
```

## Verify Webhook Endpoint

Visit: `http://localhost:3000/api/webhook/stripe/test`

Should return:
```json
{
  "status": "Webhook endpoint is accessible",
  "webhookSecretConfigured": true,
  "endpoint": "/api/webhook/stripe"
}
```

