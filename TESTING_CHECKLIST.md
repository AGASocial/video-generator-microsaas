# Testing Checklist

## Pre-Testing Setup

### 1. Database Setup (Supabase)
- [ ] Run `scripts/001_create_tables.sql` - Creates users, video_history, transactions tables
- [ ] Run `scripts/002_create_user_trigger.sql` - Auto-creates user profiles on signup
- [ ] Run `scripts/004_add_job_id_column.sql` - Adds job_id column for async video tracking
- [ ] Verify RLS policies are active on all tables

### 2. Environment Variables (.env.dev)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (for local testing, use Stripe CLI)
- [ ] `OPENAI_API_URL` - Your OpenAI API endpoint
- [ ] `OPENAI_API_KEY` - Your OpenAI API key

### 3. Stripe Webhook Setup (Local Testing)
- [ ] Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
- [ ] Login: `stripe login`
- [ ] Forward webhooks: `stripe listen --forward-to localhost:3000/api/webhook/stripe`
- [ ] Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in `.env.dev`

## Testing Flow

### Authentication Tests
- [ ] Sign up new user → Should create user profile with 10 credits
- [ ] Login with existing user → Should redirect to /generate
- [ ] Sign out → Should redirect to home page
- [ ] Protected routes → Should redirect to login if not authenticated

### Credit System Tests
- [ ] View credits page → Should show current credit balance
- [ ] Purchase credits → Click "Purchase" → Should redirect to Stripe Payment Link
- [ ] Complete payment → Webhook should add credits to account
- [ ] Verify credits updated → Check credits page after payment

### Video Generation Tests
- [ ] Generate video with sora-2 → Should deduct 1 credit
- [ ] Generate video with sora-2-pro → Should deduct 3 credits
- [ ] Insufficient credits → Should show error and redirect to credits page
- [ ] Video generation status → Should show "processing" then update to "completed"
- [ ] Video history → Should appear in profile page

### Payment Link Tests
- [ ] Starter Pack ($9.99) → Should redirect with user ID in URL
- [ ] Creator Pack ($19.99) → Should redirect with user ID in URL
- [ ] Pro Pack ($39.99) → Should redirect with user ID in URL
- [ ] Enterprise Pack ($99.99) → Should redirect with user ID in URL
- [ ] Verify `client_reference_id` in Stripe dashboard after payment

## Known Considerations

1. **OpenAI API Format**: The polling function assumes OpenAI returns `job_id` and supports status checks. Adjust if your API format differs.

2. **Video Duration**: Currently restricted to 8 seconds only (as per requirements).

3. **Credit Costs**: 
   - sora-2: 1 credit
   - sora-2-pro: 3 credits
   - sora-2-pro-HD: 3 credits

4. **Webhook Testing**: Use Stripe CLI for local webhook testing, or test in production.

## Quick Start Commands

```bash
# Install dependencies (if needed)
npm install

# Start dev server with .env.dev
npm run dev

# In another terminal, forward Stripe webhooks
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

