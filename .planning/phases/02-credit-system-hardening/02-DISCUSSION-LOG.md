# Phase 2: Credit System Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 02-credit-system-hardening
**Areas discussed:** Idempotency, Atomicity, Refund Timing, Credit Hold Model

---

## Idempotency: Preventing Duplicate Webhook Processing

| Option | Description | Selected |
|--------|-------------|----------|
| Option A: `processed_webhook_events` table | New table with unique constraint on (provider, event_id, event_type). Clean audit trail, scales to multiple providers, reusable pattern | ✓ |
| Option B: Unique constraint on existing tables | Store event ID on transactions/video_history. Reuses existing schema, no new table, but doesn't scale to multiple providers | |

**User's choice:** Option A
**Rationale:** Supports multiple webhook providers (Stripe, Kling, n8n, etc.) with a single reusable pattern. Audit trail is valuable for debugging in production.

---

## Atomicity: Ensuring Credit Deduction + Video Record Stay in Sync

| Option | Description | Selected |
|--------|-------------|----------|
| Option A: Supabase RPC (stored procedure) | Single transaction that deducts credits + inserts video_history. Atomic: both succeed or both fail, no partial state | ✓ |
| Option B: Database triggers | Maintain consistency via triggers on users/video_history tables | |
| Option C: Application-level transaction pattern | Implement rollback logic in the generate route | |

**User's choice:** Option A
**Rationale:** RPC is the cleanest, most reliable way to guarantee atomicity at the database level. Supabase supports RPCs natively.

---

## Refund Timing: When Should Credits Be Restored After Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Option A: Immediately on API error | Refund as soon as Kling API call fails (429, 503, etc.) | |
| Option B: Only on webhook `failed` signal | Refund asynchronously when Kling webhook arrives with failure status | ✓ |
| Option C: Both paths | Refund on API error AND webhook failure (with dedup check to avoid double-refund) | |

**User's choice:** Option B
**Rationale:** Avoids double-refunding if both API and webhook fail. Users may wait for async refund, but credit consistency is guaranteed.

---

## Credit Hold Model: Should Credits Be Reserved Before Completion

| Option | Description | Selected |
|--------|-------------|----------|
| Option A: Immediate deduction, delayed refund | Credits deducted at generation time; refunded asynchronously on failure (current behavior) | ✓ |
| Option B: Credit hold/reserved state | Credits marked as "reserved" until webhook confirms success | |
| Option C: No change | Keep current pattern without modification | |

**User's choice:** Option A
**Rationale:** Keep current immediate-deduction model. Simpler than a hold system. Acceptable tradeoff: users may see negative credit briefly before async refund.

---

## Notes

- All four decisions are locked and do not require further discussion
- Phase 2 scope is tightly bounded: idempotency + atomicity + refund validation
- Phase 3 will handle RLS policies and other security/launch concerns
