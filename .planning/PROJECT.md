# Video Generator Microsaas

## What This Is

A pay-as-you-go SaaS platform for AI video generation using Kling AI models (kling-v1, kling-v1-5, kling-v2). Users purchase credit packages via Stripe, then generate videos from text prompts and optional reference images. Built for Spanish and English markets, with Spanish as the primary locale.

## Core Value

Users can generate a Sora video and receive it in their history without the platform getting in the way — credits deduct correctly, generation completes reliably, and the video is stored and playable.

## Requirements

### Validated

- ✓ Next.js 15 App Router with locale-prefixed routing (/es, /en) — Phase 0
- ✓ Supabase Auth (email/password) with automatic user profile creation via DB trigger — Phase 0
- ✓ OpenAI Sora video generation API integration (3 models, 3 durations) — Phase 0
- ✓ Credit system: deduct on generation, refund on failure — Phase 0
- ✓ Stripe Embedded Checkout with webhook-based credit allocation — Phase 0
- ✓ Async video completion via OpenAI webhook + Supabase status updates — Phase 0
- ✓ Video storage in Supabase Storage, proxied via `/api/video/[videoId]/content` — Phase 0
- ✓ User dashboard: video history, transaction history, credit balance — Phase 0
- ✓ Prompt templates and configurable prompt prefix system — Phase 0
- ✓ Dark/light theme, i18n (ES/EN), responsive design — Phase 0

### Active

- [ ] Stabilize OpenAI webhook signature verification (currently has fallback hacks — see recent commits)
- [ ] Confirm idempotency and credit allocation reliability end-to-end in production
- [ ] Validate that video polling and async completion flow works at scale
- [ ] Production environment parity (env vars, Stripe live keys, Supabase RLS policies verified)

### Out of Scope

- Team/org accounts — single-user per account only; multi-tenancy adds complexity not needed at launch
- Video editing or post-processing — generation only; editing is a different product category
- Social sharing or public video galleries — private video history per user; no discovery features
- Subscription billing — credit packs only; subscriptions require usage tracking infrastructure not yet in place
- Custom domain video embedding — videos are served via Supabase proxy; CDN/embed is a future concern

## Context

- The codebase is production-ready in structure but OpenAI webhook verification has been actively debugged (4 recent commits on signature verification, timestamp validation, replay attack prevention, fallback logic) — this is the current hot area
- n8n is referenced as an optional async callback layer (`N8N_WEBHOOK_URL`) but the primary completion path is the OpenAI webhook hitting `/api/webhook/video-complete`
- Two environment configs exist: `.env.dev` and `.env.prod` — Stripe and OpenAI keys differ between environments
- Spanish is the default locale and primary market; English is secondary
- The seasonal UI (Christmas snow effect) suggests this product has been running for at least one season

## Constraints

- **Tech Stack**: Next.js + Supabase + Stripe — locked in; switching any of these would require a full rewrite
- **API**: OpenAI Sora API only — no other video generation providers; Sora pricing/availability determines product viability
- **Auth**: Supabase Auth only — no OAuth providers wired up; adding social login requires RLS policy review
- **Deployment**: Vercel-compatible serverless architecture — no long-running processes; async video generation must use webhooks, not polling servers
- **Payments**: Stripe Embedded Checkout — no redirect-based checkout; UI is embedded, changing this breaks the payment UX
- **Security**: OpenAI webhook signatures must be verified; raw body parsing is required on the webhook route — cannot use Next.js default body parsing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Credit packs over subscriptions | Simpler to implement, no usage metering needed, clear value per transaction | — Pending |
| Supabase for auth + DB + storage | Single vendor for all persistence layers, built-in RLS, generous free tier | ✓ Good |
| Serverless / no polling server | Vercel deployment target; async completion via OpenAI webhook instead | — Pending |
| Spanish as default locale | Primary target market is Spanish-speaking users | — Pending |
| Embedded Stripe Checkout | Better conversion than redirect-based; user stays on page | — Pending |
| Proxy video via `/api/video/[videoId]/content` | Supabase storage URLs expire; proxy adds auth layer and stable URLs | ✓ Good |
| Raw body parsing on OpenAI webhook route | Required for HMAC signature verification; Next.js body parsing corrupts the raw payload | ✓ Good |

---
*Last updated: 2026-04-21 after Phase 0 initialization*
