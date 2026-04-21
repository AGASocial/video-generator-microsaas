# Codebase Concerns

**Analysis Date:** 2026-04-21

---

## CRITICAL: OpenAI Sora Deprecation

**Immediate shutdown risk — web access ends April 26 2026; API ends September 2026.**

- **Web access discontinued:** April 26, 2026 (5 days from analysis date)
- **API shutdown:** September 2026

**Scope of impact — every file that must change:**
- `app/api/generate/route.ts` — entire video generation call (POST to `https://api.openai.com/v1/videos`)
- `app/api/generate/route.ts` — background `pollVideoStatus()` function (GET `https://api.openai.com/v1/videos/{id}`)
- `app/api/webhook/video-complete/route.ts` — webhook event type (`video.completed`), signature verification, payload shape
- `app/api/video/[videoId]/content/route.ts` — proxy fetches `https://api.openai.com/v1/videos/{id}/content` directly
- `lib/video-storage.ts` — `downloadAndStoreVideoFromOpenAI()` constructs `https://api.openai.com/v1/videos/{soraVideoId}/content`
- `lib/products.ts` — model IDs (`sora-2`, `sora-2-pro`, `sora-2-pro-HD`) and credit cost comments
- `components/video-generator-form.tsx` — hardcoded model names `"sora-2"` and `"sora-2-pro"` in SelectItem labels and default state
- `.planning/STATE.md` — records Kling AI as chosen replacement (decision already made)

**Chosen replacement:** Kling AI (~$0.14/video, supports 2-min clips, stable production API). Migration is Phase 1, 0% complete.

**Fix approach:** Execute Phase 1 (plans 01-01 through 01-03) immediately. Replace all OpenAI Sora API calls, webhook event handling, and model identifiers with Kling AI equivalents.

---

## Tech Debt

**Dual polling architecture — server-side AND client-side polling run simultaneously:**
- Issue: `pollVideoStatus()` in `app/api/generate/route.ts` (lines 7–101) runs as a fire-and-forget background task on the server. `pollVideoStatus()` in `components/video-generator-form.tsx` (lines 362–410) also polls from the client every 3 seconds. Both update the same DB row, creating redundant writes and potential conflicts.
- Files: `app/api/generate/route.ts`, `components/video-generator-form.tsx`
- Impact: Doubled OpenAI API status requests; server-side poll runs for up to 5 minutes (60 attempts × 5s) per generation regardless of client activity; server-side poll has no cancellation mechanism.
- Fix approach: Pick one mechanism — keep client-side polling (simpler, user-session-scoped) OR the OpenAI webhook (preferred). Remove server-side polling entirely once webhook is verified working.

**`job_id` column repurposed to store Sora video ID:**
- Issue: Database column `job_id` in `video_history` was designed for job tracking but is being reused to store `sora_video_id`. This semantic mismatch will require a migration or renaming when switching to Kling AI.
- Files: `app/api/generate/route.ts` (line 341), `app/api/webhook/video-complete/route.ts` (line 278), `app/api/video/[videoId]/content/route.ts` (line 55), `scripts/004_add_job_id_column.sql`
- Impact: Schema is semantically incorrect. Any new developer assumes `job_id` means a queue job identifier, not a provider video ID.
- Fix approach: During Kling AI migration, rename column to `provider_video_id` or `external_job_id` in a SQL migration.

**Christmas theme is default for all new users — hardcoded in DB schema:**
- Issue: `scripts/009_update_default_theme_to_christmas.sql` sets `theme_preference DEFAULT 'christmas'`. The API route `app/api/user/theme/route.ts` (line 34) falls back to `"christmas"`. New users see a Christmas theme year-round.
- Files: `scripts/009_update_default_theme_to_christmas.sql`, `app/api/user/theme/route.ts`
- Impact: All new user signups get Christmas UI outside of December. Seasonal theme leaked into permanent default.
- Fix approach: Add migration to reset default to `'default'` and update the fallback in `app/api/user/theme/route.ts`.

