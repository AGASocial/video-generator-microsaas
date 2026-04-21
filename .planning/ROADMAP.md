# Roadmap: Video Generator Microsaas

## Overview

v1.0 MVP is shipped. The platform is code-complete but not production-stable. The most urgent work is migrating off OpenAI Sora (web access ends April 26, 2026; API ends September 2026) to Kling AI as the primary provider — the existing webhook/completion infrastructure needs to be rebuilt for Kling's API. Once the new provider is integrated with proper signature verification and idempotency, the credit lifecycle must be hardened, and then the platform needs a security and storage audit before it can safely accept real users.

## Milestones

- ✅ **v1.0 MVP** — Core platform shipped (auth, billing, Sora integration, i18n, themes)
- 🚧 **v1.1 Stabilization** — Phases 1-3 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Provider Migration** - Replace OpenAI Sora with Kling AI; rebuild webhook handler with proper signature verification, idempotency, and replay protection
- [ ] **Phase 2: Credit System Hardening** - Make credit deduction, allocation, and refund operations atomic and idempotent across all payment and generation paths
- [ ] **Phase 3: Security, Storage & Launch** - Verify RLS policies, production env vars, video proxy stability, video download, password reset, and error surfaces

## Phase Details

<details>
<summary>✅ v1.0 MVP — SHIPPED</summary>

Core platform: auth (Supabase), Stripe billing with credit packages, OpenAI Sora video generation, image cropping, prompt management, theme system, video history, i18n (EN/ES), webhook handling.

</details>

### 🚧 v1.1 Stabilization (In Progress)

**Milestone Goal:** Migrate off Sora, harden the credit and webhook systems, and lock down security so the platform can accept real users safely.

#### Phase 1: Provider Migration
**Goal**: Kling AI is the active video generation provider — generation requests go to Kling, completion events arrive via Kling's webhook with proper signature verification, idempotency, and replay protection in place
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: STAT-03, STAT-04, STAT-05, ERR-01, ERR-03
**Success Criteria** (what must be TRUE):
  1. Videos are generated via Kling AI API — no Sora API calls in the generation path
  2. A Kling completion webhook with a valid signature is accepted and the video status updates correctly
  3. A Kling completion webhook with an invalid or missing signature is rejected with HTTP 401
  4. Replaying the same Kling completion event does not update the video record twice
  5. A Kling completion event with a timestamp older than 5 minutes is rejected
  6. When Kling API returns an error (rate limit, content policy, unavailable), the user sees a human-readable message in Spanish or English
  7. Webhook handler logs video ID, event type, and error message on any server-side failure
**Plans**: TBD

Plans:
- [ ] 01-01: Research Kling AI API (video generation endpoint, webhook format, signature scheme) and update environment config
- [ ] 01-02: Replace video generation call (Sora → Kling) and update webhook handler with Kling signature verification
- [ ] 01-03: Implement webhook idempotency and replay protection; add structured error logging
- [ ] 01-04: Test end-to-end flow and verify Supabase video status updates work with Kling completion events

#### Phase 2: Credit System Hardening
**Goal**: Credits cannot be double-allocated or lost — every deduction, Stripe allocation, and refund is atomic and idempotent across all paths
**Depends on**: Phase 1
**Requirements**: CRED-04, CRED-05, PAY-03, ERR-04
**Success Criteria** (what must be TRUE):
  1. Replaying a Stripe payment webhook event does not credit the user twice
  2. Replaying a Stripe payment event that was already processed returns 200 with no side effects
  3. A video generation failure always triggers a credit refund — no case where generation fails and credits remain deducted
  4. Credit deduction and the generation record are written atomically — no partial state where credits are deducted but no generation record exists
**Plans**: TBD

Plans:
- [ ] 02-01: Implement `processed_webhook_events` table with unique constraint; guard Stripe and Kling handlers
- [ ] 02-02: Implement atomic credit deduction via Supabase RPC; validate refund path end-to-end

#### Phase 3: Security, Storage & Launch
**Goal**: Production is safe and feature-complete — RLS policies block cross-user access, env vars are configured, the video proxy works, users can download videos, password reset sends Spanish emails, and all error states surface readable messages
**Depends on**: Phase 2
**Requirements**: INFRA-01, INFRA-02, VID-03, VID-04, AUTH-03, ERR-02
**Success Criteria** (what must be TRUE):
  1. All production environment variables are set (Supabase, Stripe live keys, Kling keys, webhook secrets) and the app starts without missing-env errors
  2. A user cannot access another user's videos, credit balance, or transaction history — RLS policies enforce isolation on all tables
  3. The video proxy route returns the correct video file with appropriate content-type headers in production
  4. User can click a download button on a completed video card and receive the video file on their device
  5. A user who resets their password receives an email with Spanish-language content and can successfully set a new password
  6. When Stripe Checkout fails, the user sees a helpful error message without internal details exposed
**Plans**: TBD

Plans:
- [ ] 03-01: Verify and fix Supabase RLS policies on all tables; confirm service role key scope
- [ ] 03-02: Configure production env vars; confirm video proxy works in production with correct content-type headers
- [ ] 03-03: Add video download button to video card; verify Spanish password reset email template

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Provider Migration | v1.1 | 0/4 | Not started | - |
| 2. Credit System Hardening | v1.1 | 0/2 | Not started | - |
| 3. Security, Storage & Launch | v1.1 | 0/3 | Not started | - |
