# Architecture Research

**Domain:** Pay-as-you-go AI video generation SaaS (serverless)
**Researched:** 2026-04-21
**Confidence:** HIGH — based on actual codebase inspection + Next.js/Supabase/Stripe official docs

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Browser (Client)                             │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  /[locale]/    │  │  /[locale]/  │  │  /[locale]/        │   │
│  │  generate      │  │  credits     │  │  profile           │   │
│  └───────┬────────┘  └──────┬───────┘  └─────────┬──────────┘   │
│          │ fetch()          │ fetch()             │ fetch()      │
└──────────┼──────────────────┼─────────────────────┼─────────────┘
           │                  │                     │
┌──────────▼──────────────────▼─────────────────────▼─────────────┐
│                   Next.js API Routes (Vercel Serverless)         │
│                                                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │ /api/generate│  │/api/checkout/ │  │ /api/user/*          │  │
│  │              │  │create-session │  │ /api/video/[id]/     │  │
│  │ (deduct +    │  │               │  │ content (proxy)      │  │
│  │  call Sora)  │  │(Stripe embed) │  │                      │  │
│  └──────┬───────┘  └───────┬───────┘  └──────────────────────┘  │
│         │                  │                                     │
│  ┌──────▼───────────────────────────────────────────────────┐   │
│  │           Webhook Receivers (inbound, public)            │   │
│  │  /api/webhook/video-complete    /api/webhook/stripe      │   │
│  │  (OpenAI push → store video)    (Stripe → add credits)   │   │
│  └──────┬───────────────────────────────────────────────────┘   │
└─────────┼────────────────────────────────────────────────────────┘
          │
┌─────────▼────────────────────────────────────────────────────────┐
│                       Supabase (single vendor)                   │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Auth           │  │  PostgreSQL  │  │  Storage          │  │
│  │  (email/pass)    │  │  (DB + RLS)  │  │  (video files)    │  │
│  │  + DB trigger    │  │              │  │                   │  │
│  └──────────────────┘  └──────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          │                                         │
┌─────────▼──────────┐                  ┌───────────▼───────────┐
│   OpenAI Sora API  │                  │       Stripe API       │
│  (async job gen)   │                  │  (Embedded Checkout)   │
│  POST /v1/videos   │                  │  + Webhooks            │
│  GET  /v1/videos/  │                  │                        │
│  {id} (poll)       │                  │                        │
└────────────────────┘                  └───────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `app/[locale]/*` pages | UI rendering, locale routing | Next.js App Router RSC + client components |
| `app/api/generate/route.ts` | Credit deduction, Sora API call, polling fallback | Node.js serverless function |
| `app/api/webhook/video-complete/route.ts` | Receive OpenAI push completion, store video | Node.js runtime (raw body required) |
| `app/api/webhook/stripe/route.ts` | Receive Stripe events, allocate credits | Node.js runtime (raw body required) |
| `app/api/video/[videoId]/content/route.ts` | Proxy video from Supabase Storage with auth | Serverless stream proxy |
| `app/api/checkout/*` | Create Stripe sessions, verify payment | Serverless functions |
| `lib/supabase/server.ts` | Server-side Supabase client (SSR cookies) | `@supabase/ssr` |
| `lib/supabase/client.ts` | Browser-side Supabase client | `@supabase/ssr` |
| `lib/video-storage.ts` | Download from OpenAI, upload to Supabase Storage | Called by both webhook and polling |
| `middleware.ts` | Auth session refresh + locale redirect | Next.js Edge Middleware |
| `lib/products.ts` | Credit cost per model (pricing logic) | Static config |

## Recommended Project Structure

This project's actual structure is already well-organized. The conventions to preserve:

```
/
├── app/
│   ├── [locale]/               # All user-facing pages under locale prefix
│   │   ├── layout.tsx          # Locale-scoped layout (i18n provider, theme)
│   │   ├── page.tsx            # Home / dashboard
│   │   ├── generate/page.tsx   # Video generation UI
│   │   ├── credits/page.tsx    # Purchase credits (Stripe Embedded Checkout)
│   │   └── profile/page.tsx    # User settings, history
│   ├── api/
│   │   ├── generate/route.ts   # Core: deduct credits + call Sora
│   │   ├── webhook/
│   │   │   ├── video-complete/ # OpenAI webhook receiver (raw body, Node.js runtime)
│   │   │   └── stripe/         # Stripe webhook receiver (raw body, Node.js runtime)
│   │   ├── checkout/           # Stripe session management
│   │   ├── video/[videoId]/
│   │   │   └── content/        # Video proxy (auth-gated Supabase Storage access)
│   │   └── user/               # User data endpoints (credits, videos, transactions)
│   └── actions/                # Next.js Server Actions (mutations from RSC)
├── components/
│   ├── ui/                     # shadcn/ui primitives (never edit directly)
│   └── *.tsx                   # Domain components (credit-packages, navigation, etc.)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client (singleton, uses cookies)
│   │   └── server.ts           # Server client (per-request, reads cookies)
│   ├── products.ts             # Credit cost table — single source of truth for pricing
│   ├── video-storage.ts        # OpenAI download → Supabase Storage upload
│   ├── stripe.ts               # Stripe client initialization
│   └── types.ts                # Shared TypeScript types
├── messages/                   # i18n translation files (es.json, en.json)
├── i18n/                       # next-intl config (routing, request)
└── middleware.ts               # Auth session + locale routing
```

### Structure Rationale

- **`app/[locale]/` over flat routes:** Locale prefix is required for i18n. All routes live under `[locale]` to pick up the `locale` param; root-level pages redirect to default locale via middleware.
- **`app/api/webhook/` uses Node.js runtime explicitly:** Edge runtime doesn't support `request.text()` with raw body access needed for HMAC signature verification. `export const runtime = "nodejs"` is required on both webhook routes.
- **`lib/video-storage.ts` as shared module:** Both the webhook handler and the polling fallback in `/api/generate` call `downloadAndStoreVideoFromOpenAI` — extracting this prevents duplication and ensures consistent storage behavior.
- **`lib/products.ts` as pricing single source of truth:** Credit costs for each model live here. If pricing changes, one file changes — not scattered across route handlers.

## Architectural Patterns

### Pattern 1: Optimistic Credit Deduction with Rollback

**What:** Deduct credits before the expensive external API call. Roll back on failure.
**When to use:** Any time a transactional credit purchase triggers an external async job.
**Trade-offs:** Simpler than two-phase commit. Risk of "phantom deduction" if rollback fails (mitigation: idempotent refund logic checked by job_id).

```typescript
// Deduct first
await supabase.from("users").update({ credits: user.credits - creditCost }).eq("id", userId);

// Call external API
try {
  const result = await callOpenAI(prompt);
  // success path
} catch (err) {
  // Refund on failure
  await supabase.from("users").update({ credits: user.credits }).eq("id", userId);
  return error;
}
```

**Critical gap in current code:** Rollback uses `user.credits` (value captured at request start), not `user.credits - creditCost + creditCost`. This is correct only if no concurrent deductions occur between read and write. For single-user accounts at low scale, this is fine. At scale, use a `credits - creditCost` atomic decrement on a DB function.

### Pattern 2: Dual Async Completion (Push Webhook + Pull Polling)

**What:** Primary completion path is OpenAI webhook push (`/api/webhook/video-complete`). Fallback is background polling inside the generation request. Both paths converge on `downloadAndStoreVideoFromOpenAI`.
**When to use:** Any async job with an unreliable or unconfirmed webhook delivery.
**Trade-offs:** Redundancy means double-storage risk if both paths complete for the same video. Mitigation: add idempotency check before writing to Supabase Storage (check if `video_url` is already set).

```
User hits /api/generate
    │
    ├─ OpenAI responds with { id: soraVideoId, status: "processing" }
    │       │
    │       ├─ Start background pollVideoStatus() ← FALLBACK
    │       │
    │       └─ Return { videoId, status: "processing" } to client
    │
    └─ [Later] OpenAI POSTs to /api/webhook/video-complete ← PRIMARY
            │
            └─ downloadAndStoreVideoFromOpenAI(videoId, soraVideoId, userId)
```

**Recommendation:** Add an idempotency guard in `downloadAndStoreVideoFromOpenAI`: check if `video_url IS NOT NULL` before downloading. This prevents duplicate storage writes when both paths fire.

### Pattern 3: Raw Body Webhook Route (Node.js Runtime)

**What:** Webhook routes must read the raw request body before JSON parsing to compute HMAC-SHA256 signature. Next.js default body parsing destroys the raw body.
**When to use:** Any route that receives signed webhooks (OpenAI, Stripe).
**Trade-offs:** Requires `export const runtime = "nodejs"` — cannot use Edge runtime. Slightly slower cold start.

```typescript
// REQUIRED at top of webhook route files:
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In handler:
const body = await request.text();  // raw body preserved
const signature = request.headers.get("openai-signature");
const isValid = verifyHMAC(body, signature, secret);
// THEN parse JSON:
const parsed = JSON.parse(body);
```

### Pattern 4: Video Proxy Route for Stable URLs

**What:** Videos are served through `/api/video/[videoId]/content` rather than raw Supabase Storage URLs. The proxy validates session, fetches the file from Storage, and streams it.
**When to use:** Any file stored in Supabase Storage that requires auth-gated access and stable URLs.
**Trade-offs:** Every video play hits a serverless function — adds latency vs. direct CDN URL. Supabase Storage signed URLs expire; proxy URLs never expire as long as the session is valid.

## Data Flow

### Video Generation Flow (Happy Path)

```
User submits prompt
    ↓
POST /api/generate (formData: prompt, model, duration, image?)
    ↓
[1] Verify Supabase session → get user.credits
[2] Calculate creditCost from lib/products.ts
[3] Check credits >= cost (402 if not)
[4] Fetch active prefix from video_prompt_settings table → build finalPrompt
[5] Deduct credits atomically (UPDATE users SET credits = credits - cost)
[6] INSERT video_history { status: "processing" }
[7] POST to OpenAI /v1/videos (JSON or multipart/form-data if image)
    ↓ OpenAI returns { id: soraVideoId, status: "processing" }
[8] UPDATE video_history SET job_id = soraVideoId
[9] Launch background pollVideoStatus() (fire-and-forget)
[10] Return { videoId, status: "processing" } to client
    ↓
Client polls /api/video/status?videoId=X every N seconds
    ↓
[ASYNC] OpenAI POSTs to /api/webhook/video-complete
    [A] Verify HMAC-SHA256 signature (OpenAI-Signature + OpenAI-Timestamp headers)
    [B] Validate timestamp within 5-minute window (replay attack prevention)
    [C] Lookup video_history by job_id = soraVideoId
    [D] UPDATE video_history SET status = "completed"
    [E] downloadAndStoreVideoFromOpenAI:
        - GET /v1/videos/{soraVideoId} → get video download URL
        - Fetch video binary
        - Upload to Supabase Storage at users/{userId}/videos/{videoId}.mp4
        - UPDATE video_history SET video_url = supabase_url, status = "completed"
    ↓
Client sees status = "completed", plays video via /api/video/{id}/content
```

### Payment → Credit Allocation Flow

```
User clicks "Buy Credits"
    ↓
POST /api/checkout/create-session → Stripe Embedded Checkout session
    ↓
Stripe Embedded Checkout renders in modal (no page redirect)
    ↓
User completes payment
    ↓
Stripe POSTs to /api/webhook/stripe
    [A] Verify Stripe signature (raw body + Stripe-Signature header)
    [B] Handle checkout.session.completed event
    [C] Extract credit amount from session metadata
    [D] UPDATE users SET credits = credits + amount
    [E] INSERT credit_transactions record
    ↓
Client-side payment-success-handler detects success → refresh credit balance
```

### Auth Session Flow

```
Every request
    ↓
middleware.ts (Edge)
    ↓
lib/supabase/middleware.ts → refreshSession() via Supabase SSR
    ↓
Route handler uses createClient() from lib/supabase/server.ts
    (reads refreshed cookies, creates per-request Supabase client)
    ↓
supabase.auth.getUser() → validated session
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 users | Current architecture is fine. Monitor Supabase free tier limits (50MB DB, 1GB Storage). |
| 500–5K users | Storage costs become real. Add Supabase Storage CDN or move to Cloudflare R2 + public bucket behind signed tokens. Video proxy route will be hot — add caching headers. |
| 5K–50K users | Credit deduction needs atomic DB function to prevent race conditions on concurrent requests. Webhook delivery reliability must be confirmed — add a dead-letter queue or cron-based reconciliation for stuck "processing" videos. |
| 50K+ users | Separate video storage from Supabase (dedicated CDN). Consider edge caching for `/api/video/[videoId]/content`. Database read replicas for user data queries. |

### Scaling Priorities

1. **First bottleneck — Supabase Storage bandwidth:** Every video play proxies through a serverless function. At volume, this exhausts egress limits and adds latency. Fix: generate short-lived Supabase signed URLs cached in Redis, or move videos to a CDN.
2. **Second bottleneck — Credit race conditions:** At high concurrency, two requests from the same user can both read `user.credits = 10` and both deduct, leaving the user at 0 when they should be at -cost. Fix: use a Postgres function with `UPDATE users SET credits = credits - $cost WHERE credits >= $cost` and check rows-affected.
3. **Third bottleneck — Webhook reliability:** If OpenAI webhook fails to deliver, the polling fallback runs inside the original serverless function for up to 5 minutes (60 × 5s). Vercel serverless functions time out at 10s (Hobby) or 60s (Pro). Fix: move polling to a separate long-running job (Vercel Cron + status check) or use a queue.

## Anti-Patterns

### Anti-Pattern 1: Polling Inside the HTTP Response

**What people do:** Call `pollVideoStatus()` inside the `/api/generate` handler and wait for completion before responding (blocking the request for minutes).
**Why it's wrong:** Serverless functions time out (10s on Vercel Hobby, 60s on Pro). Video generation takes 30s–5min. The connection will drop.
**Do this instead:** Fire-and-forget polling (`pollVideoStatus().catch(console.error)`) and return `{ status: "processing" }` immediately. Let the client poll `/api/video/status` for updates, or rely on the webhook push.

### Anti-Pattern 2: Using Edge Runtime on Webhook Routes

**What people do:** Leave webhook routes on the default Edge runtime (or not specifying `export const runtime = "nodejs"`).
**Why it's wrong:** Edge runtime provides a Web-compatible `Request` but the body stream can only be consumed once. When Next.js middleware reads it for routing, the raw body is gone. HMAC signature verification fails.
**Do this instead:** `export const runtime = "nodejs"` on every webhook route. Read body with `await request.text()` before any other parsing.

### Anti-Pattern 3: Storing Supabase Storage URLs as the Canonical Video URL

**What people do:** Save the raw Supabase Storage URL (with expiring signed token) as `video_url` in the database.
**Why it's wrong:** Supabase signed URLs expire (default 1 hour). Videos in history become unplayable.
**Do this instead:** Store only the path (`users/{userId}/videos/{videoId}.mp4`) or use the proxy route `/api/video/[videoId]/content` as the canonical URL. The proxy re-fetches a fresh signed URL on each request.

### Anti-Pattern 4: Skipping Idempotency on Webhook Handlers

**What people do:** Process every webhook event unconditionally, including retries.
**Why it's wrong:** Stripe and OpenAI both retry webhooks on non-2xx responses. A failed storage write returns 500 → OpenAI retries → double credit deduction or double storage write.
**Do this instead:** Check `video_history.video_url IS NOT NULL` before downloading. For Stripe: check `credit_transactions` for existing `stripe_payment_intent_id` before crediting.

### Anti-Pattern 5: Hardcoding Credit Costs in Route Handlers

**What people do:** Scatter `const cost = 10` in the generate route instead of deriving from a central config.
**Why it's wrong:** When pricing changes, multiple files need updates and can drift out of sync.
**Do this instead:** The current `lib/products.ts` with `getCreditCost(model)` is the right pattern — keep all pricing here.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI Sora API | REST — `POST /v1/videos` (JSON or multipart), `GET /v1/videos/{id}` | No official SDK for Sora video; raw fetch only. API URL configurable via `OPENAI_API_URL` env var. |
| OpenAI Webhooks | Inbound push to `/api/webhook/video-complete` | HMAC-SHA256 with `OpenAI-Signature` + `OpenAI-Timestamp` headers. 5-min replay window enforced. Node.js runtime required. |
| Stripe | `POST /api/checkout/create-session` creates embedded session; inbound webhook at `/api/webhook/stripe` | Use `@stripe/stripe-js` + `stripe` npm packages. Stripe-Signature header verification. |
| Supabase Auth | Cookie-based SSR sessions via `@supabase/ssr`. Middleware refreshes sessions on every request. | DB trigger `on auth.users insert` auto-creates profile in `public.video_users`. |
| Supabase Storage | Used for permanent video storage. Access via signed URLs (server) or proxy route (client). | Bucket must be configured with RLS: users can only read their own folder. |
| n8n (optional) | `N8N_WEBHOOK_URL` env var — called as an async callback after video completion | Secondary completion path; not the primary. Can be used for notifications, post-processing triggers. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Page (RSC) ↔ API Routes | fetch() calls from client components | Server Components can call Supabase directly; prefer for initial data load |
| `lib/video-storage.ts` ↔ Webhook + Generate routes | Direct import | Both async completion paths share this module |
| `lib/products.ts` ↔ Generate route + UI | Direct import | Credit costs displayed in UI and enforced in API must stay in sync |
| Middleware ↔ `lib/supabase/middleware.ts` | Direct import | Session refresh must happen before any route handler reads the session |
| `app/actions/` ↔ Pages | Next.js Server Actions | Use for mutations where you want progressive enhancement without a full API route |

## Sources

- Next.js 15 App Router docs — official Next.js documentation on routing, server components, API routes, and middleware (HIGH confidence)
- Supabase SSR guide — `@supabase/ssr` package documentation on cookie-based sessions (HIGH confidence)
- Stripe Embedded Checkout docs — Stripe docs on client-side embedded checkout integration (HIGH confidence)
- OpenAI Sora API — inferred from actual API calls in codebase (`/v1/videos`, response shape `{ id, status }`)
- Actual codebase inspection — `app/api/webhook/video-complete/route.ts`, `app/api/generate/route.ts`, `lib/video-storage.ts`, project file tree (HIGH confidence — source of truth)

---
*Architecture research for: Video Generator Microsaas (Next.js + Supabase + Stripe + OpenAI Sora)*
*Researched: 2026-04-21*