**`select("*")` used in generate route for user fetch:**
- Issue: `app/api/generate/route.ts` (line 122) fetches `select("*")` on the `users` table when only `credits` is needed.
- Files: `app/api/generate/route.ts`
- Impact: Fetches all user columns including email, theme preference, timestamps — unnecessary data transfer on every generation request.
- Fix approach: Change to `select("credits")`.

**`getCreditCost()` silent fallback returns 1 for unknown models:**
- Issue: `lib/products.ts` (line 48) — `getCreditCost(model)` returns `1` for any unrecognized model string. If a Kling AI model identifier is passed before the function is updated, it silently charges 1 credit instead of erroring.
- Files: `lib/products.ts`
- Impact: Incorrect credit deduction for any unrecognized model; fails silently.
- Fix approach: Throw an error (or return a `null` that the caller explicitly handles) for unrecognized model strings.

**`VideoHistory.status` typed as `string`, not a union:**
- Issue: `lib/types.ts` (line 17) — `status: string` instead of `status: "processing" | "completed" | "failed"`. Code throughout the app does string comparisons against these values with no type safety.
- Files: `lib/types.ts`
- Impact: Typo in a status string (e.g., `"complete"` vs `"completed"`) would be a silent bug.
- Fix approach: Change to a union type or enum.

---

## Security Considerations

**Webhook signature bypass escape hatch present in production code:**
- Risk: `app/api/webhook/video-complete/route.ts` (line 156) reads `process.env.OPENAI_WEBHOOK_SKIP_VERIFICATION === "true"` and skips HMAC verification entirely if set. If this env var is accidentally set in production, any actor can POST to the webhook and trigger video completions or status updates.
- Files: `app/api/webhook/video-complete/route.ts`
- Current mitigation: Documented warning in code; skip only triggers if env var is explicitly set.
- Recommendations: Remove `OPENAI_WEBHOOK_SKIP_VERIFICATION` entirely from the codebase. Use `ngrok` or real test events for local development. The `SKIP_*` pattern is a security anti-pattern regardless of intent.

**Webhook secret format ambiguity — dual-format fallback:**
- Risk: `app/api/webhook/video-complete/route.ts` (lines 188–214) tries verification with the secret, then strips `whsec_` prefix and retries. This "try both formats" pattern masks misconfiguration and indicates the correct secret format was never confirmed.
- Files: `app/api/webhook/video-complete/route.ts`
- Current mitigation: None — both attempts could succeed or fail silently.
- Recommendations: Determine the correct format once during Kling AI migration, commit to it, remove the fallback. Log format-detection behavior is acceptable only in dev.

**Non-idempotent credit operations — race condition on double webhook delivery:**
- Risk: The Stripe webhook handler (`app/api/webhook/stripe/route.ts`) checks for existing transactions with `select("id").eq("stripe_session_id", ...)` then inserts separately. Between the check and the insert, a second delivery of the same webhook could pass the duplicate check and allocate credits twice.
- Files: `app/api/webhook/stripe/route.ts`
- Current mitigation: Duplicate check exists (lines 147–166) but is not atomic (check-then-act, not upsert-with-unique-constraint).
- Recommendations: Add a `UNIQUE` constraint on `transactions.stripe_session_id` at the DB level. Use an upsert (`INSERT ... ON CONFLICT DO NOTHING`) rather than a check-then-insert pattern.

**OpenAI webhook has no idempotency guard:**
- Risk: `app/api/webhook/video-complete/route.ts` does not check whether the event was already processed. If OpenAI retries delivery (on non-2xx or timeout), the video status could be updated twice and `downloadAndStoreVideoFromOpenAI` called multiple times.
- Files: `app/api/webhook/video-complete/route.ts`
- Current mitigation: `upsert: true` on storage upload prevents file duplication, but DB status update and download are not guarded.
- Recommendations: Store processed event IDs in a `processed_webhook_events` table with a unique constraint on `event_id`. Check before processing; return 200 immediately on duplicate.

