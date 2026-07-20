# Pre-Deploy Runbook: CCTV Magic

**Purpose:** Top-to-bottom checklist before going live. Work through each section in order. Check the box only after verifying, not just reading.

---

## Section 1: Environment Variables (Vercel Dashboard)

Open Vercel Dashboard → Project → Settings → Environment Variables.

Set scope to **Production** for all vars below.

### Required Variables

| Variable | Source | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Starts with `https://` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API | `service_role` key — keep secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys | Use **live** key (`pk_live_...`) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | Use **live** key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → Signing secret | Use **live** webhook signing secret |
| `KLING_ACCESS_KEY` | Kling AI Portal → API Keys | |
| `KLING_SECRET_KEY` | Kling AI Portal → API Keys | |
| `KLING_WEBHOOK_SECRET` | Kling AI Portal → Webhook Settings | Must match Kling portal registration |
| `KLING_API_URL` | `https://api-singapore.klingai.com` | Hardcoded value |
| `NEXT_PUBLIC_APP_URL` | Your production domain | e.g., `https://cctvmagic.com` — no trailing slash |

### Variables That Must NOT Be Set in Production

- [ ] `KLING_WEBHOOK_SKIP_VERIFICATION` — **must be absent or empty** in production. Its presence disables Kling webhook signature verification, allowing anyone to fake video completion events.
- [ ] `OPENAI_API_KEY` — can be removed; Sora migration is complete.

### Verification

```bash
# Pull current production env vars (redacted) and check for unwanted keys
vercel env ls --environment production | grep -E "KLING_WEBHOOK_SKIP|OPENAI_API_KEY"
# Expected: no output (neither key should be present in production)

vercel env ls --environment production | grep "NEXT_PUBLIC_APP_URL"
# Expected: one line showing NEXT_PUBLIC_APP_URL
```

- [ ] All 11 required variables are set in Vercel production
- [ ] `KLING_WEBHOOK_SKIP_VERIFICATION` is NOT present in production
- [ ] `NEXT_PUBLIC_APP_URL` value matches the live domain (no trailing slash)

---

## Section 2: Supabase Production Checks

Open Supabase Dashboard → SQL Editor for the production project.

### 2a. Verify RLS Is Enabled on All Tables

Run this query:

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'video_users',
    'video_history',
    'video_transactions',
    'video_processed_webhook_events'
  )
ORDER BY tablename;
```

Expected output: all four rows have `rowsecurity = true`.

- [ ] `video_users` → `rowsecurity = true`
- [ ] `video_history` → `rowsecurity = true`
- [ ] `video_transactions` → `rowsecurity = true`
- [ ] `video_processed_webhook_events` → `rowsecurity = true`

If any row shows `rowsecurity = false`, run the corresponding migration script from `scripts/` against the production database.

### 2b. Verify `video_processed_webhook_events` Table Exists

```sql
SELECT COUNT(*) FROM video_processed_webhook_events;
```

Expected: returns `0` or any integer (not an error). If the table is missing, apply `scripts/010_create_processed_webhook_events.sql`.

- [ ] Table exists and query returns without error

### 2c. Verify `deduct_credits_and_create_video` RPC Exists

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'deduct_credits_and_create_video';
```

Expected: one row returned.

- [ ] RPC exists

### 2d. Verify `video_history` Has `credit_cost` Column

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'video_history'
  AND column_name = 'credit_cost';
```

Expected: one row with `column_name = credit_cost`.

- [ ] `credit_cost` column exists on `video_history`

### 2e. Configure Supabase Auth Email Templates (Spanish)

In Supabase Dashboard → Authentication → Email Templates → **Reset Password**:

Update the subject and body to Spanish. Recommended subject: `Restablecer tu contraseña`. Recommended body includes a link using the `{{ .ConfirmationURL }}` variable. Example body:

```
Hola,

Haz clic en el siguiente enlace para restablecer tu contraseña:

{{ .ConfirmationURL }}

Este enlace expira en 24 horas. Si no solicitaste restablecer tu contraseña, ignora este correo.
```

Set the **Redirect URL** for password reset to: `https://YOUR_DOMAIN/es/auth/reset-password`

