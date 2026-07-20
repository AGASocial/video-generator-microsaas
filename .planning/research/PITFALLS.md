# Pitfalls Research

**Domain:** AI video generation SaaS (pay-as-you-go, async generation, webhook-driven)
**Researched:** 2026-04-21
**Confidence:** HIGH (pitfalls derived directly from observed codebase problems and well-understood patterns in Stripe/OpenAI/Supabase/Vercel serverless stacks)

---

## Critical Pitfalls

### Pitfall 1: OpenAI Webhook Signature Verification Broken by Body Parsing

**What goes wrong:**
The OpenAI webhook for `video-complete` requires raw body bytes for HMAC-SHA256 signature verification. Next.js App Router automatically parses the request body as JSON before your route handler runs. Once parsed, the raw bytes are gone — signature verification fails silently or with cryptic errors. The team has already hit this (4 recent commits on this exact issue), including fallback hacks and a skip-verification escape hatch that must never reach production.

**Why it happens:**
Next.js default behavior is to parse JSON bodies. Developers configure `export const config = { api: { bodyParser: false } }` (Pages Router) or the equivalent App Router approach (`request.arrayBuffer()` / `request.text()` before any parsing) and forget that middleware or framework layers can still consume the stream first.

**How to avoid:**
- Use `await request.arrayBuffer()` or `await request.text()` as the **first** operation in the webhook route handler — before any other await or middleware touches the request.
- Store the raw bytes, compute HMAC against them, then parse JSON separately.
- Never introduce a `SKIP_WEBHOOK_VERIFICATION` environment variable that disables verification in any environment. If verification is broken in dev, fix it with a test harness or use `ngrok` + a real OpenAI test event — don't bypass it.
- Add an integration test that sends a correctly-signed webhook payload and asserts a 200 response, and a malformed-signature test that asserts 401.

**Warning signs:**
- Any env var named `SKIP_*_VERIFICATION` in the codebase
- Fallback code paths that try verification with two different key formats (prefixed vs unprefixed secret)
- Webhook route returning 200 even when signature header is absent
- Log lines like "falling back to unprefixed secret" in production

**Phase to address:**
Webhook stabilization phase (current active work) — must be fully resolved before scaling traffic.

---

### Pitfall 2: Non-Idempotent Credit Operations Causing Double-Deduct or Double-Refund

**What goes wrong:**
Credit deduction happens at generation start; refund happens on failure. If the webhook fires twice (OpenAI retries on non-2xx responses), or if a network timeout causes the client to retry, credits are deducted twice or refunded twice. With real money involved, this is a trust-destroying bug.

**Why it happens:**
Developers implement the happy path (deduct → generate → complete → store) but don't guard against re-entrant webhook delivery. OpenAI webhooks will retry on 4xx/5xx responses and on timeouts. Vercel serverless functions can time out and the client retries. Without idempotency keys, each delivery is treated as a new event.

**How to avoid:**
- Use the OpenAI event ID (from the webhook payload) as an idempotency key. On webhook receipt, insert into a `processed_webhook_events(event_id, processed_at)` table with a unique constraint. If the insert fails (duplicate), return 200 immediately without reprocessing.
- For generation initiation: store the OpenAI job ID immediately after API call returns; check for existing job ID before deducting credits on any retry path.
- Wrap credit deduction + generation initiation in a database transaction or use a Supabase RPC with optimistic locking.
- For Stripe webhooks: same pattern — Stripe sends `payment_intent.id` which is a stable idempotency key.

**Warning signs:**
- No `processed_webhook_events` table or equivalent idempotency log
- Credit operations are plain SQL `UPDATE` without `WHERE credits >= cost` guard
- Webhook handler does database writes without checking if the event was already processed
- Users reporting double charges or unexpected credit balances

**Phase to address:**
Credit system hardening phase — implement idempotency before any production load testing.

---

### Pitfall 3: Vercel Serverless Function Timeout on Long-Running Video Operations

