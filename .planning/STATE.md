# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Users can generate a video and receive it in their history without the platform getting in the way — credits deduct correctly, generation completes reliably, and the video is stored and playable.
**Current focus:** Phase 3 — Security, Storage & Launch (human UAT pending before milestone close)

## Current Position

Phase: 3 of 3 (Security, Storage & Launch)
Plan: 3 of 3 complete
Status: Verified (8/8 automated checks) — 4 human UAT items pending live deploy
Last activity: 2026-04-27 — Phase 3 executed and verified; human UAT items persisted for post-deploy testing

Progress: [██████████] 100% (3/3 phases complete; milestone close blocked on human UAT)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: ~2 hours per plan
- Total execution time: ~20 hours (Phases 1-3)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (Provider Migration) | 5 | ~10h | ~2h |
| 2 (Credit System Hardening) | 2 | ~4h | ~2h |
| 3 (Security, Storage & Launch) | 3 | ~6h | ~2h |

## Accumulated Context

### Decisions

- Phase 1: Chose Kling AI over Google Veo and Runway as Sora replacement. Kling is cheapest (~$0.14/video), supports 2-min clips, has stable production API. Veo 3.1 free tier caps at 50/day (doesn't scale); Runway Gen-4.5 is ~$3/min (too expensive for microsaas).
- Phase 2: All Supabase tables use `video_` prefix (video_users, video_history, video_transactions, video_processed_webhook_events). Existing code has pre-existing `.from("users")` calls that need fixing — tracked as a spawned task for Phase 3.
- Phase 2: Webhook-only refund model (D-03) — credits refunded when Kling confirms failure via webhook, not on immediate API errors. Accepted trade-off for consistency.

### Pending Todos

- Fix `.from("users")` → `.from("video_users")` across codebase (pre-existing, spawned task)
- Run 4 pending human UAT items after deploying to Vercel (see 03-HUMAN-UAT.md): Spanish password-reset email, video download to device, video proxy 302 redirect in production, Stripe checkout failure toast

### Blockers/Concerns

- Milestone v1.1 cannot close until the 4 human UAT items above are run against a live deployment.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Credit | Credit holds/reserves | Deferred | Phase 2 |
| Credit | Rate limiting per user via processed_webhook_events | Deferred | Phase 2 |
| Credit | Webhook retry queue | Deferred | Phase 2 |

## Session Continuity

Last session: 2026-04-27
Stopped at: Phase 3 complete and verified (8/8 automated); blocked on 4 human UAT items requiring a live Vercel deploy
Resume file: .planning/phases/03-security-storage-launch/03-HUMAN-UAT.md
