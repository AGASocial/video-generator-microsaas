# Project Research Summary

**Project:** Video Generator Microsaas
**Domain:** Pay-as-you-go AI video generation SaaS (Sora-backed, Spanish-first)
**Researched:** 2026-04-21
**Confidence:** HIGH

## Executive Summary

This is a pay-as-you-go AI video generation SaaS built on OpenAI Sora, targeting Spanish-speaking markets where competitors (Runway, Kling, Pika) offer no localized experience. The architecture is serverless-first (Next.js on Vercel + Supabase + Stripe Embedded Checkout) and Phase 0 code is complete — meaning all features are built, but the system is not yet production-stable. The primary work is stabilization and hardening, not new feature development.

The recommended approach is to treat this as a post-build stabilization project: the async webhook pipeline (OpenAI video completion → credit lifecycle → storage) is the core risk surface, and it has known active bugs (4 recent commits on webhook signature verification alone). Before any growth features are added, the credit system must be idempotent, webhook verification must be airtight, and video storage must use paths (not expiring signed URLs). These are not optional improvements — they are trust-breaking failures if left unresolved in production.

The key competitive advantage to protect is the trifecta: (1) Spanish-first UX, (2) pure pay-per-use with no subscription lock-in, and (3) prompt template system. Everything else — video history, playback, account management — is table stakes. The product is differentiated not by unique features but by combining the right features for an underserved market. Growth work should amplify these advantages rather than chase parity with English-market competitors.

## Key Findings

### Recommended Stack

The stack is locked in and well-chosen for this architecture. Next.js 16 + React 19 on Vercel gives serverless functions with zero infra management, which is the right fit for Sora's async webhook model. Supabase serves triple duty as auth, database, and storage — reducing vendor surface area. Stripe Embedded Checkout avoids redirect-based checkout friction. The only gap: the `openai` npm package is not listed in `package.json`; Sora API calls are likely raw `fetch` — this should be pinned to a typed SDK to catch breaking API changes early.

**Core technologies:**
- **Next.js 16 + React 19**: Full-stack framework — App Router + serverless functions in one repo; Vercel-native deployment
- **Supabase (auth + PostgreSQL + Storage)**: Single vendor for all persistence; RLS enforces per-user data isolation at the DB layer
- **Stripe (Embedded Checkout + Webhooks)**: On-page payment with no redirect; webhook-based credit allocation
- **next-intl ^4.5.5**: i18n with locale-prefixed routing (`/es`, `/en`); server component native
- **Zod + react-hook-form**: Shared validation schema across client forms and API route handlers — critical when credits/money are involved
- **Tailwind CSS v4**: CSS-based config (no `tailwind.config.js`); pairs with shadcn/ui primitives

### Expected Features

All table stakes features are built. The gap list is short but high-impact.

**Must have (table stakes — built ✓ except where noted):**
- Video generation from text prompt (3 models, 3 durations) — core product action
- Credit balance visible at all times — users won't pay if they can't see it
- Generation status feedback (pending/processing/done/failed) — async generation takes 30-120s
- Credit refund on failed generation — trust-critical; built but needs end-to-end production validation
- Video playback in-browser via proxy route — built
- Video history + transaction history — built
- Secure payment flow (Stripe Embedded) — built
- Account creation + email/password login — built
- **Video download** — NOT confirmed built; needs explicit download button (P1 gap)
- **Password reset (Spanish locale email templates)** — built in Supabase but Spanish email templates need verification (P1 gap)

**Should have (competitive differentiators — built ✓):**
- Spanish-first UX (`/es` default locale) — no competitor offers this
- Prompt template system + configurable operator prefix — lowers friction for non-technical users
- Pay-per-use credit packs (no subscription) — lower commitment barrier
- 3 model tiers (sora-2, sora-2-pro, sora-2-pro-HD) — user controls quality/cost tradeoff
- Reference image support (image-to-video mode) — built

**Defer (v2+):**
- Bulk/discounted credit packs — only worth building if users hit pack limits
- Admin analytics dashboard — needs scale to justify
- Video share links (private/expiring) — valid v1.x addition but not blocking launch
- Google OAuth — only if signup conversion data shows friction is real
- Webhook retry visibility in dashboard — operational nicety, not launch-critical

### Architecture Approach

The architecture is a serverless async pipeline: generation requests fire immediately and return `{ status: "processing" }`, with completion delivered via OpenAI webhook push to `/api/webhook/video-complete` (primary) and a background polling fallback (secondary). Both paths converge on `lib/video-storage.ts` which downloads from OpenAI and uploads to Supabase Storage. Videos are served via a proxy route (`/api/video/[videoId]/content`) that generates fresh signed URLs per request — never raw expiring Supabase URLs. This architecture is correct for Vercel's serverless constraints; the risks are in the implementation details, not the design.