**What goes wrong:**
Vercel Hobby/Pro plans cap serverless functions at 10s/60s respectively. Sora generation can take several minutes. If any route tries to poll or await completion synchronously, it will timeout and return an error to the user while the generation continues silently in the background — leaving credits deducted with no video delivered and no refund triggered.

**Why it happens:**
Developers used to traditional server architectures write `await generateVideo()` and expect it to complete. Serverless functions don't support long-running operations.

**How to avoid:**
- The current architecture (fire-and-forget via OpenAI async API + webhook callback) is correct. Never add synchronous polling to a Vercel route.
- The generation initiation route must: (1) submit the job to OpenAI, (2) store job ID + `status: pending` in DB, (3) return 202 Accepted to the client immediately.
- The webhook route (`/api/webhook/video-complete`) does the heavy lifting: download video, store in Supabase Storage, update status, credit adjustments.
- Set Vercel `maxDuration` in `vercel.json` for the webhook route to the maximum allowed for your plan (60s Pro, 800s Enterprise) — not the default 10s.

**Warning signs:**
- Any `await` on a generation result in an API route without a timeout guard
- No 202 response pattern — routes return 200 only after "completion"
- Vercel function logs showing frequent timeouts on generation routes
- Users seeing immediate errors instead of "generating..." state

**Phase to address:**
Async architecture validation — verify the fire-and-forget pattern end-to-end in production before launch.

---

### Pitfall 4: Supabase Storage URLs Expiring and Breaking Video Playback

**What goes wrong:**
Supabase Storage signed URLs expire (default 1 hour, configurable up to 1 week for private buckets). If video history stores the raw signed URL instead of a stable reference, videos become unplayable after expiration. Users returning to their history find broken video players.

**Why it happens:**
Developers test with freshly generated videos (always fresh URLs), never notice the expiration problem. The video plays fine in dev/testing because it was just uploaded.

**How to avoid:**
- Store only the Supabase storage **path** (`user_id/video_id.mp4`) in the database, never the signed URL.
- Serve videos through `/api/video/[videoId]/content` which generates a fresh signed URL on each request (or streams directly from storage with server-side auth). This is already the correct approach in the current architecture — verify it's implemented correctly and not accidentally storing raw URLs anywhere.
- Set signed URL TTL to match the expected playback session (1 hour is fine if generated per-request).

**Warning signs:**
- `video_url` column in the database contains `https://supabase.co/storage/...?token=...` URLs
- Video history works immediately after generation but breaks the next day
- No proxy route — direct Supabase storage URLs in the frontend

**Phase to address:**
Storage architecture review — verify at Phase 0 completion that only paths are stored.

---

### Pitfall 5: Stripe Embedded Checkout Session Race Condition

**What goes wrong:**
User clicks "buy credits," Stripe session is created, user completes payment, Stripe fires `checkout.session.completed` webhook. But if the webhook arrives before the session is created in your DB (race condition), or if the user refreshes the checkout page creating multiple sessions, credits get allocated twice or the webhook fails to find the session to update.

**Why it happens:**
Embedded checkout creates a Stripe session server-side, but the webhook arrives asynchronously. If the session ID isn't stored before the webhook fires (fast payments, or Stripe beating your own DB write), the webhook handler finds nothing to update.

**How to avoid:**
- Store the Stripe session ID in the database **synchronously** before returning the client secret to the frontend.
- The webhook handler should upsert on `stripe_session_id` with idempotency — if the session is already marked `completed`, return 200 without re-allocating credits.
- Add `WHERE status = 'pending'` guard on the credit allocation UPDATE so re-delivery can't double-allocate.
- Use Stripe's `metadata` field on the session to embed `user_id` and `credit_package_id` — don't rely on server state lookup alone.

**Warning signs:**
- Stripe webhook handler does a bare `INSERT` on credit transactions without idempotency check
- Session not stored in DB before client secret is returned
- Users reporting credits not appearing after payment (webhook arrived before session row existed)

**Phase to address:**
Payment reliability phase — test with Stripe webhook replay tool before going live.

---

### Pitfall 6: RLS Policies Missing or Misconfigured on Supabase Tables

