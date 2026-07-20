---
phase: 02-credit-system-hardening
plan: "02"
subsystem: credits
tags: [rpc, atomic, refund, webhook, credit-deduction]
dependency_graph:
  requires:
    - 02-01
  provides:
    - atomic-credit-deduction
    - webhook-credit-refund
  affects:
    - app/api/generate/route.ts
    - app/api/webhook/video-complete/route.ts
tech_stack:
  added: []
  patterns:
    - Supabase RPC for atomic multi-table writes (SECURITY DEFINER)
    - Webhook-only refund model (no API-error refunds)
    - Increment-based credit refund (credits + N, not snapshot overwrite)
key_files:
  created: []
  modified:
    - app/api/generate/route.ts
    - app/api/webhook/video-complete/route.ts
decisions:
  - "D-02: Single RPC call replaces two-call deduction pattern — eliminates crash window between UPDATE users and INSERT video_history"
  - "D-03: No credit refund on Kling API errors in generate route — refund responsibility is exclusively the Kling webhook on task_status=failed"
  - "D-05: Immediate deduction model — credits deducted at generation request time, refunded only on confirmed Kling failure"
metrics:
  duration: ~20min
  completed: "2026-04-25"
  tasks_completed: 4
  files_modified: 2
---

# Phase 02 Plan 02: Atomic Credit Deduction and Webhook Refund Summary

**One-liner:** Replaced two-call credit deduction with a single `deduct_credits_and_create_video` RPC (SELECT FOR UPDATE + atomic deduct + insert), and added increment-based `refund_video_credits` RPC call in the Kling webhook failed branch.

## What Was Built

### Task 1 (prior session): SQL Migration 011
`scripts/011_create_deduct_credits_rpc.sql` — both PostgreSQL RPCs with SECURITY DEFINER and appropriate GRANTs.

### Task 2 (prior session — human action): Migration Applied
User applied migration to Supabase; both functions confirmed in Database → Functions.

### Task 3: generate/route.ts rewritten (commit 20e14b0)
- Replaced `UPDATE users` + `INSERT video_history` (two separate calls) with `supabase.rpc("deduct_credits_and_create_video")`.
- RPC handles: balance validation, SELECT FOR UPDATE row lock, atomic deduction, atomic video_history insert with `credit_cost` stored.
- Removed all three absolute-set refund calls (`credits: user.credits`): the one in videoError catch, the one in tokenError catch, and the one in klingError catch.
- Early-exit credits guard (lines ~90-100) retained as fast-fail UX optimization.
- video_history status-to-"failed" updates in error branches retained.

### Task 4: video-complete/route.ts — refund in failed branch (commit bfb6f7a)
- Added `supabase.rpc("refund_video_credits", { p_user_id, p_amount })` in the `taskStatus === "failed"` else-branch.
- Placement: after `video_history` status update, before `processed_webhook_events` insert — satisfies D-01 ordering constraint.
- Guards against null/zero `credit_cost` before calling RPC.
- Refund error logged but does not block dedup row insertion.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 511a85a | chore(02-02): add SQL migration 011 for deduct_credits_and_create_video and refund_video_credits RPCs |
| 3 | 20e14b0 | feat(02-02): atomic credit deduction via RPC in generate/route.ts |
| 4 | bfb6f7a | feat(02-02): add credit refund via refund_video_credits RPC in webhook failed branch |

## Known Stubs

None — all data paths are wired. `credit_cost` is stored in `video_history` at RPC insert time and read back by the webhook refund path.

## Threat Surface Scan

No new network endpoints or auth boundaries introduced. Changes are internal rewrites of existing routes. Threat mitigations T-02-05 through T-02-09 (from plan threat model) are all satisfied:
- T-02-05: SELECT FOR UPDATE in RPC serializes concurrent deductions
- T-02-06: `credit_cost` stored at generation time, read by refund (not live pricing)
- T-02-08: processed_webhook_events dedup (02-01) + status check prevent double-refund
- T-02-09: `credits + p_amount` increment used in refund_video_credits

## Self-Check: PASSED

- FOUND: app/api/generate/route.ts
- FOUND: app/api/webhook/video-complete/route.ts
- FOUND commit 511a85a (SQL migration 011)
- FOUND commit 20e14b0 (generate/route.ts RPC rewrite)
- FOUND commit bfb6f7a (webhook refund)