**Major components:**
1. `/api/generate/route.ts` — deducts credits optimistically, submits Sora job, returns 202 immediately
2. `/api/webhook/video-complete/route.ts` — receives OpenAI push, verifies HMAC-SHA256, stores video (Node.js runtime, raw body required)
3. `/api/webhook/stripe/route.ts` — receives Stripe events, allocates credits idempotently (Node.js runtime, raw body required)
4. `lib/video-storage.ts` — shared module: OpenAI download → Supabase Storage upload (called by both completion paths)
5. `/api/video/[videoId]/content/route.ts` — auth-gated video proxy; generates fresh signed URLs per request
6. `lib/products.ts` — single source of truth for credit costs per model; UI and API must read from here

### Critical Pitfalls

1. **OpenAI webhook signature verification broken** — 4 recent commits show active instability; fallback hacks and skip-verification escape hatches in the codebase must be eliminated before launch. Fix: `await request.text()` as the first operation in the webhook handler, Node.js runtime required, no `SKIP_*_VERIFICATION` env vars.

2. **Non-idempotent credit operations** — webhooks retry on non-2xx; without idempotency keys, a single video completion event can deduct or refund credits multiple times. Fix: `processed_webhook_events` table with unique constraint on event ID; check before any DB write.

3. **Vercel function timeout on long video operations** — Sora generation takes 30s–5min; Vercel caps at 10s (Hobby) / 60s (Pro). Any synchronous await on generation will timeout mid-operation, leaving credits deducted with no video. Fix: fire-and-forget pattern is already in place — verify it and set `maxDuration = 60` on webhook route in `vercel.json`.

4. **Supabase Storage URLs expiring** — signed URLs expire (default 1hr). If `video_url` column stores raw signed URLs instead of storage paths, videos break the next day. Fix: verify DB stores only file paths; proxy route regenerates URLs per request.

5. **RLS misconfiguration** — RLS is opt-in per Supabase table. Any table without RLS allows cross-user data access. Service role key bypasses RLS entirely. Fix: verify all tables have RLS enabled; `SUPABASE_SERVICE_ROLE_KEY` must only appear in server-side code.

## Implications for Roadmap

Based on combined research, the product needs 4 phases before it's growth-ready. The ordering is driven by trust dependencies: you cannot market a product where credits can be double-deducted or videos break after an hour.

### Phase 1: Webhook Stabilization
**Rationale:** This is the actively broken component. The OpenAI webhook is the primary completion path for the entire product — if it's unreliable, nothing downstream works correctly. 4 recent commits confirm this is in-flight work.
**Delivers:** A webhook handler that passes signature verification consistently, rejects invalid signatures with 401, and has integration tests proving both behaviors.
**Addresses:** Video generation completion (table stakes), generation status reliability
**Avoids:** Pitfall 1 (signature broken), Pitfall 3 (timeout via misconfigurations)
**Research flag:** Skip — patterns are well-documented; this is implementation work, not research work.

### Phase 2: Credit System Hardening
**Rationale:** Credits are money. Before any real users transact, the credit lifecycle must be idempotent across all paths: Stripe webhook → credit allocation, OpenAI webhook → completion, failure → refund. The dual-completion architecture (webhook + polling fallback) makes this especially important — both paths must be guarded.
**Delivers:** Idempotent webhook handlers (Stripe + OpenAI), atomic credit deduction via DB function, refund reliability end-to-end, `processed_webhook_events` table.
**Addresses:** Credit allocation idempotency (P1), credit refund on failure validation (P1)
**Avoids:** Pitfall 2 (double deduct/refund), Pitfall 5 (Stripe race condition), Pitfall 7 (Sora unavailability stranding credits)
**Research flag:** Skip — Stripe idempotency and Supabase RPC patterns are standard.

### Phase 3: Storage + Security Audit
**Rationale:** With webhook and credit flows stable, verify the storage and security invariants before launch. These are "looks done but isn't" issues that break silently in production.
**Delivers:** Confirmed storage path storage (not signed URLs), RLS verified on all tables, service role key scope verified, video proxy route confirmed working, `maxDuration` set on webhook routes, password reset flow validated in Spanish.
**Addresses:** Video download button (P1 gap), password reset (Spanish locale) verification, video playback stability
**Avoids:** Pitfall 4 (storage URL expiration), Pitfall 6 (RLS misconfiguration)
**Research flag:** Skip — checklist-driven audit work, not research work.

