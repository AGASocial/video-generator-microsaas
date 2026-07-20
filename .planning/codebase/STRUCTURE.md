# Codebase Structure

**Analysis Date:** 2026-04-21

## Directory Layout

```
video-generator-microsaas/
├── app/                        # Next.js App Router root
│   ├── [locale]/               # All user-facing pages (locale-prefixed)
│   │   ├── layout.tsx          # Locale layout: i18n provider, ThemeProvider, Toaster
│   │   ├── page.tsx            # Landing / home page (server component)
│   │   ├── generate/
│   │   │   └── page.tsx        # Video generation page (protected, server component)
│   │   ├── credits/
│   │   │   └── page.tsx        # Credits & payment page (protected, server component)
│   │   ├── profile/
│   │   │   └── page.tsx        # User profile page (server component)
│   │   └── auth/
│   │       ├── login/page.tsx      # Login page (client component)
│   │       ├── sign-up/page.tsx    # Sign-up page (client component)
│   │       ├── callback/page.tsx   # OAuth callback handler (client component)
│   │       └── error/              # Auth error display
│   ├── api/                    # Backend API routes (no locale prefix)
│   │   ├── generate/route.ts       # POST: video generation via OpenAI Sora
│   │   ├── user/
│   │   │   ├── route.ts            # GET: current user data
│   │   │   ├── credits/route.ts    # GET: user credits
│   │   │   ├── theme/route.ts      # GET/POST: theme preference
│   │   │   ├── transactions/route.ts # GET: transaction history
│   │   │   └── videos/
│   │   │       ├── route.ts        # GET: video history (filterable)
│   │   │       └── recent/route.ts # GET: recent completed/processing videos
│   │   ├── video/
│   │   │   ├── status/route.ts     # GET: poll video status by videoId
│   │   │   └── [videoId]/
│   │   │       └── content/route.ts # GET: proxy video content from OpenAI (fallback)
│   │   ├── checkout/
│   │   │   ├── create-session/route.ts  # POST: create Stripe checkout session
│   │   │   ├── payment-link/route.ts    # POST: Stripe payment link
│   │   │   ├── verify-keys/route.ts     # GET: verify Stripe keys configured
│   │   │   └── verify-session/route.ts  # POST: verify Stripe session
│   │   ├── auth/
│   │   │   ├── login/route.ts      # POST: email/password login
│   │   │   ├── signup/route.ts     # POST: email/password signup
│   │   │   └── signout/route.ts    # POST: sign out (clears session)
│   │   ├── prompts/route.ts        # GET: predefined prompt templates
│   │   └── webhook/
│   │       ├── stripe/route.ts         # POST: Stripe checkout.session.completed
│   │       └── video-complete/route.ts # POST: OpenAI video.completed / video.failed
│   ├── actions/                # Next.js Server Actions
│   │   ├── stripe.ts           # startCheckoutSession()
│   │   └── user.ts             # ensureUserExists()
│   ├── auth/                   # Legacy auth pages (non-locale, kept for compatibility)
│   │   ├── login/page.tsx
│   │   ├── sign-up/page.tsx
│   │   └── sign-up-success/
│   ├── credits/page.tsx        # Legacy credits page (non-locale)
│   ├── profile/page.tsx        # Legacy profile page (non-locale)
│   ├── layout.tsx              # Root layout: html/body, fonts, GoogleAnalytics
│   ├── page.tsx                # Root page: redirects to /{defaultLocale}
│   └── globals.css             # Global CSS, Tailwind base, CSS variables
├── components/                 # Shared React components
│   ├── ui/                     # shadcn/ui primitives (button, card, dialog, etc.)
│   ├── video-generator-form.tsx    # Main form for video creation (client)
│   ├── video-list.tsx              # Grid of video cards (client)
│   ├── video-history-filters.tsx   # Filter controls for video history (client)
│   ├── navigation.tsx              # Top nav bar with auth/credits (client)
│   ├── credit-packages.tsx         # Pricing cards + Stripe checkout (client)
│   ├── payment-success-handler.tsx # Reads ?payment_success param, shows toast (client)
│   ├── image-cropper.tsx           # Image crop UI for video reference images (client)
│   ├── theme-injector.tsx          # Injects CSS variables for active theme (client)
│   ├── theme-provider.tsx          # next-themes provider wrapper
│   ├── theme-selector.tsx          # UI to pick theme preference (client)
│   ├── language-switcher.tsx       # Locale toggle (client)
│   ├── locale-script.tsx           # Injects locale into window for scripts
│   ├── christmas-snow-effect.tsx   # Seasonal visual effect (client)
│   └── google-analytics.tsx        # GA4 script injection
├── lib/                        # Shared utilities and SDK clients
│   ├── supabase/
│   │   ├── server.ts           # Supabase client for Server Components / API routes
│   │   ├── client.ts           # Supabase browser client (OAuth only)
│   │   └── middleware.ts       # Session refresh logic for middleware.ts
│   ├── api-client.ts           # HTTP helpers for Server Components calling API routes
│   ├── types.ts                # TypeScript interfaces: User, VideoHistory, Transaction, VideoGenerationRequest
│   ├── products.ts             # CREDIT_PACKAGES, CREDIT_COSTS, getCreditCost()
│   ├── stripe.ts               # Stripe SDK client singleton
│   ├── video-storage.ts        # Download OpenAI video → upload to Supabase Storage
│   ├── image-utils.ts          # Image dimension helpers for cropping/resizing
│   └── utils.ts                # cn() Tailwind class merge utility
├── hooks/                      # React custom hooks
│   ├── use-theme-preference.ts # Read/write user theme preference (API-backed)
│   ├── use-toast.ts            # Toast notification hook
│   └── use-mobile.ts           # Viewport breakpoint detection
├── i18n/
│   └── routing.ts              # next-intl routing config (locales, defaultLocale, prefix)
├── messages/
│   ├── es.json                 # Spanish translations (default locale)
│   └── en.json                 # English translations
├── themes/
│   ├── types.ts                # ThemeConfig, ThemeColors interfaces
│   ├── index.ts                # getThemeCSSVariables() utility
│   ├── registry.ts             # getTheme(name) async loader
│   ├── default/                # Default theme CSS variables and constants
│   └── christmas/              # Christmas theme CSS variables and snow effect
├── scripts/                    # Database migrations and setup scripts
│   ├── 001_create_tables.sql   # users, video_history, transactions schema
│   ├── 002_create_user_trigger.sql
│   ├── 003_create_storage_bucket.sql
│   ├── 004_add_job_id_column.sql
│   ├── 005_add_users_insert_policy.sql
│   ├── 006_create_videos_bucket.sql
│   ├── 007_add_theme_preference_column.sql
│   ├── 008_create_prompt_tables.sql
│   ├── 009_update_default_theme_to_christmas.sql
│   ├── generate-theme-registry.js
│   └── setup-stripe-webhook.ts
├── public/                     # Static assets (icons, images)
├── styles/                     # Additional global styles
├── docs/                       # Internal documentation
├── middleware.ts               # Edge middleware: locale negotiation + auth session
├── next.config.mjs             # Next.js config with next-intl plugin
├── tsconfig.json               # TypeScript config, path alias @/* → ./*
├── components.json             # shadcn/ui component registry config
└── package.json                # Dependencies and scripts
```