- [ ] Reset Password email template updated to Spanish
- [ ] Redirect URL points to `/es/auth/reset-password` (or `/en/auth/reset-password` for English audience)

---

## Section 3: Stripe Production Setup

### 3a. Register Webhook Endpoint

In Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **URL:** `https://YOUR_DOMAIN/api/webhook/stripe`
- **Events:** `checkout.session.completed`
- **Mode:** Live

After creation, copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET` in Vercel.

- [ ] Webhook endpoint registered
- [ ] `checkout.session.completed` event selected
- [ ] Signing secret copied to Vercel `STRIPE_WEBHOOK_SECRET`

### 3b. Verify Live Mode Keys

- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`
- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_`

---

## Section 4: Kling Webhook Setup

In the Kling AI portal → Webhook Settings:

- **Webhook URL:** `https://YOUR_DOMAIN/api/webhook/video-complete`
- **Secret:** must match the `KLING_WEBHOOK_SECRET` value in Vercel

- [ ] Webhook URL registered in Kling portal
- [ ] Kling webhook secret matches `KLING_WEBHOOK_SECRET` in Vercel

---

## Section 5: Deploy

```bash
# Trigger production deploy
vercel --prod
```

Wait for build to complete. Check Vercel build logs for:
- No missing env var warnings
- No TypeScript errors
- Build exits with code 0

- [ ] Production deploy completed successfully
- [ ] Build log shows no env var or TypeScript errors

---

## Section 6: Smoke Tests (after deploy)

Run all smoke tests against the live production URL.

### 6a. Video Proxy — Returns 302 Redirect

```bash
# Replace {VIDEO_ID} with an actual completed video ID from video_history
# Replace {SESSION_COOKIE} with a valid session cookie from a logged-in browser request
curl -v -H "Cookie: {SESSION_COOKIE}" \
  https://YOUR_DOMAIN/api/video/{VIDEO_ID}/content 2>&1 | grep "< HTTP\|Location:"
```

Expected:
```
< HTTP/2 302
Location: https://uxskkfvndzoojxucjmxg.supabase.co/storage/v1/object/...
```

- [ ] Video proxy returns 302
- [ ] Location header points to a Supabase Storage URL

### 6b. Password Reset Flow

1. Open the app in a browser
2. Navigate to the login page
3. Trigger a password reset email for a test account
4. Open the email — verify it is in Spanish and contains a valid reset link
5. Click the link — verify it opens `/{locale}/auth/reset-password` with no 404
6. Enter a new password in both fields and submit
7. Verify success message appears
8. Sign in with the new password — verify it works

- [ ] Reset email received and is in Spanish
- [ ] Reset link opens `/auth/reset-password` (not 404)
- [ ] Password updated successfully
- [ ] New password works for sign-in

### 6c. Stripe Checkout — Credits Appear After Payment

1. Sign in as a test user with 0 credits
2. Navigate to the credits page
3. Select a credit package and complete checkout (use a Stripe test card if on test mode, or a real card if on live)
4. After redirect back to the app, verify credit balance updated

- [ ] Checkout flow completes without error
- [ ] Credits appear in the user's balance after payment
- [ ] No error toast shown during checkout

### 6d. Download — Video File Received

1. Navigate to video history with a completed video
2. Click the download button
3. Verify a `.mp4` file is downloaded to the browser

- [ ] Download button initiates file download
- [ ] Downloaded file is a valid `.mp4`

---

## Section 7: Pre-Launch Final Checklist

Before announcing to users, confirm ALL of the following:

- [ ] `KLING_WEBHOOK_SKIP_VERIFICATION` is NOT set in Vercel production
- [ ] `NEXT_PUBLIC_APP_URL` is set to the live domain (not localhost)
- [ ] Stripe webhook is in live mode with `checkout.session.completed`
- [ ] All four Supabase tables have `rowsecurity = true`
- [ ] `deduct_credits_and_create_video` RPC exists
- [ ] Video proxy smoke test: 302 redirect confirmed
- [ ] Password reset smoke test: email received, form works, new password valid
- [ ] Download smoke test: `.mp4` received
- [ ] Stripe checkout smoke test: credits updated

**All boxes checked? You are ready to launch.**

---

*Runbook version: 1.0 — Phase 3 (Security, Storage & Launch)*
*Generated: 2026-04-25*