**`STRIPE_WEBHOOK_SECRET` logged as empty string fallback:**
- Risk: `app/api/webhook/stripe/route.ts` (line 46) passes `process.env.STRIPE_WEBHOOK_SECRET || ""` to `stripe.webhooks.constructEvent()`. If the env var is missing, Stripe will reject with an empty-string secret error, but the error message in the response (line 61) includes `secretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET` — this leaks internal configuration state to the caller.
- Files: `app/api/webhook/stripe/route.ts`
- Current mitigation: None.
- Recommendations: Remove `secretConfigured` from the error response body. Return only `{ error: "Webhook signature verification failed" }`.

**All headers logged in webhook routes including potentially sensitive values:**
- Risk: Both webhook routes log all request headers (`allHeaders`) on every request. In production, this includes auth tokens, user agent details, and forwarded IPs in permanent server logs.
- Files: `app/api/webhook/video-complete/route.ts` (lines 124–133), `app/api/webhook/stripe/route.ts` (lines 27–32)
- Current mitigation: None.
- Recommendations: Remove full-header logging before going to production. Log only specific named headers needed for debugging.

---

## Performance Bottlenecks

**Video proxy streams entire file into memory before responding:**
- Problem: `app/api/video/[videoId]/content/route.ts` fetches the full video blob from OpenAI (`const videoBlob = await openaiResponse.blob()`), loads it into memory, then returns it as a response body. For videos that are 50–200MB, this causes memory spikes per concurrent request.
- Files: `app/api/video/[videoId]/content/route.ts`
- Cause: `await openaiResponse.blob()` buffers the entire response. No streaming passthrough.
- Improvement path: Replace with `ReadableStream` passthrough — pipe `openaiResponse.body` directly to the Next.js response body. After Kling AI migration, proxy will target Supabase Storage URLs, which support range requests and CDN delivery.

**Client-side credit polling on payment success uses 1-second intervals:**
- Problem: `components/payment-success-handler.tsx` (line 97) polls `/api/user/credits` every 1 second for up to 10 attempts after payment. At 10 concurrent users paying simultaneously, this generates 100 requests/10s to a serverless endpoint.
- Files: `components/payment-success-handler.tsx`
- Cause: Webhook delivery delay is indeterminate; polling is the only feedback mechanism.
- Improvement path: Use Supabase Realtime subscription on the `users` table row for the current user. Credit update triggers the subscription event; no polling required.

**Server-side polling runs for up to 5 minutes per generation:**
- Problem: `pollVideoStatus()` in `app/api/generate/route.ts` runs 60 iterations × 5-second delays = up to 300 seconds of continuous polling per video job. On Vercel, this function is fire-and-forget but consumes execution time billed against the plan limit.
- Files: `app/api/generate/route.ts`
- Cause: Background async function called with `.catch(console.error)` and no timeout or cancellation.
- Improvement path: Remove server-side polling entirely; rely on OpenAI webhook (`video-complete`) as the sole completion mechanism.

**No DB indexes confirmed on `user_id` foreign keys:**
- Problem: The SQL schema (`scripts/001_create_tables.sql`) creates foreign key references but no explicit indexes on `video_history.user_id` or `transactions.user_id`. PostgreSQL does not auto-create indexes on foreign key columns.
- Files: `scripts/001_create_tables.sql`
- Cause: Indexes not included in initial table definition.
- Improvement path: Add `CREATE INDEX idx_video_history_user_id ON video_history(user_id)` and `CREATE INDEX idx_transactions_user_id ON transactions(user_id)`.

---

## Fragile Areas

**Background polling in serverless (`fire-and-forget pollVideoStatus`):**
- Files: `app/api/generate/route.ts` (line 387)
- Why fragile: `pollVideoStatus(videoEntry.id, soraVideoId).catch(console.error)` is called without awaiting. On Vercel, the response is returned, and the function may be terminated before all 60 polling iterations complete — especially if the platform recycles the instance. No guarantee the background work finishes.
- Safe modification: Do not add any state-dependent logic to this function. The webhook handler is the authoritative completion path; server-side polling is only a fallback.
- Test coverage: None.

