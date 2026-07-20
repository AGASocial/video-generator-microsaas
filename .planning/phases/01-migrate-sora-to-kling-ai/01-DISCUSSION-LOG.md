# Phase 1: Provider Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 01-migrate-sora-to-kling-ai
**Areas discussed:** Model & credit mapping

---

## Model & Credit Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3 tiers, remap to Kling | Map sora-2→kling-v1, sora-2-pro→kling-v1-5, sora-2-pro-HD→kling-v2. Same credit costs (1/3/3). | ✓ |
| Simplify to 2 tiers | Standard (kling-v1) and Pro (kling-v2). Drop middle tier. | |
| Keep same UI labels, swap backend only | Users still see 'Standard / Pro / Pro HD' — only API call changes. | |

**User's choice:** Keep 3 tiers, remap to Kling

---

| Option | Description | Selected |
|--------|-------------|----------|
| kling-v1 / kling-v1-5 / kling-v2 | Maps 3 tiers to Kling's 3 model versions in ascending quality order. | ✓ |
| kling-v1 / kling-v2 / kling-v2 (different settings) | Use kling-v2 for both Pro tiers, differentiated by resolution/duration. | |
| I'll specify later — use kling-v1 for now | Ship with kling-v1 only for Phase 1. | |

**User's choice:** kling-v1 / kling-v1-5 / kling-v2

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 1/3/3 for now | Don't reprice in Phase 1. Reprice after Kling costs confirmed in production. | ✓ |
| Reprice to reflect Kling costs | Adjust credit costs to match Kling's actual pricing. | |
| You decide | Claude picks credit costs to maintain similar margin. | |

**User's choice:** Keep 1/3/3 for now
**Notes:** Kling is cheaper (~$0.14/video per STATE.md); repricing deferred until production costs confirmed.

---

## Claude's Discretion

- **Idempotency approach:** Lightweight deduplication using existing `video_history.job_id` uniqueness — not the full `processed_webhook_events` table (Phase 2 scope)
- **Polling fallback:** Removed — Kling webhook is the sole completion path in Phase 1
- **Error message i18n:** New `errors.kling.*` keys added to ES/EN message files; reuse existing error display UI
- **Kling API client:** Native fetch (consistent with Sora pattern)

## Deferred Ideas

- Credit repricing — post Phase 1 when Kling production costs are confirmed
- `processed_webhook_events` table — Phase 2 scope
