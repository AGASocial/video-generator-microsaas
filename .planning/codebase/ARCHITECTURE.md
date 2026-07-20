# Architecture

**Analysis Date:** 2026-04-21

## Pattern Overview

**Overall:** Next.js 14 App Router with internationalized routing, server-first rendering, and API-layer separation

**Key Characteristics:**
- All pages under `app/[locale]/` for i18n support via `next-intl` (locales: `es`, `en`, default: `es`)
- Server Components handle data fetching via `lib/api-client.ts`; Client Components handle interactivity
- API routes (`app/api/`) serve as the backend layer — all DB access goes through these routes or Server Actions
- Two Supabase clients: `lib/supabase/server.ts` (RSC/API routes, cookie-based) and `lib/supabase/client.ts` (browser, OAuth/PKCE only)
- Webhooks for Stripe (`app/api/webhook/stripe/route.ts`) and OpenAI (`app/api/webhook/video-complete/route.ts`) handle async completion events

## Layers

**Presentation Layer (Server Components):**
- Purpose: Render UI, fetch data, enforce auth redirects
- Location: `app/[locale]/*/page.tsx`
- Contains: Async server components, `getTranslations`, calls to `lib/api-client.ts`
- Depends on: `lib/api-client.ts`, `lib/types.ts`, `components/`
- Used by: Browser / Next.js router

**Presentation Layer (Client Components):**
- Purpose: Interactive UI — forms, state, polling, client-side navigation
- Location: `components/*.tsx` (files with `"use client"` directive)
- Contains: `VideoGeneratorForm`, `Navigation`, `CreditPackages`, `PaymentSuccessHandler`, `ImageCropper`
- Depends on: API routes via `fetch`, `hooks/`, `lib/products.ts`, shadcn/ui in `components/ui/`
- Used by: Server component pages that embed them as children

**API Layer:**
- Purpose: Backend endpoints that read/write Supabase; the only layer that directly uses `lib/supabase/server.ts`
- Location: `app/api/*/route.ts`
- Contains: Route handlers for user, video, auth, checkout, webhook
- Depends on: `lib/supabase/server.ts`, `lib/products.ts`, `lib/video-storage.ts`, `lib/stripe.ts`
- Used by: Server components (via `lib/api-client.ts`), client components (via `fetch`), external services (Stripe/OpenAI webhooks)

**Server Actions:**
- Purpose: Mutation operations callable from both Server and Client Components
- Location: `app/actions/stripe.ts`, `app/actions/user.ts`
- Contains: `startCheckoutSession`, `ensureUserExists`
- Depends on: `lib/supabase/server.ts`, `lib/stripe.ts`, `lib/products.ts`
- Used by: Client components (`CreditPackages` calls `startCheckoutSession`)

**Library/Utilities Layer:**
- Purpose: Shared logic, type definitions, external SDK clients
- Location: `lib/`
- Contains: `api-client.ts`, `types.ts`, `products.ts`, `stripe.ts`, `video-storage.ts`, `image-utils.ts`, `utils.ts`, `supabase/`
- Depends on: External SDKs (Supabase, Stripe)
- Used by: API routes, server components, server actions, client components

## Data Flow

**Video Generation Flow:**

1. User fills `VideoGeneratorForm` (client component) with prompt, duration, model, optional image
2. Client submits `FormData` via `fetch` to `POST /api/generate`
3. `app/api/generate/route.ts` validates auth via `lib/supabase/server.ts`
4. Checks user credits in Supabase `users` table, deducts credits
5. Creates `video_history` row with `status: "processing"`
6. Sends request to OpenAI Sora API (`https://api.openai.com/v1/videos`)
7a. If OpenAI returns `status: "completed"` synchronously → calls `downloadAndStoreVideoFromOpenAI` → stores MP4 in Supabase Storage `videos` bucket under `{user_id}/{video_id}.mp4`
7b. If `status: "processing"` → spawns background `pollVideoStatus` loop (5s intervals, max 60 attempts)
8. Webhook `POST /api/webhook/video-complete` receives `video.completed` / `video.failed` events from OpenAI as alternative completion path
9. Client polls `GET /api/video/status?videoId=X` every few seconds until `status === "completed"` or `"failed"`
10. On completion, client displays video from Supabase Storage public URL

**Payment / Credits Flow:**

1. User visits `app/[locale]/credits/page.tsx` (server component), rendered with current credit balance
2. Clicks buy → `CreditPackages` client component calls `startCheckoutSession` server action
3. Server action creates Stripe embedded checkout session, returns `client_secret`
4. Client renders Stripe embedded checkout UI
5. On payment, Stripe sends `checkout.session.completed` event to `POST /api/webhook/stripe`
6. Webhook (uses Supabase service role to bypass RLS) adds credits to `users.credits` and inserts `transactions` row

