# Phase 3: Security, Storage & Launch — Research

**Researched:** 2026-04-25
**Domain:** Pre-deploy hardening — RLS, env vars, video proxy, download, password reset, Stripe errors
**Confidence:** HIGH (all findings from direct codebase audit)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Primary output is a markdown runbook (`.planning/phases/03-security-storage-launch/PRE-DEPLOY-RUNBOOK.md`) — no automated scripts needed.
- **D-02:** Deploying to Vercel. Env var instructions reference Vercel dashboard and `vercel env` CLI.
- **D-03:** User confirmed feature work is already implemented. Gap is a structured pre-deploy checklist, not new code.
- **D-04:** Runbook must cover: production env vars, RLS isolation, video proxy smoke test, download button smoke test, password reset flow, Stripe checkout error path.

### Claude's Discretion
- If any checklist item reveals a missing implementation, include the fix as a task before the runbook step that validates it.
- RLS verification: Supabase dashboard Table Editor or SQL query — no test harness required unless policies are missing.
- Stripe error surface: if no checkout error handler exists, add a minimal toast/redirect with a generic user-facing message (no internal details).

### Deferred Ideas (OUT OF SCOPE)
- None declared.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Production env vars fully configured | `.env.dev` audit shows 9 vars required; `NEXT_PUBLIC_APP_URL` found in codebase but absent from `.env.dev` — gap identified |
| INFRA-02 | Supabase RLS verified in production | RLS enabled on all 4 tables in migration scripts; `video_processed_webhook_events` has RLS enabled but zero user-facing policies (service role only — correct) |
| VID-03 | Video download button | Download button exists in `components/video-list.tsx`; fetches `video.video_url` directly (Supabase public URL) — works without proxy |
| VID-04 | Video proxy confirmed working in production | Proxy at `app/api/video/[videoId]/content/route.ts` still calls OpenAI API — BROKEN; must be rewritten to serve from Supabase Storage |
| AUTH-03 | Password reset email in Spanish | No password reset page exists in `app/[locale]/auth/`; `messages/es.json` has no reset-password keys — TWO gaps |
| ERR-02 | Stripe Checkout errors surfaced to user | `components/credit-packages.tsx` already uses toast on error — IMPLEMENTED; error message is generic and safe |
</phase_requirements>

---

## Research Complete

All six success criteria have been audited against the live codebase. The overall status is:

- **3 items are fully implemented** (download button, RLS policies, Stripe error surface)
- **1 item has a critical code bug** (video proxy still calls OpenAI)
- **1 item has a missing env var** (NEXT_PUBLIC_APP_URL not in .env.dev; needed for Kling webhook callback URL)
- **1 item has two missing pieces** (no password reset page, no Spanish i18n keys for reset flow)

The primary output of this phase is a PRE-DEPLOY-RUNBOOK.md. The code fixes required are small but must happen before the runbook steps that validate them.

---

## Current State Assessment

### SC-1: All production env vars set (INFRA-01)
**Status: PARTIAL — one env var gap found**

`.env.dev` contains:
- `NEXT_PUBLIC_SUPABASE_URL` — present
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — present
- `SUPABASE_SERVICE_ROLE_KEY` — present
- `STRIPE_SECRET_KEY` (test) — present; production needs live key
- `STRIPE_WEBHOOK_SECRET` — present; production needs live webhook secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test) — present; production needs live key
- `KLING_ACCESS_KEY` — present
- `KLING_SECRET_KEY` — present
- `KLING_WEBHOOK_SECRET` — present
- `KLING_API_URL` — present
- `KLING_WEBHOOK_SKIP_VERIFICATION=true` — present; **must be removed or set to `false` in production**

**Gap found:** `NEXT_PUBLIC_APP_URL` is referenced in `app/api/generate/route.ts` (Kling callback URL) and `lib/api-client.ts` but is NOT in `.env.dev`. This is a silent failure — the Kling webhook callback URL will be wrong or empty in production.

**Also noted:** `OPENAI_API_KEY` and `OPENAI_WEBHOOK_SECRET` are in `.env.dev` but are unused post-Phase-1. They should NOT be set in production (no reason to expose them).

### SC-2: RLS isolation on all tables (INFRA-02)
**Status: IMPLEMENTED (pending production verification)**

RLS is enabled and policies exist per migration scripts:

| Table | RLS Enabled | Policies |
|-------|-------------|----------|
| `public.video_users` | Yes (script 001) | select/insert/update own row (`auth.uid() = id`) |
| `public.video_history` | Yes (script 001) | select/insert/update/delete own rows (`auth.uid() = user_id`) |
| `public.video_transactions` | Yes (script 001) | select/insert own rows (`auth.uid() = user_id`) |
| `public.video_processed_webhook_events` | Yes (script 010) | No user-facing policies — service role only (correct for an audit table) |

Script 005 adds a duplicate `users_insert_own` policy on `video_users` — this is harmless (Supabase ignores duplicate policy names) but should be noted.

**What's needed:** Confirm these migrations were actually applied in production via Supabase dashboard. The scripts exist in git but there is no migration runner — they are applied manually.

### SC-3: Video proxy returns correct video (VID-04)
**Status: BROKEN — requires code fix**

`app/api/video/[videoId]/content/route.ts` currently:
1. Fetches `video.job_id` from `video_history`
2. Calls `https://api.openai.com/v1/videos/${video.job_id}/content` with `OPENAI_API_KEY`

After Phase 1 migration to Kling AI:
- `video_url` in `video_history` is a **Supabase Storage public URL** (format: `https://<project>.supabase.co/storage/v1/object/public/videos/<userId>/<videoId>.mp4`)
- The proxy should read `video.video_url` and redirect or proxy from Supabase Storage instead

**The storage bucket `videos` is configured as public** (script 006), so the correct approach for the proxy is a simple redirect to the Supabase Storage URL. This avoids streaming costs and latency through the Vercel edge.

**Note on `video.job_id`:** The proxy currently selects `job_id` from `video_history`. After Phase 1, `job_id` holds the Kling task ID (not a URL). The proxy needs to select `video_url` instead.

### SC-4: Download button works (VID-03)
**Status: IMPLEMENTED**

`components/video-list.tsx` has a full download implementation:
- Shows download button when `video.video_url` is set
- Fetches `video.video_url` directly (the Supabase public URL)
- Creates a blob URL and triggers `<a download>` click
- Shows loading spinner with `downloading` i18n key during fetch
- Shows `alert()` on error (acceptable for MVP but could use toast)

Since the `videos` bucket is public, this fetch works without auth headers. No changes needed.

### SC-5: Password reset sends Spanish email (AUTH-03)
**Status: MISSING — two gaps**

**Gap 1 — No password reset page:**
`app/[locale]/auth/` only has: `callback/`, `error/`, `login/`, `sign-up/`. There is no `reset-password/` or `forgot-password/` route. A user who clicks a password reset email link has nowhere to land to set a new password.

**Gap 2 — No i18n keys for password reset:**
`messages/es.json` `auth` section has no keys for: `resetPassword`, `forgotPassword`, `sendResetLink`, `newPassword`, `passwordUpdated`, etc.

**Supabase email template approach:**
Supabase Auth supports custom email templates in the dashboard (Authentication > Email Templates). The "Reset Password" template can be edited directly with Spanish content. This is a dashboard operation, not a code change. The redirect URL in the template must point to the app's password reset page.

**What's needed:**
1. Create `app/[locale]/auth/reset-password/page.tsx` — handles the Supabase auth callback for password reset (`supabase.auth.updateUser({ password })`)
2. Add Spanish/English i18n keys for the reset password UI
3. Configure Supabase dashboard email template with Spanish content and correct redirect URL

### SC-6: Stripe Checkout errors surfaced (ERR-02)
**Status: IMPLEMENTED**

`components/credit-packages.tsx` `handlePurchase()`:
- Wraps the entire checkout flow in try/catch
- Shows a destructive toast with `t('purchaseFailed')` as title
- Uses `error.message` as description — this could leak internal details if the server error message is verbose, but `app/api/checkout/payment-link/route.ts` returns `{ error: "Failed to create checkout session" }` (generic) on catch
- `loadingPackage` is reset to `null` on error so the button is re-enabled

The error surface is safe — the server returns a generic message and the client shows it via toast. No Stripe internals are exposed to the user.