## Directory Purposes

**`app/[locale]/`:**
- Purpose: All user-visible pages, locale-scoped. The `[locale]` segment is always present (even for default `es`).
- Contains: Server Component pages, Client Component auth pages
- Key files: `layout.tsx` (locale providers), `page.tsx` (home page), `generate/page.tsx` (core feature)

**`app/api/`:**
- Purpose: Backend REST API. No locale prefix. Accessed by server components and client components alike.
- Contains: `route.ts` files with HTTP method exports (`GET`, `POST`)
- Key files: `generate/route.ts` (core), `webhook/stripe/route.ts`, `webhook/video-complete/route.ts`

**`app/actions/`:**
- Purpose: Next.js Server Actions (marked `"use server"`). Used for mutations that need to be callable from client components without a full API route.
- Contains: `stripe.ts` (checkout), `user.ts` (user creation fallback)

**`components/ui/`:**
- Purpose: shadcn/ui primitives. Generated via `npx shadcn add`. Do not edit manually.
- Contains: 50+ component files (button, card, dialog, dropdown, table, etc.)

**`components/` (root):**
- Purpose: Application-specific components. All are Client Components (`"use client"`) except `theme-provider.tsx` and `google-analytics.tsx`.

**`lib/supabase/`:**
- Purpose: Supabase client factories. One for server (cookies), one for browser (PKCE), one for middleware (session refresh).
- Rule: Use `server.ts` in API routes and Server Actions. Use `client.ts` only for OAuth flows.

**`themes/`:**
- Purpose: Visual theme system with CSS variable overrides per theme.
- Contains: Theme configs (colors, radius), registry for async theme loading
- Key files: `index.ts` (CSS variable generator), `registry.ts` (theme loader), `types.ts` (interfaces)

**`scripts/`:**
- Purpose: SQL migrations applied manually to Supabase, numbered sequentially.
- Not executed at runtime. Run manually via Supabase dashboard or CLI.

