# Phase 2: Credit System Hardening - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Make credits atomic and idempotent across all payment and generation paths:
- Stripe webhook: replaying does not double-credit users
- Video generation: deduction and record creation are atomic (no partial state)
- Generation failure: always triggers credit refund (no credits stuck in "deducted" state)

In scope: webhook idempotency table, atomic RPC for generation, refund path validation, end-to-end testing of both paths
Out of scope: repricing, UI changes, new credit types, credit holds/reserves (keep current immediate-deduction model)

</domain>

<decisions>
## Implementation Decisions

### Webhook Idempotency
- **D-01:** Implement `processed_webhook_events` table to track all webhook processing
  - Schema: `(id, event_type, event_id, provider, user_id, processed_at, unique(provider, event_id, event_type))`
  - Covers both Stripe and Kling webhooks in a single, reusable pattern
  - Supports future webhook providers (n8n, etc.) with same mechanism
  - Every webhook checks this table first; if row exists, return 200 with no side effects
  - Provides permanent audit trail of processed events (useful for debugging in production)

### Generation Atomicity
- **D-02:** Use Supabase RPC (stored procedure) for credit deduction + video_history creation
  - Single transaction: if either operation fails, both roll back
  - Prevents partial state where credits are deducted but no video_history record exists
  - RPC should also validate credit balance to prevent overdraft
  - Called from `app/api/generate/route.ts` instead of current separate operations
  - Keeps refund logic simple: only one place to manage credit restoration

### Refund Timing
- **D-03:** Refund only when Kling webhook signals `task_status: "failed"`
  - Do NOT refund immediately on Kling API errors (429, 503, etc.)
  - API errors return error message to user; user sees "generation is processing"
  - Refund happens asynchronously when webhook confirms failure
  - Avoids double-refunding if both API call and webhook both fail
  - Trade-off: users may wait for refund, but credit consistency is guaranteed

### Stripe Webhook Refund Path
- **D-04:** Stripe webhook (`checkout.session.completed`) uses current direct-credit approach
  - Stripe idempotency: check `processed_webhook_events` table (D-01)
  - No changes to credit allocation logic in Stripe handler
  - Stripe is already protected by Phase 1's unique constraint pattern; D-01 adds redundant safety

### Credit Hold Model
- **D-05:** Keep current immediate-deduction model (no "reserved" state)
  - Credits deducted at generation time (before Kling API call)
  - No intermediate "held" or "reserved" state
  - On failure, refund happens via webhook callback (D-03)
  - Simpler than a hold system; tradeoff is users may see negative credit briefly before refund arrives
  - Acceptable given Kling's webhook reliability (Phase 1 verified)

### Refund Validation
- **D-06:** End-to-end test both refund paths:
  - Stripe path: webhook replay → no double-credit (via processed_webhook_events dedup)
  - Kling path: API failure → user refunded when webhook arrives
  - Must validate: "generation fails, refund is 100% guaranteed before next generation attempt"

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Implementation (files to modify)
- `app/api/generate/route.ts` — Replace separate credit deduction with RPC call
- `app/api/webhook/stripe/route.ts` — Add processed_webhook_events dedup check
- `app/api/webhook/video-complete/route.ts` — Ensure refund logic is triggered on `task_status: "failed"`
- `lib/video-storage.ts` — No changes; refund logic is in webhook handlers

### Schema & RPC
- `scripts/001_create_tables.sql` — Add `processed_webhook_events` table (new migration)
- Supabase RPC function location (TBD in planning): atomic deduction + insert + validation

### Idempotency Reference Pattern
- `app/api/webhook/stripe/route.ts` (lines 127-150) — Current pattern of checking for existing transaction before processing
  - Use this as the conceptual model for processed_webhook_events dedup check
  - Difference: processed_webhook_events is provider-agnostic, supports all webhook types

### Refund Validation
- `app/api/webhook/video-complete/route.ts` — Must guarantee refund happens when status is `failed`
- `app/api/generate/route.ts` — Must NOT refund on API errors (D-03)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Stripe idempotency check pattern (app/api/webhook/stripe/route.ts lines 127-150) — SELECT before INSERT + unique constraint
  - Adapt this pattern for processed_webhook_events dedup
- Current refund logic in app/api/generate/route.ts (lines 148-156) — already refunds on videoError
  - Reuse this pattern but move refund into webhook handler per D-03

### Established Patterns
- Service role client for webhook handlers (bypasses RLS, no user session)
- `console.log("[ContextTag]")` prefix for logging — use `[ProcessedEvents]` and `[AtomicDeduction]`
- Raw body parsing on webhook routes — keep this for signature verification
- Two separate update calls for rollback (refund) — consolidate into RPC per D-02

### Integration Points
- `users.credits` field — protected by RPC transaction in generation
- `video_history` table — created within RPC transaction (same atomic unit)
- `transactions` table — records Stripe allocations; processed_webhook_events is separate audit table

</code_context>

<specifics>
## Specific Ideas

- The RPC function should accept (user_id, creditCost) and return (videoEntry, error) to match current generate route expectations
- processed_webhook_events table should have a `created_at` DEFAULT NOW() for audit trail — don't rely on processed_at for sorting
- Consider adding an `error_message` field to processed_webhook_events for debugging failed webhook processing (optional, but useful)
- Kling webhook handler should log when refund is triggered (per Phase 1's ERR-03 requirement)

</specifics>

<deferred>
## Deferred Ideas

- Credit holds/reserves — investigated but user chose immediate-deduction model; can revisit if refund latency becomes UX issue
- Rate limiting per user/provider — processed_webhook_events enables this later, but not in Phase 2 scope
- Webhook retry logic — Phase 2 assumes Kling/Stripe webhooks retry on their side; explicit retry queue is future work
- Credit expiration/usage window — no time-based credit invalidation in Phase 2; can add in Phase 3 if needed

</deferred>

---

*Phase: 02-credit-system-hardening*
*Context gathered: 2026-04-22*