**Authentication Flow:**

1. User visits `app/[locale]/auth/login/page.tsx` (client component)
2. OAuth via `lib/supabase/client.ts` (browser client, required for PKCE code verifier)
3. Callback at `app/[locale]/auth/callback/page.tsx` exchanges code for session
4. `middleware.ts` runs `next-intl` middleware first (locale negotiation), then `lib/supabase/middleware.ts` (session refresh/redirect for unauthenticated routes)

**State Management:**
- No global client-side state library. Server components fetch fresh data on each render.
- Client components use React `useState` / `useEffect` for local UI state (form fields, polling timers)
- Auth state managed entirely by Supabase SSR cookies; refreshed in `middleware.ts`

## Key Abstractions

**`lib/api-client.ts`:**
- Purpose: HTTP client for Server Components to call API routes with forwarded cookies
- Examples: `getCurrentUser()`, `getUserVideos()`, `getRecentVideos()`, `getUserTransactions()`
- Pattern: Constructs absolute URL from headers/env, manually forwards cookie header, returns `{ success, data?, error? }`

**`lib/supabase/server.ts` vs `lib/supabase/client.ts`:**
- `server.ts`: Used in API routes, Server Actions, Server Components. Reads cookies via `next/headers`.
- `client.ts`: Used only for OAuth flows and auth callbacks. Browser-only. Not for DB queries.
- Pattern: Always import from the correct module. DB queries from client components must go through API routes.

**`lib/video-storage.ts`:**
- Purpose: Download video from OpenAI and upload to Supabase Storage, update DB record
- Functions: `downloadAndStoreVideo()`, `downloadAndStoreVideoFromOpenAI()`
- Pattern: Called by both `app/api/generate/route.ts` (sync completion) and `app/api/webhook/video-complete/route.ts` (async webhook)

**`lib/products.ts`:**
- Purpose: Single source of truth for credit packages and per-model credit costs
- Exports: `CREDIT_PACKAGES`, `CREDIT_COSTS`, `getCreditCost(model)`
- Used by: generate route (credit deduction), Stripe webhook (package lookup), Credits page, checkout form

**Themes System:**
- Purpose: Dynamic CSS variable injection per user theme preference
- Location: `themes/` (default, christmas), `themes/index.ts`, `themes/registry.ts`
- Client component `ThemeInjector` reads theme preference from `hooks/use-theme-preference.ts` and injects CSS vars at runtime

## Entry Points

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: All page requests
- Responsibilities: Sets `<html lang="es">`, loads fonts (Inter, JetBrains Mono), mounts `GoogleAnalytics`

**Locale Layout:**
- Location: `app/[locale]/layout.tsx`
- Triggers: All localized page requests
- Responsibilities: Validates locale, provides `NextIntlClientProvider` with messages, wraps children in `ThemeProvider` and `Toaster`, mounts Vercel `Analytics`

**Root Page:**
- Location: `app/page.tsx`
- Triggers: Direct visit to `/`
- Responsibilities: Immediately redirects to `/{defaultLocale}` (i.e., `/es`)

**Middleware:**
- Location: `middleware.ts`
- Triggers: Every non-API, non-static request
- Responsibilities:
  1. Skips API routes entirely
  2. Runs `next-intl` middleware for locale prefix handling
  3. Runs `lib/supabase/middleware.ts` to refresh sessions and redirect unauthenticated users
  4. Preserves locale prefix on Supabase auth redirects

## Error Handling

**Strategy:** Each layer handles its own errors and returns structured responses.

**Patterns:**
- API routes return `NextResponse.json({ error: string }, { status: N })`
- `lib/api-client.ts` returns `{ success: false, error: string }` on any failure (never throws)
- Server Component pages receive error objects and either redirect or render an error card
- Client components catch fetch errors in `try/catch`, set local error state, display inline alerts
- Credit deduction is reversed (refund) if OpenAI API call fails in `app/api/generate/route.ts`
- Stripe webhook uses idempotency check (`transactions` table lookup by `stripe_session_id`) before processing

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error` with `[ContextTag]` prefix (e.g., `[Generate]`, `[Webhook]`, `[Video Storage]`, `[API Client]`). No structured logging library.

**Validation:** Input validation inline in route handlers (missing fields return 400). No dedicated validation library (e.g., Zod).

**Authentication:** Supabase Auth with SSR cookie-based sessions. Middleware enforces session refresh. Protected API routes call `supabase.auth.getUser()` as first step. Protected pages call `getCurrentUser()` and `redirect()` if unauthenticated.

**Internationalization:** `next-intl` with `locales: ['es', 'en']`, default `es`. Messages in `messages/es.json` and `messages/en.json`. Server components use `getTranslations()`, client components use `useTranslations()`.

---

*Architecture analysis: 2026-04-21*
