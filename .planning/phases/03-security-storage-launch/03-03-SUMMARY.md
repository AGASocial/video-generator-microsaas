---
phase: 03-security-storage-launch
plan: "03"
subsystem: documentation
tags: [runbook, pre-deploy, env-vars, rls, smoke-tests]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: ["PRE-DEPLOY-RUNBOOK.md"]
  affects: []
tech_stack:
  added: []
  patterns: [operator-checklist, markdown-runbook]
key_files:
  created:
    - .planning/phases/03-security-storage-launch/PRE-DEPLOY-RUNBOOK.md
  modified: []
decisions:
  - "Runbook covers all 6 requirement areas: INFRA-01/02 (env vars + RLS), VID-03 (download), VID-04 (proxy), AUTH-03 (password reset), ERR-02 (Stripe checkout)"
  - "KLING_WEBHOOK_SKIP_VERIFICATION flagged in two places: must-not-be-set list and pre-launch final checklist"
metrics:
  duration: "< 5 minutes"
  completed: "2026-04-25"
  tasks_completed: 1
  files_changed: 1
---

# Phase 03 Plan 03: Pre-Deploy Runbook Summary

**One-liner:** Pre-deploy operator runbook with 7 sections, 43 checkboxes, RLS verification SQL, and smoke tests for video proxy, password reset, Stripe checkout, and download.

## What Was Built

Created `.planning/phases/03-security-storage-launch/PRE-DEPLOY-RUNBOOK.md` — a complete top-to-bottom operator checklist an operator can follow before going live with no prior context.

**Structure:**
- Section 1: Environment Variables (Vercel) — 11 required vars, 2 must-not-be-set warnings, verification commands
- Section 2: Supabase Production Checks — RLS SQL for all 4 tables, webhook events table, atomic credit RPC, credit_cost column, Spanish email template config
- Section 3: Stripe Production Setup — webhook endpoint registration, live key verification
- Section 4: Kling Webhook Setup — portal registration and secret alignment
- Section 5: Deploy — `vercel --prod` command and build log checks
- Section 6: Smoke Tests — video proxy 302 redirect, password reset flow, Stripe checkout credits, download .mp4
- Section 7: Pre-Launch Final Checklist — 9-item summary gate before announcing to users

**Acceptance criteria results:**
- Checkboxes: 43 (requirement: >= 25)
- Sections: 7
- `KLING_WEBHOOK_SKIP_VERIFICATION` mentions: 3
- `NEXT_PUBLIC_APP_URL` mentions: 5
- `rowsecurity` mentions: 8
- `deduct_credits_and_create_video` mentions: 3
- `302` mentions: 4
- `reset-password` mentions: 4

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Closed

- INFRA-01: Env var checklist covers all 11 production variables with sources
- INFRA-02: RLS verification SQL provided for all 4 tables
- VID-03: Download smoke test (Section 6d) verifies .mp4 download
- VID-04: Video proxy smoke test (Section 6a) verifies 302 redirect
- AUTH-03: Password reset flow smoke test (Section 6b) + Spanish email template config (Section 2e)
- ERR-02: Stripe checkout smoke test (Section 6c) covers credits-appear-after-payment path

## Self-Check: PASSED

- PRE-DEPLOY-RUNBOOK.md exists at expected path
- Commit 9b85cc6 verified in git log
- All acceptance criteria passed with values exceeding minimums