**`PaymentSuccessHandler` credit detection relies on DOM query selector:**
- Files: `components/payment-success-handler.tsx` (line 21)
- Why fragile: `document.querySelector('[data-credits]')` to read the initial credit count assumes a specific DOM element is present and correctly attributed. If the element is renamed, moved, or conditionally rendered, the payment success logic silently breaks — `initialCredits` stays `null` and credit update detection never triggers.
- Safe modification: Pass `userCredits` as a prop from the server component instead of reading from the DOM.
- Test coverage: None.

**Locale extraction from `referer` header:**
- Files: `app/api/checkout/payment-link/route.ts` (lines 38–51)
- Why fragile: Locale is extracted by regex-matching the `referer` URL path (`/^\/(en|es)(\/|$)/`). If the referer is missing, spoofed, blocked by a browser privacy setting, or the user navigates through a redirect, locale defaults to `routing.defaultLocale`. Payment success redirect would land in the wrong locale.
- Safe modification: Pass locale explicitly in the request body (`{ packageId, locale }`) from the client instead of inferring from referer.
- Test coverage: None.

**`ensureUserExists` creates users with 0 credits using service role:**
- Files: `app/actions/user.ts`
- Why fragile: This server action bypasses RLS using the service role key and silently creates a user record if the DB trigger (`scripts/002_create_user_trigger.sql`) did not fire. If the trigger is misconfigured or the service role key is missing, user creation fails silently and the calling code returns an error. There is no alerting or monitoring on trigger failure.
- Safe modification: Add explicit monitoring or error surfacing when `ensureUserExists` creates a record (indicates the trigger is broken and needs investigation).
- Test coverage: None.

**`getApiBaseUrl()` falls back to `http://localhost:3000` in production:**
- Files: `lib/api-client.ts` (line 38)
- Why fragile: If `NEXT_PUBLIC_APP_URL` is not set and request headers are unavailable (e.g., called from a non-request context), the API client silently sends server-side fetch calls to `http://localhost:3000`. In production, this would return connection-refused errors that surface as misleading "User not found" errors.
- Safe modification: Throw an explicit error if neither `NEXT_PUBLIC_APP_URL` nor request headers are available, rather than falling back to localhost.
- Test coverage: None.

---

## Scaling Limits

**Vercel serverless function timeout — no `maxDuration` configured:**
- Current capacity: Default Vercel function timeout is 10 seconds (Hobby) or 60 seconds (Pro).
- Limit: `app/api/webhook/video-complete/route.ts` must download a video from OpenAI and upload to Supabase Storage within the timeout. For large videos (50–200MB), this can easily exceed 10s on Hobby tier.
- Neither webhook route exports `maxDuration`. The `runtime = "nodejs"` is set but default timeout applies.
- Scaling path: Add `export const maxDuration = 60` to both webhook routes. For Enterprise plans, set to 800.

**No dead-letter handling for videos stuck in `processing`:**
- Current capacity: Videos that are `processing` with no webhook delivery remain in that state indefinitely.
- Limit: Any webhook delivery failure (Sora/Kling API error, network issue, Vercel timeout) leaves the video permanently stuck in `processing` with credits unreturned.
- Scaling path: Add a cron job (Vercel Cron or Supabase pg_cron) that queries `video_history WHERE status = 'processing' AND created_at < NOW() - INTERVAL '15 minutes'`, updates status to `'failed'`, and triggers a credit refund.

---

## Dependencies at Risk

**`react-snowfall` — seasonal dependency bundled year-round:**
- Risk: The `react-snowfall` package is a dependency that renders only when the Christmas theme is active. It's bundled into the client regardless of theme state, adding unnecessary JS weight for non-Christmas users.
- Impact: Bundle size inflation; the Christmas default theme (see Tech Debt above) means most users load this dependency every session.
- Migration plan: Lazy-load the `ChristmasSnowEffect` component with `dynamic(() => import(...), { ssr: false })` to avoid bundling unless the theme is active.

**`@stripe/react-stripe-js` and `@stripe/stripe-js` pinned to `latest`:**
- Risk: `package.json` lists both Stripe packages as `"latest"` with no version pin. A breaking Stripe SDK release would break the embedded checkout flow without any local version control.
- Impact: Any `npm install` in CI could pull a new major version that breaks the API.
- Migration plan: Pin to current installed versions (run `npm ls @stripe/react-stripe-js @stripe/stripe-js` to get actuals) and use `^` for minor/patch updates only.

