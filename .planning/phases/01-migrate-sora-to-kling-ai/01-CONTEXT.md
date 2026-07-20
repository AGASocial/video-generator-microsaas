# Phase 1: Provider Migration - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace OpenAI Sora with Kling AI as the video generation provider. This phase covers:
- Swapping the generation API call (Sora → Kling)
- Rebuilding the webhook handler for Kling's signature scheme, with idempotency and replay protection
- Updating model/tier names in products.ts and the generate route
- Surfacing Kling API errors to users in Spanish and English

Out of scope: UI redesign, credit repricing, changes to Supabase schema beyond what idempotency requires, Phase 2's `processed_webhook_events` table.

</domain>

<decisions>
## Implementation Decisions

### Model Tier Mapping
- **D-01:** Keep 3 tiers — map directly from Sora to Kling models:
  - sora-2 → `kling-v1` (1 credit — Standard)
  - sora-2-pro → `kling-v1-5` (3 credits — Pro)
  - sora-2-pro-HD → `kling-v2` (3 credits — Pro HD)
- **D-02:** Do NOT reprice credits in Phase 1. Keep costs at 1/3/3. Repricing is deferred until Kling production costs are confirmed.

### Claude's Discretion
- **Idempotency approach:** Use a lightweight mechanism for Phase 1 — a `processed` flag or unique constraint on `video_history.job_id` to prevent double-processing Kling completion events. Do NOT build the full `processed_webhook_events` table yet — that's Phase 2's scope. The goal is "don't process the same Kling event twice" with minimal schema changes.
- **Polling fallback:** Remove the Sora polling fallback (`pollVideoStatus`). Kling's webhook is the sole completion path in Phase 1. If Kling's webhook proves unreliable in production, polling can be added back later. Removing it simplifies the code and avoids the complexity of maintaining two completion paths.
- **Error message i18n:** Add new i18n message keys for Kling-specific errors (rate limit, content policy violation, model unavailable) in `messages/es.json` and `messages/en.json`. Reuse the existing error display UI — only add new message strings. Keys should be namespaced under `errors.kling.*`.
- **Kling API client:** Use native `fetch` (same pattern as the current Sora integration) — no SDK unless Kling's official SDK is more mature than native fetch at implementation time.
- **Webhook signature scheme:** Implement Kling's actual signature/header format per their docs. The current verification logic structure (read raw body, HMAC-SHA256, timing-safe compare) is solid — adapt it for Kling's header names and signing format, not OpenAI's.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Implementation (files to replace/modify)
- `app/api/generate/route.ts` — Current Sora generation call; this is the file to update for Kling
- `app/api/webhook/video-complete/route.ts` — Current OpenAI webhook handler; full rewrite for Kling
- `lib/video-storage.ts` — Downloads video from OpenAI, stores in Supabase; adapt download URL for Kling
- `lib/products.ts` — Sora model names and credit costs; update model name constants

### Schema & Data
- `scripts/001_create_tables.sql` — Base schema; `video_history.job_id` stores the external video ID (Kling job ID replaces Sora video ID)
- `app/api/webhook/stripe/route.ts` — Reference for idempotency pattern (uses `transactions.stripe_session_id` uniqueness check); follow this pattern for Kling webhook idempotency

### i18n
- `messages/es.json` — Add new `errors.kling.*` keys here (Spanish, primary locale)
- `messages/en.json` — Add matching keys here (English, secondary locale)

### Environment Config Reference
- `.env.dev` — Current env var structure; new Kling vars (`KLING_API_KEY`, `KLING_WEBHOOK_SECRET`) follow the same pattern as `OPENAI_API_KEY` / `OPENAI_WEBHOOK_SECRET`
- `app/api/webhook/video-complete/route.ts` — `OPENAI_WEBHOOK_SKIP_VERIFICATION` pattern; replicate as `KLING_WEBHOOK_SKIP_VERIFICATION` for dev convenience

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `verifyOpenAIWebhookSignature()` in `app/api/webhook/video-complete/route.ts` — The HMAC-SHA256 + timing-safe compare logic is correct and reusable. Adapt header names and signing payload format for Kling's scheme.
- `downloadAndStoreVideoFromOpenAI()` in `lib/video-storage.ts` — The Supabase Storage upload logic is reusable. Only the "download from provider" step changes (Kling URL/auth instead of OpenAI).
- Stripe idempotency check in `app/api/webhook/stripe/route.ts` — Uses `transactions.stripe_session_id` unique constraint + select-before-insert. This is the exact pattern to replicate for Kling event deduplication.

### Established Patterns
- Native `fetch` for external API calls (no SDK) — match this in Kling generate call
- `console.log("[ContextTag]")` logging prefix — use `[Kling]` and `[KlingWebhook]`
- Raw body parsing (`request.text()`) on webhook route — keep this, required for HMAC integrity
- `export const runtime = "nodejs"` on webhook route — keep this

### Integration Points
- `lib/products.ts` `CREDIT_COSTS` and model name constants — update string values only, structure stays the same
- `video_history.job_id` field stores external video ID — will store Kling job ID instead of Sora video ID
- `video_history.status` field values (`processing`, `completed`, `failed`) — map Kling event types to these same strings

</code_context>

<specifics>
## Specific Ideas

- The existing webhook handler has verbose debug logging that was added during Sora debugging. Keep the logging level but clean up the redundant/debug-only console.logs — use `[KlingWebhook]` prefix and log essential info (event type, video ID, error message) as required by ERR-03.
- Kling's API endpoint and base URL should be configurable via env var (`KLING_API_URL`) the same way `OPENAI_API_URL` is, for future flexibility.

</specifics>

<deferred>
## Deferred Ideas

- Credit repricing — defer until Kling production costs confirmed (post Phase 1)
- `processed_webhook_events` table — Phase 2 scope; Phase 1 uses lightweight deduplication only
- Polling fallback for Kling — removed in Phase 1; re-evaluate if webhook proves unreliable in production
- Additional Kling model tiers — Kling may add new models; add them in a future phase once the migration is stable

</deferred>

---

*Phase: 01-migrate-sora-to-kling-ai*
*Context gathered: 2026-04-21*
