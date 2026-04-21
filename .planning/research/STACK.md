# Stack Research

**Domain:** Pay-as-you-go AI video generation SaaS
**Researched:** 2026-04-21
**Confidence:** HIGH (derived from actual package.json + PROJECT.md — no speculation)

> **Note:** The stack is locked in. This document reflects what is deployed, with version pins and
> rationale for each choice. Its purpose is to inform roadmap tasks about the exact environment
> constraints and identify any version drift or upgrade risks.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.0.10 | Full-stack React framework | App Router gives server components + route handlers in one repo; Vercel-native deployment with no infra to manage |
| React | 19.2.0 | UI rendering | Concurrent features + server components required by Next.js 16; matches Next.js 16 peer requirements |
| TypeScript | ^5 | Type safety across app + API routes | Catches contract mismatches between DB types, API payloads, and UI — critical when credits/money are involved |
| Tailwind CSS | ^4.1.9 | Utility-first styling | v4 ships PostCSS plugin (`@tailwindcss/postcss`) — no separate config file required; pairs with shadcn/ui |

### Auth + Database + Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` | latest | Supabase client (DB queries, Auth, Storage) | Single SDK for all persistence; RLS enforces per-user data isolation without application-level guards |
| `@supabase/ssr` | latest | Server-side Supabase client for Next.js | Required for reading auth state in Server Components and API routes; handles cookie-based session refresh |
| `server-only` | latest | Guard server-only modules | Prevents Supabase service-role key from leaking to browser bundle — import in any file using `SUPABASE_SERVICE_ROLE_KEY` |

### Payments

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` | latest | Stripe Node SDK (server-side) | Webhook signature verification, payment intent creation, session retrieval |
| `@stripe/react-stripe-js` | latest | Stripe React components | Embedded Checkout renders inside the app; avoids redirect-based flow that breaks conversion |
| `@stripe/stripe-js` | latest | Stripe.js browser SDK | Required peer of `@stripe/react-stripe-js`; loads Stripe.js asynchronously |

### AI / Video Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenAI Node SDK | (via `openai` — not in package.json, called via REST or SDK) | Sora video generation API | Only provider with Sora models (sora-2, sora-2-pro, sora-2-pro-HD); no alternative exists for this use case |

> **Action item:** `openai` package is not listed in package.json. Confirm whether API calls are made
> via raw `fetch` or a vendored SDK. If raw fetch, pin a version of `openai` for typed request/response
> objects and to catch breaking API changes early.

### i18n

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `next-intl` | ^4.5.5 | Internationalization for Next.js App Router | Native integration with server components and locale-prefixed routing (`/es`, `/en`); handles message loading per locale without client-side bundle bloat |

### UI Components

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Radix UI primitives | various (1.x–2.x) | Accessible, unstyled component primitives | shadcn/ui installs these; Radix handles keyboard navigation and ARIA so you don't have to |
| `lucide-react` | ^0.454.0 | Icon set | Ships as individual tree-shakeable components; no icon font payload |
| `next-themes` | ^0.4.6 | Dark/light theme management | Prevents flash-of-unstyled-content on theme switch; integrates with Tailwind's `dark:` variant |
| `sonner` | ^1.7.4 | Toast notifications | Replaces `@radix-ui/react-toast` for most notifications; better DX, auto-dismiss, queue management |
| `react-snowfall` | ^2.3.0 | Seasonal snow animation | Cosmetic only; loaded conditionally |

### Forms + Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-hook-form` | ^7.60.0 | Form state management | Uncontrolled inputs = no re-render on keypress; critical for prompt input that can be long |
| `@hookform/resolvers` | ^3.10.0 | Adapter: react-hook-form + Zod | Connects Zod schemas to form validation without writing resolver glue code |
| `zod` | 3.25.76 | Schema validation | Used for API route input validation and form schemas; exact same schema validates both client and server |

### Media

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-easy-crop` | ^5.5.5 | Image crop UI | Used for reference image upload; lets user frame the image before sending to Sora |
| `embla-carousel-react` | 8.5.1 | Carousel/slider | Video history browsing |

### Analytics + Observability

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@vercel/analytics` | latest | Page view + web vitals | Zero-config on Vercel; no separate tracking setup; privacy-friendly |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `dotenv-cli` | Per-environment `.env` file loading | `npm run dev` loads `.env.dev`; `build:prod` loads `.env.prod` — clean separation of dev/prod credentials |
| `@tailwindcss/postcss` | Tailwind v4 PostCSS integration | Tailwind v4 dropped the standalone `tailwind.config.js` — configure via CSS `@theme` instead |
| `tw-animate-css` | Animation utilities for Tailwind | Companion to `tailwindcss-animate`; adds Tailwind-compatible keyframe classes |
| `tsx` / `npx tsx` | TypeScript script runner | Used in `setup:webhook` script — runs `.ts` files without compiling |
| ESLint | Code linting | `npm run lint` — Next.js built-in ESLint config |

---

## Installation

> Stack is already installed. For reference when adding new dependencies:

```bash
# Core (already installed)
npm install next react react-dom typescript

# Supabase
npm install @supabase/supabase-js @supabase/ssr server-only

# Stripe
npm install stripe @stripe/react-stripe-js @stripe/stripe-js

# i18n
npm install next-intl

# Forms + Validation
npm install react-hook-form @hookform/resolvers zod

# If not yet installed: OpenAI SDK
npm install openai

# Dev
npm install -D tailwindcss @tailwindcss/postcss postcss dotenv-cli typescript
```

---

## Alternatives Considered

| Our Choice | Alternative | When Alternative Wins |
|------------|-------------|----------------------|
| Supabase (auth + DB + storage) | Firebase / PlanetScale + Clerk | Firebase if team knows it deeply; PlanetScale+Clerk for higher scale with separate concerns — not worth migration cost here |
| Stripe Embedded Checkout | Stripe Payment Links | Payment Links for zero-code checkout; Embedded wins when you need on-page conversion and custom UI |
| next-intl | `react-i18next` | `react-i18next` for React apps NOT using App Router; next-intl is the standard for Next.js 13+ |
| Vercel (serverless) | Railway / Fly.io (long-running) | Long-running servers if you need persistent connections (WebSockets, polling loops) — Sora's webhook model fits serverless |
| Tailwind CSS v4 | Tailwind CSS v3 | v3 if you need community plugins not yet ported to v4; v4 is the current release |
| Zod | Yup / Valibot | Valibot for smaller bundle size; Zod has better ecosystem integration (tRPC, Prisma, react-hook-form) |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Polling for video completion | Vercel function timeout is 10s (Hobby) / 60s (Pro) — Sora generation takes minutes | OpenAI webhook → `/api/webhook/video-complete` (already implemented) |
| `body-parser` / default Next.js body parsing on webhook route | Corrupts raw body needed for HMAC-SHA256 signature verification | `export const config = { api: { bodyParser: false } }` — read raw buffer manually (already done) |
| Supabase storage public URLs directly in `<video src>` | URLs expire; expiry leaks storage bucket structure | Proxy via `/api/video/[videoId]/content` (already implemented) |
| `process.env` in client components | Leaks server secrets to browser bundle | Prefix with `NEXT_PUBLIC_` only what the browser needs; use `server-only` package to guard the rest |
| Storing raw Stripe webhook bodies in DB | PII risk; unnecessary | Store only the extracted credit amount and transaction ID |
| `latest` tag in production package.json for critical packages | `stripe latest`, `@supabase/supabase-js latest` — breaks on major version bumps | Pin to specific versions after validating; use Dependabot/Renovate for updates |

---

## Stack Patterns by Variant

**Webhook routes (OpenAI, Stripe):**
- Disable Next.js body parser: `export const config = { api: { bodyParser: false } }`
- Read raw body via `req.arrayBuffer()` or Node `Buffer`
- Verify HMAC signature before any business logic
- Return 200 immediately after verification; do async work after

**Server components that need auth:**
- Use `@supabase/ssr` `createServerClient` with cookie store
- Never import `@supabase/supabase-js` direct in Server Components — use the SSR client
- Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) only in API routes, never in components

**Credit deduction flow:**
- Deduct credits before calling Sora (optimistic deduction)
- Refund on generation failure or webhook timeout
- Use Supabase DB functions / RPC for atomic deduct+create-record to prevent race conditions

**i18n routing:**
- Locale prefix is required (`/es/...`, `/en/...`)
- `next-intl` middleware handles redirect from `/` to default locale (`/es`)
- Message files live in `messages/es.json`, `messages/en.json`

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| next@16.0.10 | react@19.2.0, react-dom@19.2.0 | Next.js 16 requires React 19; do not downgrade React |
| next-intl@^4.5.5 | next@16.x | next-intl v4 targets Next.js 15+; compatible with 16 |
| tailwindcss@^4.1.9 | @tailwindcss/postcss@^4.1.9 | Tailwind v4 config is CSS-based — not `tailwind.config.js`; v4 plugin API changed from v3 |
| zod@3.25.76 | @hookform/resolvers@^3.10.0 | resolvers v3 supports Zod v3; do not upgrade to Zod v4 without checking resolver compatibility |
| @supabase/ssr@latest | @supabase/supabase-js@latest | Both must track the same major version; mismatching majors causes session type errors |
| stripe@latest | Node.js ≥18 | Stripe SDK v17+ dropped Node 16; Vercel runtime is Node 20 by default — fine |

---

## Sources

- `/package.json` — actual installed versions (HIGH confidence, ground truth)
- `.planning/PROJECT.md` — architectural constraints and decisions (HIGH confidence)
- Next.js 16 release notes (verify at nextjs.org/blog) — MEDIUM confidence on Next.js 16 specifics
- Stripe docs (stripe.com/docs/webhooks/signatures) — raw body requirement for signature verification
- Supabase SSR docs (supabase.com/docs/guides/auth/server-side/nextjs) — SSR client pattern

---

*Stack research for: Video Generator Microsaas (pay-as-you-go AI video SaaS)*
*Researched: 2026-04-21*
