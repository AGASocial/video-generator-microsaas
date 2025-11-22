# Webhook Troubleshooting Guide

## Issue: No webhook events in Stripe CLI

### Check 1: Is Stripe CLI running?
```bash
ps aux | grep "stripe listen"
```
Should show a process running.

### Check 2: Is Stripe CLI listening to the right events?
Make sure you see "Ready!" message with the webhook secret.

### Check 3: Test with a trigger
```bash
stripe trigger checkout.session.completed
```
You should see:
```
--> checkout.session.completed [evt_xxxxx]
<--  [200] POST http://localhost:3000/api/webhook/stripe
```

### Check 4: Real Payment vs Test Trigger
- **Test trigger** (`stripe trigger`): Creates fake events, may not have metadata
- **Real payment**: Must complete checkout in browser, then webhook fires

### Check 5: Payment Completion
1. Go to checkout URL
2. Enter test card: `4242 4242 4242 4242`
3. Complete payment
4. Should see webhook in Stripe CLI within 1-3 seconds

### Check 6: Test Mode
Make sure:
- Your Stripe account is in **test mode**
- Stripe CLI is listening to **test mode** events (default)
- Your app is using **test mode** API keys

### Check 7: Key/Account Mismatch (CRITICAL!)
**This is often the root cause!**

Your checkout uses `STRIPE_SECRET_KEY` to create payments, but Stripe CLI listens to events from the account you're logged into. If these don't match, webhooks won't fire!

**Verify:**
1. Check which account your app uses:
   ```bash
   curl http://localhost:3000/api/checkout/verify-keys
   ```
   This shows the account ID from your `STRIPE_SECRET_KEY`.

2. Check which account Stripe CLI is using:
   ```bash
   stripe whoami
   # or
   stripe config --list
   ```

3. **They must match!** If they don't:
   ```bash
   # Log out of current account
   stripe logout
   
   # Log into the correct account (the one matching your STRIPE_SECRET_KEY)
   stripe login
   
   # Restart Stripe CLI
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```

**Quick test:**
- If `stripe trigger checkout.session.completed` works → Stripe CLI is working
- If real payments don't trigger webhooks → Account mismatch!

## Common Issues

### No webhook after payment
- Payment might not have completed
- Check Stripe Dashboard → Payments to see if payment succeeded
- Webhook only fires when payment status = "paid"

### Webhook shows 400 error
- Check Next.js terminal for detailed error logs
- Usually signature verification issue
- Make sure `STRIPE_WEBHOOK_SECRET` matches Stripe CLI secret

### Webhook shows 200 but credits not added
- Check webhook logs for processing errors
- Verify metadata is present in session
- Check database for transaction records