**What goes wrong:**
Supabase Row Level Security must be enabled and correctly configured for every table. If RLS is disabled or policies are wrong, any authenticated user can read/write any other user's videos, credits, or transactions — a complete data breach.

**Why it happens:**
RLS is opt-in per table. Easy to enable on `profiles` but forget on `videos`, `transactions`, or `credit_balances`. The Supabase client used server-side with a service role key bypasses RLS entirely — if that client is accidentally used in client-facing code, all RLS is irrelevant.

**How to avoid:**
- Enable RLS on every table. No exceptions.
- Use `auth.uid()` in all RLS policies: `USING (user_id = auth.uid())`.
- The service role client (`SUPABASE_SERVICE_ROLE_KEY`) must only ever be used in server-side code (API routes, webhook handlers). Never expose it to the browser.
- Run `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false` — result should be empty.
- For webhook routes that run as service role (needed to update any user's video), double-check that the service key is only in environment variables and never returned to the client.

**Warning signs:**
- Any table in Supabase dashboard showing RLS = disabled
- `SUPABASE_SERVICE_ROLE_KEY` referenced in any client-side component
- Supabase client initialized with service role key outside of `/api/` routes
- Missing policies on `videos`, `transactions`, or `user_credits` tables

**Phase to address:**
Security audit phase — run RLS checklist before any production traffic.

---

### Pitfall 7: OpenAI Sora API Unavailability Stranding User Credits

**What goes wrong:**
User pays for credits. Sora API is unavailable (outage, rate limit, model deprecation). Generation fails. Credits are deducted but the refund path has a bug — user loses money with no video. Or worse: the refund fires but the generation also retried successfully, so user gets a video AND a refund.

**Why it happens:**
Error handling for external API failures is the last thing tested. Developers test the happy path, verify the sad path manually once, and ship. Under real conditions (transient errors, partial failures, OpenAI 529s), the refund logic has race conditions.

**How to avoid:**
- Implement the credit lifecycle as a state machine: `reserved → deducted → refunded`. Deduct on job submission (not on click). Only permanently deduct after webhook confirms `completed`. Refund on any terminal failure state.
- Store the OpenAI job ID immediately. If the API call fails before returning a job ID (network error), refund immediately — no job ID means no generation started.
- Add a dead-letter queue or cron job: videos stuck in `pending` for >15 minutes should trigger a check and potential refund.
- Test Sora API failure modes explicitly: 429 (rate limit), 500 (server error), timeout.

**Warning signs:**
- Credit deduction happens before OpenAI API call returns successfully
- No `job_id` stored in the database (can't check generation status later)
- No automated cleanup for videos stuck in `pending` state
- Refund logic lives only in the webhook handler (no fallback for webhook delivery failure)

**Phase to address:**
Credit reliability phase — implement and test the full credit state machine before launch.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip webhook signature verification via env var | Faster local dev | Security hole in production if var leaks or is accidentally set | Never — use ngrok + real test events instead |
| Store signed URLs instead of storage paths | No proxy route needed | Videos expire, broken history for paying users | Never |
| Single Supabase client (service role) for all operations | Simpler code | Bypasses RLS, any bug exposes all user data | Never in client-facing code |
| Synchronous generation polling in API route | Simpler UX code | Vercel timeout kills the request, credits deducted with no video | Never on Vercel |
| No idempotency on webhook handlers | Simpler handler code | Duplicate credit allocations on retry | Never — cheap to add, catastrophic to omit |
| Hardcoded locale without middleware validation | Faster routing setup | Users bypass locale → broken i18n, wrong locale served | Only in Phase 0 testing |
| `.env.dev` / `.env.prod` without schema validation | Easy to manage | Wrong key in wrong env, silent failures | Acceptable short-term — add Zod env validation before scale |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI Sora webhook | Parsing body before reading raw bytes | `await request.arrayBuffer()` first, then HMAC, then `JSON.parse()` |
| OpenAI Sora webhook | Using both prefixed (`whsec_`) and unprefixed secret formats as fallbacks | Determine correct format once, commit to it, remove the fallback |
| Stripe Embedded Checkout | Returning client secret before saving session ID to DB | Save session ID to DB synchronously, then return client secret |
| Stripe webhook | Not validating `stripe.webhooks.constructEvent()` | Always validate — Stripe provides the library function, use it |
| Supabase Storage | Serving video from frontend with direct signed URL | Proxy through `/api/video/[videoId]/content` — adds auth + stable URL |
| Supabase Auth | Using service role client in browser-accessible code | Service role key only in server-side route handlers, never in components |
| Next.js i18n | `next-intl` middleware not covering all route segments | Verify middleware matcher covers `/api/` routes that serve locale-specific content |
| Vercel deployment | Not setting `maxDuration` on webhook route | Add `export const maxDuration = 60` (or max for your plan) to webhook route file |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Video proxy route streams entire video into memory | Memory spike on large videos, cold start OOM | Stream from Supabase to response using `pipe()` / `ReadableStream` passthrough | At ~50MB videos or concurrent users |
| No DB index on `user_id` in `videos` table | Video history query slows with user history | Add `CREATE INDEX idx_videos_user_id ON videos(user_id)` | At ~500 videos per user |
| Polling video status from client every second | Supabase connection limit hit, battery drain on mobile | Use Supabase Realtime subscription for status updates instead of polling | At ~50 concurrent users |
| Supabase Storage download + re-upload in webhook handler | Webhook handler times out on large videos | Download with streaming, pipe directly to storage; or use server-side copy if within Supabase | Videos >50MB |
| Locale middleware running on every static asset request | Adds latency to font/image/css loads | Exclude `/_next/static`, `/_next/image`, `/favicon.ico` from middleware matcher | Immediately visible in dev tools |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Disabled webhook signature verification in any env | Attacker can fake video completions, trigger credit refunds for non-existent videos | Verify signatures always; use ngrok for local dev testing |
| Service role key exposed to client | Full database access for any attacker | Audit all `SUPABASE_SERVICE_ROLE_KEY` usages — must be server-only |
| RLS disabled on any user-data table | Cross-user data access | Enable RLS on all tables; run automated check in CI |
| Missing `WHERE user_id = auth.uid()` on video content proxy | User A can fetch User B's video by guessing video ID | Proxy route must verify ownership via DB lookup before streaming |
| Stripe webhook not validated with `stripe.webhooks.constructEvent()` | Fake payment events trigger credit allocation | Always validate; test with invalid signatures |
| OpenAI API key in client-side code | Key theft, unlimited API usage billed to you | API key only in server routes; use `OPENAI_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix) |
| Replay attack on OpenAI webhook (old event replayed) | Credits refunded or allocated again for old events | Verify webhook timestamp is within tolerance (±5min); store processed event IDs |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No generation progress indicator | Users think it's broken after 30 seconds, click again (wasting credits) | Show real-time status with Supabase Realtime; display "Generating... usually 2-5 minutes" |
| Showing "failed" without explaining why | Users don't know if they'll be refunded or if it's their fault | Show "Generation failed — credits refunded" with a clear CTA to try again |
| Credit balance not updating after payment without page refresh | Users think payment failed, contact support or try again | Use Supabase Realtime to push credit balance updates after Stripe webhook completes |
| No warning before credit-consuming action | Users accidentally submit expensive generations | Show credit cost + current balance before generation; confirm if cost > 50% of balance |
| Video history shows "processing" forever for stuck jobs | Users lose trust | Auto-timeout pending videos after 15 min with clear status and refund confirmation |
| Locale mismatch on error messages | Spanish users see English errors | All error messages must go through i18n; never hardcode English strings in API responses |

---

## "Looks Done But Isn't" Checklist

- [ ] **Webhook verification:** Verify the `SKIP_WEBHOOK_VERIFICATION` (or equivalent) env var is removed from production config and `.env.prod` — if it exists, verification is bypassed in prod
- [ ] **Credit idempotency:** Verify `processed_webhook_events` table exists and webhook handler checks it before processing — look for duplicate credit entries in production DB
- [ ] **RLS coverage:** Run `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false` — should return 0 rows
- [ ] **Video storage paths:** Verify `videos` table stores file paths, not signed URLs — check `SELECT video_url FROM videos LIMIT 5` and confirm no `?token=` in values
- [ ] **Stripe session idempotency:** Verify `checkout_sessions` table has unique constraint on Stripe session ID and webhook handler checks before allocating credits
- [ ] **Service role key scope:** Run `grep -r "SERVICE_ROLE_KEY" src/ app/ components/` — confirm zero results (server-only, in `/api/` or `/lib/server/` only)
- [ ] **Vercel maxDuration:** Verify webhook route exports `maxDuration` set to 60 (Pro) — default 10s will timeout on large video downloads
- [ ] **Dead-letter handling:** Verify a cron job or scheduled function checks for videos stuck in `pending` >15 minutes and triggers refund
- [ ] **OpenAI key prefix:** Verify `OPENAI_API_KEY` has no `NEXT_PUBLIC_` prefix — if it does, it's exposed to the browser bundle
- [ ] **Locale coverage:** Verify all API error responses return locale-aware messages, not hardcoded English strings

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Webhook verification bypassed in prod | HIGH | Immediately rotate OpenAI webhook secret; audit webhook delivery logs for suspicious events; re-enable verification; check for fraudulent credit adjustments |
| Double-deducted credits discovered | MEDIUM | Query duplicate events in `processed_webhook_events`; calculate affected users; issue manual credit corrections via admin function; add idempotency check |
| Stuck pending videos (no webhook received) | LOW | Add one-time cron query: `UPDATE videos SET status='failed' WHERE status='pending' AND created_at < NOW()-INTERVAL '15 minutes'`; trigger refund for each |
| RLS misconfiguration exposing user data | HIGH | Immediately enable RLS; revoke all existing sessions (`auth.signOut()` all users); audit access logs; notify affected users per GDPR/local requirements |
| Expired video URLs in history | LOW | Backfill: extract path from old signed URLs, store path; proxy route regenerates URLs on request |
| Wrong env vars in production (dev keys in prod) | MEDIUM | Rotate all affected keys immediately; audit Stripe test-mode transactions; re-run production webhook for any failed events |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Webhook signature broken | Current active work (webhook stabilization) | Integration test: valid signature → 200, invalid signature → 401 |
| Non-idempotent credit operations | Credit system hardening | Test: replay same webhook twice, verify credit balance unchanged on second delivery |
| Vercel function timeout | Async architecture validation | Load test: 10 concurrent generations, verify no timeout errors in Vercel logs |
| Storage URL expiration | Storage architecture review (Phase 0 closeout) | Check DB: no `?token=` in video_url column values |
| Stripe session race condition | Payment reliability phase | Test: Stripe webhook replay on completed session, verify no double-allocation |
| RLS misconfiguration | Security audit phase | Automated check: 0 tables with RLS disabled; cross-user access test returns 403 |
| Sora API unavailability stranding credits | Credit reliability phase | Test: mock Sora 500 error, verify credit refund triggered and no job ID stored |
| Stuck pending videos | Operational readiness phase | Verify cron job exists and fires correctly for >15min pending videos |

---

## Sources

- Project codebase: 4 recent commits on OpenAI webhook signature verification reveal this is an actively failing area (timestamp validation, replay attack prevention, fallback hacks)
- Vercel serverless limits: official Vercel documentation (10s Hobby, 60s Pro, 800s Enterprise maxDuration)
- Supabase RLS: Supabase official docs — RLS is opt-in per table, service role bypasses it
- Stripe Embedded Checkout: Stripe docs — session creation is synchronous, webhook delivery is async
- OpenAI Sora API: OpenAI platform docs — async generation model, webhook-based completion
- Known Next.js App Router pattern: raw body reading must precede any other stream consumption
- General SaaS credit system patterns: idempotency via event ID deduplication is industry standard

---
*Pitfalls research for: AI video generation SaaS (OpenAI Sora + Stripe + Supabase + Vercel)*
*Researched: 2026-04-21*
