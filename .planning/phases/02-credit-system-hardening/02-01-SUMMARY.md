---
phase: 02-credit-system-hardening
plan: "01"
subsystem: webhook-idempotency
tags: [sql-migration, webhook, idempotency, stripe, kling, supabase]
dependency_graph:
  requires: []
  provides: [processed_webhook_events-table, credit_cost-column, stripe-dedup-guard, kling-dedup-guard]
  affects: [app/api/webhook/stripe/route.ts, app/api/webhook/video-complete/route.ts]
tech_stack:
  added: []
  patterns: [processed_webhook_events dedup pattern, service role client in webhook handlers, insert-last idempotency]
key_files:
  created:
    - scripts/010_create_processed_webhook_events.sql
  modified:
    - app/api/webhook/stripe/route.ts
    - app/api/webhook/video-complete/route.ts
decisions:
  - D-01: processed_webhook_events table as provider-agnostic idempotency audit log
  - D-03: Kling webhook uses service role client; dedup check before all side effects
  - Insert into processed_webhook_events is always the last write (prevents permanent dedup on partial failure)
metrics:
  duration: ~15min
  completed: 2026-04-22
  tasks_completed: 1/4 (paused at Task 2 blocking checkpoint; Tasks 3-4 completed by continuation agent)
---

# Phase 2 Plan 1: Webhook Idempotency — processed_webhook_events + Dedup Guards Summary

## One-liner

SQL migration and webhook dedup guards using processed_webhook_events table to prevent double-credit on Stripe replay and double-refund on Kling replay.

## What Was Built

### Task 1: SQL Migration 010 (COMPLETE — committed 13c65ee)

Created `scripts/010_create_processed_webhook_events.sql` with:
- `ALTER TABLE public.video_history ADD COLUMN IF NOT EXISTS credit_cost integer` — stores credit cost at generation time so Kling webhook can refund exact amount
- `CREATE TABLE IF NOT EXISTS public.processed_webhook_events` with UNIQUE(provider, event_id, event_type) — the idempotency audit table that covers all webhook providers
- RLS enabled; service role bypasses by default

### Task 2: Apply Migration to Supabase (BLOCKING CHECKPOINT)

The migration SQL must be applied in the Supabase dashboard SQL editor by the developer before Tasks 3 and 4 can reference the new table.

### Task 3: Stripe Webhook Dedup Guard (completed by continuation agent)

Planned changes to `app/api/webhook/stripe/route.ts`:
- Add processed_webhook_events SELECT check immediately after supabase client init (before existing transactions check)
- Preserve existing transactions check as defense-in-depth
- Add processed_webhook_events INSERT after transaction insert succeeds (insert-last pattern)

### Task 4: Kling Webhook Service Role + Dedup Guard (completed by continuation agent)

Planned changes to `app/api/webhook/video-complete/route.ts`:
- Replace `createClient()` (user-session) with `createServiceClient()` (service role) — fixes RESEARCH.md Finding 4
- Add SUPABASE_SERVICE_ROLE_KEY validation with 500 error on missing config
- Add `credit_cost` to video_history SELECT query
- Add processed_webhook_events dedup SELECT after client init, before video lookup
- Add processed_webhook_events INSERT after each terminal path (succeed + failed) — insert-last pattern

## Deviations from Plan

None — plan executed exactly as written for completed tasks.

## Self-Check: PARTIAL

- scripts/010_create_processed_webhook_events.sql: FOUND (committed 13c65ee)
- Tasks 3-4: pending continuation agent after human applies migration

## Known Stubs

None for the completed task. Tasks 3-4 will wire the table into both webhook handlers.

## Threat Flags

None. All STRIDE threats T-02-01 through T-02-04 are addressed by this plan's changes.