**Minor issue:** `components/credit-packages.tsx` references a `handlePurchase` function defined *after* the return statement (hoisting via function declaration works in JS, but it's an unusual pattern). No functional issue.

---

## Code Fixes Required

### Fix 1: Rewrite video proxy route (VID-04) — BLOCKING

**File:** `app/api/video/[videoId]/content/route.ts`

**Current behavior:** Calls `https://api.openai.com/v1/videos/${video.job_id}/content` — broken for Kling-generated videos.

**Required behavior:** Read `video_url` from `video_history` and redirect to the Supabase Storage URL.

**Approach:** Since the `videos` bucket is public, the proxy should issue a `302 redirect` to the Supabase Storage URL. This is simpler and cheaper than streaming through the proxy. The auth check (user owns the video) still runs server-side before the redirect is issued.

**Change:**
- In the DB select, change `"job_id, user_id, status"` → `"video_url, user_id, status"`
- Replace the OpenAI fetch block with: `return NextResponse.redirect(video.video_url, { status: 302 })`
- Update the guard: check `!video.video_url` instead of `!video.job_id`
- Remove the `OPENAI_API_KEY` dependency

**File:** `app/api/video/[videoId]/content/route.ts`

```typescript
// Replace the OpenAI fetch section with:
if (!video.video_url) {
  return NextResponse.json(
    { error: "Video URL not found" },
    { status: 400 }
  );
}

return NextResponse.redirect(video.video_url, { status: 302 });
```

### Fix 2: Create password reset page (AUTH-03) — BLOCKING

**File to create:** `app/[locale]/auth/reset-password/page.tsx`

The page must:
1. Accept the Supabase recovery token from the URL (Supabase appends `#access_token=...&type=recovery` or uses PKCE flow via query params)
2. Call `supabase.auth.updateUser({ password: newPassword })` on form submit
3. Redirect to login or dashboard on success
4. Show error on failure

**Pattern to follow:** Match the style of `app/[locale]/auth/login/page.tsx` — Card layout, i18n keys, `createClient()` from `@/lib/supabase/client`.

**i18n keys to add to `messages/es.json` and `messages/en.json`** under `auth`:
- `resetPasswordTitle`
- `resetPasswordDesc`
- `newPassword`
- `confirmNewPassword`
- `updatePassword`
- `updatingPassword`
- `passwordUpdated`
- `passwordUpdatedDesc`
- `resetPasswordFailed`
- `forgotPassword` (optional — for login page link)

### Fix 3: Add NEXT_PUBLIC_APP_URL to env documentation (INFRA-01)

**Not a code change** — this env var is already read in the codebase. It must be added to the production Vercel env vars and documented in the runbook.

**Value in production:** `https://your-production-domain.com` (the Vercel deployment URL)

**Why it matters:** `app/api/generate/route.ts` uses `NEXT_PUBLIC_APP_URL` to build the Kling webhook callback URL. If missing, the callback URL falls back to `http://localhost:3000` — Kling webhooks will be delivered to localhost and video completions will never be received.

---

## Runbook Items (verification steps, no code changes)

These are the items the PRE-DEPLOY-RUNBOOK.md should cover as checklist steps:

**R-01: Env vars** — Set all production env vars in Vercel dashboard:
- Replace all `sk_test_*` / `pk_test_*` Stripe keys with live equivalents
- Generate and set production `STRIPE_WEBHOOK_SECRET` from Stripe dashboard (live mode webhook endpoint)
- Set `NEXT_PUBLIC_APP_URL` to the production Vercel URL
- Set `KLING_WEBHOOK_SKIP_VERIFICATION=false` (or remove it — default is `false`)
- Do NOT set `OPENAI_API_KEY` or `OPENAI_WEBHOOK_SECRET` in production

**R-02: RLS verification** — In Supabase dashboard, confirm:
- `video_users`: RLS enabled, 3 policies present (select/insert/update)
- `video_history`: RLS enabled, 4 policies present (select/insert/update/delete)
- `video_transactions`: RLS enabled, 2 policies present (select/insert)
- `video_processed_webhook_events`: RLS enabled, 0 user-facing policies (service role only — correct)

SQL smoke test to paste in Supabase SQL Editor:
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('video_users','video_history','video_transactions','video_processed_webhook_events');
```
All rows should have `rowsecurity = true`.

**R-03: Spanish email template** — In Supabase dashboard (Authentication > Email Templates > Reset Password):
- Set subject to Spanish
- Set body to Spanish with `{{ .ConfirmationURL }}` preserved
- Set redirect URL to `https://your-production-domain.com/es/auth/reset-password`

**R-04: Video proxy smoke test** — After deploy, visit a completed video in the app and verify it plays. Then visit `/api/video/<videoId>/content` directly — should redirect to Supabase Storage URL with 302.

**R-05: Download button smoke test** — Click the Download button on a completed video card and confirm the file saves to disk.

**R-06: Stripe live webhook endpoint** — Register the production webhook endpoint in Stripe dashboard (live mode): `https://your-production-domain.com/api/webhook/stripe`. Copy the signing secret to Vercel env.

**R-07: Kling webhook URL** — Confirm in Kling developer portal that the callback URL is set to `https://your-production-domain.com/api/webhook/video-complete` (not localhost).

---

## Risks and Blockers

### BLOCKER: Video proxy is broken
`app/api/video/[videoId]/content/route.ts` calls OpenAI. Any in-browser video playback that routes through this proxy (the `<video src>` in `video-list.tsx` uses `video.video_url` directly, not the proxy, so playback works) and the download button also uses `video_url` directly. The proxy is currently unused for serving video but VID-04 requires it to be confirmed working. Fix required before runbook validation step R-04.

### BLOCKER: Password reset page missing
No route exists at `app/[locale]/auth/reset-password/`. If a user clicks a Supabase password reset email, they land on a 404. Must be created before the runbook step validates AUTH-03.

### RISK: NEXT_PUBLIC_APP_URL absent from production
If this env var is not set in Vercel, Kling CDN webhook callbacks go to localhost. Video generations will appear stuck in "processing" forever. This is a silent failure with no error visible to the user. Must be confirmed set in production.

### RISK: KLING_WEBHOOK_SKIP_VERIFICATION=true in .env.dev
This is a development convenience. If accidentally propagated to production, Kling webhook signatures are not verified — any HTTP request to the webhook endpoint will be processed. Ensure this is NOT set in Vercel production env vars.

### RISK: Supabase migrations applied manually
There is no migration runner (no Supabase CLI config, no `supabase/migrations/` directory). Scripts in `/scripts/` are applied manually via the Supabase dashboard SQL Editor. The runbook must include a step to verify all 11 scripts have been applied, especially scripts 010 and 011 (added in Phase 2).

### LOW RISK: Download button uses `alert()` on error
`components/video-list.tsx` line 68 uses `alert('Failed to download video. Please try again.')` on download error. This is not the toast pattern used elsewhere. Not a blocker but worth replacing with toast for consistency. Out of scope per D-03 unless the user decides otherwise.

### LOW RISK: Duplicate policy in scripts 001 + 005
`scripts/005_add_users_insert_policy.sql` attempts to create a policy named `users_insert_own` that already exists in `scripts/001_create_tables.sql`. Supabase will error on the duplicate if both are applied. This is a non-issue if only one was applied. The runbook should confirm actual policy count in the dashboard.

---

## Sources

All findings are from direct codebase inspection — no external documentation was needed.

| File | Finding |
|------|---------|
| `app/api/video/[videoId]/content/route.ts` | [VERIFIED] Still calls OpenAI API |
| `lib/video-storage.ts` | [VERIFIED] Stores Supabase public URL in `video_url` |
| `components/video-list.tsx` | [VERIFIED] Download button present, uses `video.video_url` directly |
| `scripts/001_create_tables.sql` | [VERIFIED] RLS on video_users, video_history, video_transactions |
| `scripts/006_create_videos_bucket.sql` | [VERIFIED] `videos` bucket is public |
| `scripts/010_create_processed_webhook_events.sql` | [VERIFIED] RLS enabled, no user-facing policies |
| `.env.dev` | [VERIFIED] 11 vars present; NEXT_PUBLIC_APP_URL absent |
| `app/api/generate/route.ts` | [VERIFIED] Uses NEXT_PUBLIC_APP_URL for Kling callback URL |
| `components/credit-packages.tsx` | [VERIFIED] Toast error handler present |
| `app/[locale]/auth/` directory listing | [VERIFIED] No reset-password page |
| `messages/es.json` | [VERIFIED] No password reset i18n keys |

**Confidence:** HIGH — all claims verified by reading source files, not training knowledge.
