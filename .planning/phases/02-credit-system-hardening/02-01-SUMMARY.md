---
phase: 02-credit-system-hardening
plan: "01"
subsystem: webhook-idempotency
tags: [webhooks, idempotency, stripe, kling, security, supabase]
dependency_graph:
  requires: []
  provides: [processed_webhook_events-dedup, kling-service-role-fix]
  affects: [app/api/webhook/stripe/route.ts, app/api/webhook/video-complete/route.ts]
tech_stack:
  added: []
  patterns: [select-before-insert idempotency, service role client in webhook context]
key_files:
  created:
    - scripts/010_create_processed_webhook_events.sql
  modified:
    - app/api/webhook/stripe/route.ts
    - app/api/webhook/video-complete/route.ts
decisions:
  - D-01: processed_webhook_events table with UNIQUE(provider, event_id, event_type) as provider-agnostic dedup layer
  - D-03: INSERT into processed_webhook_events is the LAST write in both handlers (insert-last pattern)
  - D-04: Existing video_transactions idempotency check preserved as defense-in-depth (not removed)
metrics:
  duration: ~30min
  completed: 2026-04-25
  tasks_completed: 4
  files_changed: 3
---

# Phase 02 Plan 01: Webhook Idempotency — processed_webhook_events dedup guard Summary

Provider-agnostic webhook idempotency via processed_webhook_events table with UNIQUE(provider, event_id, event_type), plus service role client fix for Kling webhook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SQL migration 010 | 13c65ee | scripts/010_create_processed_webhook_events.sql |
| 2 | Apply migration (checkpoint) | n/a (human action) | Supabase dashboard |
| 3 | Stripe webhook dedup guard | 608fc65 | app/api/webhook/stripe/route.ts |
| 4 | Kling webhook service role + dedup guard | 58c5626 | app/api/webhook/video-complete/route.ts |

## What Was Built

**scripts/010_create_processed_webhook_events.sql** — Migration creating the `processed_webhook_events` table with `UNIQUE(provider, event_id, event_type)` constraint and RLS enabled, plus `ADD COLUMN IF NOT EXISTS credit_cost integer` on `video_history`.

**app/api/webhook/stripe/route.ts** — Added two points:
1. SELECT dedup check against `processed_webhook_events` (provider=stripe, event_id=event.id, event_type=event.type) before processing. Returns 200 immediately if already processed.
2. INSERT into `processed_webhook_events` after transaction insert succeeds (insert-last pattern — prevents permanent dedup on side-effect failure).
Existing `video_transactions` idempotency check preserved as defense-in-depth.

**app/api/webhook/video-complete/route.ts** — Three changes:
1. Replaced `await createClient()` (user-session) with service role client using `SUPABASE_SERVICE_ROLE_KEY` — fixes RLS bypass failure in webhook context (no user session exists).
2. Added `credit_cost` to `video_history` SELECT for future refund use (Plan 02-02).
3. Added SELECT dedup check against `processed_webhook_events` (provider=kling) before terminal-state handling. Added INSERT after failed branch completes. Added INSERT after succeed branch completes.

## Deviations from Plan

None — plan executed exactly as written. The succeed-path dedup insert was placed after the `if (taskStatus === "succeed")` block (outside it, guarded by a conditional) rather than inside the try block before the final return, which is functionally equivalent and avoids code duplication with the failed path.

## Known Stubs

None — no placeholder or hardcoded empty values introduced.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Existing webhook routes hardened.

## Self-Check: PASSED

- scripts/010_create_processed_webhook_events.sql: confirmed exists (committed 13c65ee)
- app/api/webhook/stripe/route.ts: 3+ references to processed_webhook_events confirmed
- app/api/webhook/video-complete/route.ts: createClient removed, createServiceClient present, 4 references to processed_webhook_events confirmed
- TypeScript: no errors in stripe/route or video-complete/route
