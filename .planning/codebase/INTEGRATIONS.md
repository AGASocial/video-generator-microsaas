# External Integrations

**Analysis Date:** 2026-04-21

## APIs & External Services

**AI Video Generation:**
- OpenAI Sora API - Generates videos from text prompts and optional reference images
  - SDK/Client: Native `fetch` (no SDK; direct HTTP calls)
  - Auth: `OPENAI_API_KEY` (Bearer token)
  - Base URL: `https://api.openai.com/v1/videos` (overrideable via `OPENAI_API_URL`)
  - Models: `sora-2` (1 credit), `sora-2-pro` (3 credits), `sora-2-pro-HD` (3 credits)
  - Endpoints used:
    - `POST /v1/videos` — submit generation job (JSON or multipart/form-data with `input_reference` image)
    - `GET /v1/videos/{soraVideoId}` — poll job status
    - `GET /v1/videos/{soraVideoId}/content` — download completed video binary
  - Implementation: `app/api/generate/route.ts`, `lib/video-storage.ts`, `app/api/video/[videoId]/content/route.ts`

**Payment Processing:**
- Stripe - One-time credit package purchases
  - SDK/Client: `stripe` npm package; client initialized in `lib/stripe.ts`
  - Auth: `STRIPE_SECRET_KEY` (server-side only, via `server-only` guard)
  - Frontend: `@stripe/react-stripe-js` + `@stripe/stripe-js` (embedded checkout mode)
  - Two checkout flows:
    1. **Embedded** (`app/api/checkout/create-session/route.ts`): `ui_mode: "embedded"`, returns `clientSecret`
    2. **Redirect** (`app/api/checkout/payment-link/route.ts`): standard checkout session with `success_url`/`cancel_url`
  - Session metadata always includes: `userId`, `packageId`, `credits`
  - `client_reference_id` set to Supabase user UUID for user lookup in webhook

**Analytics:**
- Google Analytics 4 — hardcoded measurement ID `G-WQ020FXKLE` in `components/google-analytics.tsx`; loaded in `app/layout.tsx`
- Vercel Web Analytics — `@vercel/analytics/next` `<Analytics />` component in `app/[locale]/layout.tsx`

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, cookie-based auth)
  - Service role: `SUPABASE_SERVICE_ROLE_KEY` (server-only; used in Stripe webhook to bypass RLS)
  - Client (server): `lib/supabase/server.ts` — `createServerClient` from `@supabase/ssr`
  - Client (browser): `lib/supabase/client.ts` — `createBrowserClient` from `@supabase/ssr`
  - Client (middleware): `lib/supabase/middleware.ts` — session refresh on every request
  - Tables:
    - `public.users` — `id` (FK auth.users), `email`, `credits`, `theme_preference`, `created_at`
    - `public.video_history` — `id`, `user_id`, `prompt`, `image_url`, `video_url`, `duration`, `model`, `status`, `job_id` (stores OpenAI Sora video ID), `created_at`
    - `public.transactions` — `id`, `user_id`, `amount`, `credits_purchased`, `stripe_session_id`, `status`, `created_at`
    - `public.prompt_settings` — `prefix_prompt`, `is_active`, `created_at` (admin-configurable prompt prefix)
  - Row Level Security (RLS) enabled on all tables; users can only access their own rows
  - Migrations: `scripts/001_create_tables.sql` through `scripts/009_update_default_theme_to_christmas.sql`

**File Storage:**
- Supabase Storage
  - Bucket: `videos` (created in `scripts/006_create_videos_bucket.sql`)
  - Path convention: `{user_id}/{video_id}.mp4`
  - Videos downloaded from OpenAI and re-uploaded here via `lib/video-storage.ts`
  - Public URLs served directly from Supabase Storage CDN
  - Fallback: if Supabase upload fails, proxy via `app/api/video/[videoId]/content/route.ts`

**Caching:**
- None — no Redis, Memcached, or in-memory cache layer detected

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: email/password only (no OAuth detected)
  - Sign-up: `app/api/auth/signup/route.ts` → `supabase.auth.signUp()`; email redirect via `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` or `{origin}/generate`
  - Sign-in: `app/api/auth/login/route.ts` → `supabase.auth.signInWithPassword()`
  - Sign-out: `app/api/auth/signout/route.ts`
  - Session management: Supabase SSR cookie-based sessions, refreshed in `middleware.ts`
  - Auth callback page: `app/[locale]/auth/callback/page.tsx` (handles PKCE code exchange)
  - Protected routes: `/generate`, `/profile` (enforced in `lib/supabase/middleware.ts`)
  - Unauthenticated redirect: `/{locale}/auth/login?redirect={originalPath}`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or similar detected)

**Logs:**
- `console.log` / `console.error` throughout — no structured logging library
- Verbose webhook debug logging in `app/api/webhook/stripe/route.ts` and `app/api/webhook/video-complete/route.ts`

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from `@vercel/analytics` and `build:prod` script)

**CI Pipeline:**
- None detected (no `.github/workflows/`, no CI config files)

## Environment Configuration

**Required env vars:**

| Variable | Used In | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase clients | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Supabase clients | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Stripe webhook, user actions | Bypass RLS for server-side ops |
| `OPENAI_API_KEY` | `app/api/generate/route.ts`, `lib/video-storage.ts` | OpenAI Sora video generation |
| `OPENAI_API_URL` | `app/api/generate/route.ts` | Override OpenAI base URL (optional; defaults to `https://api.openai.com/v1/videos`) |
| `OPENAI_WEBHOOK_SECRET` | `app/api/webhook/video-complete/route.ts` | HMAC-SHA256 verification of OpenAI webhook events |
| `OPENAI_WEBHOOK_SKIP_VERIFICATION` | `app/api/webhook/video-complete/route.ts` | Set `"true"` to bypass signature check (dev only) |
| `STRIPE_SECRET_KEY` | `lib/stripe.ts` | Stripe server-side API key |
| `STRIPE_WEBHOOK_SECRET` | `app/api/webhook/stripe/route.ts` | Stripe webhook signature verification |
| `NEXT_PUBLIC_APP_URL` | `lib/api-client.ts` | Canonical app URL for absolute URL construction |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | `app/api/auth/signup/route.ts` | Email confirmation redirect override for dev |

**Secrets location:**
- `.env.dev` (development) and `.env.prod` (production) at project root
- Both files are gitignored

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhook/stripe` — Stripe `checkout.session.completed` event; deduplication via `transactions.stripe_session_id`; adds credits to user account; implementation: `app/api/webhook/stripe/route.ts`
- `POST /api/webhook/video-complete` — OpenAI `video.completed` / `video.failed` events; HMAC-SHA256 signature verified using `OPENAI_WEBHOOK_SECRET`; triggers video download from OpenAI and upload to Supabase Storage; implementation: `app/api/webhook/video-complete/route.ts`

**Outgoing:**
- OpenAI Sora API (`https://api.openai.com/v1/videos`) — video generation jobs
- Stripe API — checkout session creation, customer retrieval, session expansion for line items

**Video Completion Strategy (dual-path):**
1. Webhook (`/api/webhook/video-complete`): preferred — OpenAI pushes completion event
2. Polling fallback (`pollVideoStatus` in `app/api/generate/route.ts`): background polling every 5s, up to 60 attempts (5 minutes), runs as fire-and-forget after generation request

---

*Integration audit: 2026-04-21*