**`messages/`:**
- Purpose: i18n translation strings for `next-intl`. One JSON file per locale.
- Key files: `es.json` (primary), `en.json`

## Key File Locations

**Entry Points:**
- `middleware.ts`: Edge middleware, runs on every non-API/non-static request
- `app/layout.tsx`: Root HTML shell with fonts and analytics
- `app/[locale]/layout.tsx`: i18n and theme providers
- `app/page.tsx`: Redirect from `/` to `/{defaultLocale}`

**Configuration:**
- `next.config.mjs`: Next.js + next-intl plugin configuration
- `tsconfig.json`: TypeScript with `@/*` path alias
- `i18n/routing.ts`: Supported locales and default locale
- `components.json`: shadcn/ui configuration

**Core Logic:**
- `app/api/generate/route.ts`: Video generation with OpenAI, credit deduction, polling
- `app/api/webhook/stripe/route.ts`: Stripe payment completion and credit top-up
- `app/api/webhook/video-complete/route.ts`: OpenAI async video completion handler
- `lib/video-storage.ts`: OpenAI → Supabase Storage video transfer
- `lib/products.ts`: Credit package definitions and model costs
- `lib/api-client.ts`: Server-side HTTP client with cookie forwarding

**Type Definitions:**
- `lib/types.ts`: `User`, `VideoHistory`, `Transaction`, `VideoGenerationRequest`
- `themes/types.ts`: `ThemeConfig`, `ThemeColors`, `CSSClassConstants`

**UI Components:**
- `components/video-generator-form.tsx`: Main form (largest component, ~25KB)
- `components/navigation.tsx`: Auth-aware nav with language switcher
- `components/credit-packages.tsx`: Pricing cards with Stripe embedded checkout

## Naming Conventions

**Files:**
- Pages: `page.tsx` (required by App Router convention)
- Layouts: `layout.tsx` (required by App Router convention)
- API routes: `route.ts` (required by App Router convention)
- Components: `kebab-case.tsx` (e.g., `video-generator-form.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-theme-preference.ts`)
- Libraries: `kebab-case.ts` (e.g., `api-client.ts`, `video-storage.ts`)
- SQL migrations: `NNN_description.sql` (sequential numbering)

**Directories:**
- API route groups: `kebab-case/` matching URL path segment
- Dynamic segments: `[paramName]/` (e.g., `[locale]/`, `[videoId]/`)

**Exports:**
- Components: Named exports matching PascalCase component name (e.g., `export function VideoGeneratorForm`)
- Utilities: Named exports (e.g., `export async function getCurrentUser`)
- Types: Named interface exports from `lib/types.ts`

## Where to Add New Code

**New User-Facing Page:**
- Implementation: `app/[locale]/{route-name}/page.tsx`
- If auth-protected: call `getCurrentUser()` at top, redirect to `/{locale}/auth/login?redirect=...` if unauthenticated
- Add translations in `messages/es.json` and `messages/en.json`

**New API Endpoint:**
- Implementation: `app/api/{resource}/route.ts`
- Auth: Always call `supabase.auth.getUser()` first for protected routes
- Use `lib/supabase/server.ts` for DB access

**New Shared Component:**
- Client component (interactive): `components/{component-name}.tsx` with `"use client"` at top
- Server component (display-only): `components/{component-name}.tsx` without directive
- shadcn/ui primitive: run `npx shadcn add {component}` → goes to `components/ui/`

**New Server Action:**
- File: `app/actions/{domain}.ts` with `"use server"` at top
- Use `lib/supabase/server.ts` for DB access

**New Hook:**
- File: `hooks/use-{name}.ts`
- Browser-only (reads DOM/localStorage) or API-backed (calls fetch)

**Database Schema Change:**
- Add numbered migration: `scripts/{NNN}_description.sql`
- Apply manually to Supabase; no automated migration runner

**New Theme:**
- Directory: `themes/{theme-name}/`
- Must export a `ThemeConfig` object conforming to `themes/types.ts`
- Register in `themes/registry.ts`

**New Translation Key:**
- Add to both `messages/es.json` and `messages/en.json`
- Access in server components: `const t = await getTranslations('namespace')`
- Access in client components: `const t = useTranslations('namespace')`

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents (phases, codebase maps, research)
- Generated: No
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No

**`components/ui/`:**
- Purpose: shadcn/ui generated primitive components
- Generated: Yes (via shadcn CLI)
- Committed: Yes (expected to be customized)

**`scripts/`:**
- Purpose: Database migration SQL files, run manually
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-21*