### Phase 4: Launch Readiness + P1 Feature Gaps
**Rationale:** After the system is stable, close the two remaining P1 feature gaps (video download, Spanish email templates) and validate the end-to-end production flow with real transactions before announcing.
**Delivers:** Video download button, verified Spanish email templates in Supabase, end-to-end production smoke test (register → buy credits → generate video → download), stuck pending video cleanup cron job.
**Addresses:** Video download (P1 gap), password reset UX, operational readiness
**Avoids:** Pitfall UX issues (no progress indicator, no refund confirmation messaging)
**Research flag:** Skip — standard Next.js + Supabase patterns throughout.

### Phase 5: Growth Features (v1.x)
**Rationale:** Only after production stability is confirmed should growth features be added. These are all low-complexity improvements that amplify the existing differentiators.
**Delivers:** Generation cost preview (model + duration → credits shown before submit), credit low-balance warning, prompt history, video title/rename.
**Addresses:** P2 features from prioritization matrix
**Uses:** Existing Supabase Realtime subscription infrastructure
**Research flag:** Skip — all standard React/Supabase patterns.

### Phase Ordering Rationale

- **Webhook before credits:** Credits depend on webhooks. A broken webhook handler means credit operations are unreachable or unreliable — fixing credits first would be building on sand.
- **Credits before audit:** The audit phase verifies invariants; it needs the correct implementation to verify. Auditing broken credit logic is wasted effort.
- **Audit before launch readiness:** Security and storage issues discovered post-launch are high-cost to recover from (user trust, GDPR obligations). Catching them pre-launch is cheap.
- **Feature gaps in Phase 4, not Phase 1:** Video download and email templates are important but not trust-critical. They don't block webhook or credit stability. Adding them early creates scope creep in the stabilization phases.

### Research Flags

Phases needing deeper research during planning: **None** — all phases involve well-documented patterns (Next.js webhooks, Stripe idempotency, Supabase RLS, serverless architecture). The research files provide sufficient implementation detail.

Phases with standard patterns (skip `/gsd-research-phase`):
- **All phases** — the stack is locked in, architecture is documented, and pitfalls are enumerated with specific prevention strategies. Planning can proceed directly to task breakdown.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Derived from actual `package.json` — no speculation; versions are ground truth |
| Features | HIGH | Post-Phase 0 codebase; built vs. not-built is observable from code and PROJECT.md |
| Architecture | HIGH | Based on codebase inspection + official Next.js/Supabase/Stripe docs |
| Pitfalls | HIGH | Pitfalls derived from active bugs (4 commits on webhook issue) + well-understood serverless/Stripe/Supabase patterns |

**Overall confidence:** HIGH

### Gaps to Address

- **OpenAI SDK:** `openai` package not in `package.json` — confirm if API calls use raw `fetch` or a vendored SDK. If raw fetch, add `openai` package for typed request/response objects before any API contract changes.
- **Credit pack pricing tiers:** FEATURES.md notes "needs confirmation — is there actual tiered pricing?" Verify `lib/products.ts` has multiple pack sizes with bulk discount, or flag as missing.
- **Vercel plan:** `maxDuration` limit depends on Hobby (10s) vs Pro (60s) plan. Confirm active Vercel plan before setting `maxDuration` on webhook routes.
- **n8n integration:** `N8N_WEBHOOK_URL` env var exists but purpose is undocumented. Clarify in PROJECT.md whether this is active infrastructure or a placeholder.

## Sources

### Primary (HIGH confidence)
- `/package.json` — actual installed versions, ground truth for stack
- `.planning/PROJECT.md` — architectural constraints, active issues, out-of-scope decisions
- Codebase inspection — `app/api/webhook/`, `app/api/generate/`, `lib/video-storage.ts`, `lib/products.ts`
- Git log — 4 recent commits on webhook signature verification confirm active instability

### Secondary (MEDIUM confidence)
- Next.js 15/16 App Router docs — routing, server components, API routes, middleware patterns
- Supabase SSR guide — `@supabase/ssr` cookie-based session pattern
- Stripe Embedded Checkout docs — session creation flow, webhook signature verification
- Vercel serverless limits — `maxDuration` caps by plan tier

### Tertiary (MEDIUM confidence)
- Competitor observations (Runway ML, Kling AI, Pika Labs) — feature parity analysis; verify at launch time as competitor features evolve

---
*Research completed: 2026-04-21*
*Ready for roadmap: yes*