**`@supabase/ssr` and `@supabase/supabase-js` pinned to `latest`:**
- Risk: Same issue as Stripe — both Supabase packages are `"latest"` in `package.json`. Supabase has had breaking SSR API changes between minor versions.
- Impact: CI breaks unpredictably on dependency install.
- Migration plan: Pin to current versions.

---

## Missing Critical Features

**No `maxDuration` export on webhook routes:**
- Problem: Both `app/api/webhook/video-complete/route.ts` and `app/api/webhook/stripe/route.ts` are missing `export const maxDuration = 60`. Without it, Vercel applies the default 10-second limit, which is insufficient for video download + Supabase upload operations.
- Blocks: Reliable video delivery for any video that takes >10 seconds to transfer.

**No idempotency table for OpenAI webhook events:**
- Problem: There is no `processed_webhook_events` table or equivalent guard. OpenAI (and Kling AI after migration) will retry webhook delivery on non-2xx responses. Each retry processes the event again.
- Blocks: STAT-04 requirement from `REQUIREMENTS.md` — "OpenAI webhook handler is idempotent."

**Password reset flow not implemented (AUTH-03):**
- Problem: `REQUIREMENTS.md` lists AUTH-03 ("User can reset password via email link with email content in Spanish") as pending. No route, page, or Supabase email template for password reset exists in the codebase.
- Blocks: Full auth flow for users who forget their password.

**Video download button not implemented (VID-03):**
- Problem: `REQUIREMENTS.md` lists VID-03 ("User can download a completed video") as pending. The generate form shows a download anchor tag only for the immediately-generated video, not for videos in history.
- Files: `components/video-generator-form.tsx` (line 677) — download link present post-generation, `components/video-list.tsx` — no download button on history items.
- Blocks: Users cannot download previously generated videos from their history.

---

## Test Coverage Gaps

**Zero automated tests exist in the codebase:**
- What's not tested: All API routes, webhook handlers, credit deduction logic, video storage, Stripe integration, authentication flows, and UI components.
- Files: Every file under `app/api/`, `lib/`, and `components/`.
- Risk: Any refactor (including the Kling AI migration) can silently break existing behavior. Webhook signature verification, idempotency, and credit atomicity bugs are invisible without tests.
- Priority: High — the Kling AI migration involves replacing core functionality with no regression safety net.

**Webhook signature verification has no integration test:**
- What's not tested: A correctly-signed webhook payload returning 200; a tampered payload returning 401; an expired timestamp returning 401.
- Files: `app/api/webhook/video-complete/route.ts`, `app/api/webhook/stripe/route.ts`
- Risk: The 4 recent commits on webhook verification indicate this area has already broken multiple times. Without a test, it will break again silently.
- Priority: High — directly tied to security requirement STAT-03.

**Credit deduction atomicity has no test:**
- What's not tested: Concurrent generation submissions with the same user; refund triggered after API failure; credits not double-deducted on retry.
- Files: `app/api/generate/route.ts`
- Risk: Real money. Double-deduct or failed refund directly impacts user trust and revenue.
- Priority: High — tied to CRED-04 and CRED-05.

---

## Excessive Debug Logging

**201 `console.log`/`console.error`/`console.warn` calls in API routes alone:**
- Issue: Both webhook routes log every request header, all signature comparison values, payload previews, and internal state. This level of verbosity is appropriate for debugging but not for production.
- Files: `app/api/webhook/stripe/route.ts`, `app/api/webhook/video-complete/route.ts`, `app/api/generate/route.ts`
- Impact: Production log costs on Vercel; sensitive data (partial secrets, user emails, session IDs) written to log storage; performance overhead per request.
- Fix approach: Replace debug `console.log` with structured logging at appropriate levels. Remove emoji log markers (`✅`, `❌`, `⚠️`) from server code.

---

*Concerns audit: 2026-04-21*
