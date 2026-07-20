# Technology Stack

**Analysis Date:** 2026-04-21

## Languages

**Primary:**
- TypeScript 5.x - All application code (`app/`, `lib/`, `components/`, `hooks/`)
- SQL - Database migrations (`scripts/*.sql`)

**Secondary:**
- JavaScript - Build scripts (`scripts/generate-theme-registry.js`)

## Runtime

**Environment:**
- Node.js v22 (detected on dev machine; no `.nvmrc` present — version not pinned)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js 16.0.10 - Full-stack React framework (App Router, Server Components, Route Handlers)
- React 19.2.0 - UI library
- next-intl 4.5.5 - Internationalization with locale-aware routing (`es`/`en`, default: `es`)

**UI Components:**
- Radix UI (full suite, ~20 primitives) - Headless accessible components
- shadcn/ui pattern - Radix primitives wired to Tailwind via `class-variance-authority`
- Tailwind CSS 4.1.9 - Utility CSS (v4, PostCSS plugin via `@tailwindcss/postcss`)
- next-themes 0.4.6 - Dark/light/custom theme switching
- lucide-react 0.454.0 - Icon library

**Forms & Validation:**
- react-hook-form 7.60.0 - Form state management
- @hookform/resolvers 3.10.0 - Zod adapter for react-hook-form
- Zod 3.25.76 - Runtime schema validation

**Data Display:**
- recharts 2.15.4 - Chart library
- embla-carousel-react 8.5.1 - Carousel
- react-day-picker 9.8.0 - Date picker
- react-resizable-panels 2.1.7 - Resizable layouts

**Utilities:**
- date-fns 4.1.0 - Date manipulation
- clsx 2.1.1 + tailwind-merge 2.5.5 - Conditional class merging
- sonner 1.7.4 - Toast notifications
- react-easy-crop 5.5.5 - Image cropping UI
- react-snowfall 2.3.0 - Decorative snowfall effect

**Build/Dev:**
- TypeScript compiler (tsc, no emit — `noEmit: true`)
- dotenv-cli 7.4.4 - Environment-specific dev server (`npm run dev` loads `.env.dev`)
- tsx - TypeScript script runner (used in `setup-stripe-webhook.ts`)

## Key Dependencies

**Critical:**
- `@supabase/ssr` (latest) + `@supabase/supabase-js` (latest) - Database, auth, and file storage client. Two client modes: browser (`lib/supabase/client.ts`) and server (`lib/supabase/server.ts`)
- `stripe` (latest) - Stripe Node.js SDK for checkout session creation and webhook verification (`lib/stripe.ts`)
- `@stripe/react-stripe-js` + `@stripe/stripe-js` (latest) - Frontend Stripe Elements (embedded checkout)
- `server-only` (latest) - Compile-time guard preventing server modules from loading in browser bundles
- `next-intl` 4.5.5 - All routes are locale-prefixed (`/es/...`, `/en/...`)

**Infrastructure:**
- `@vercel/analytics` (latest) - Vercel Web Analytics injected in `app/[locale]/layout.tsx`

## Configuration

**Environment:**
- Two env files present: `.env.dev` (development), `.env.prod` (production)
- Loaded via `dotenv-cli`: `npm run dev` → `.env.dev`, `npm run dev:prod` / `npm run build:prod` → `.env.prod`
- No `.env.example` detected — see INTEGRATIONS.md for required variable names

**TypeScript:**
- Config: `tsconfig.json`
- Strict mode enabled (`"strict": true`)
- Path alias: `@/*` maps to project root
- Module resolution: `bundler`
- Target: ES6

**Build:**
- Config: `next.config.mjs`
- `typescript.ignoreBuildErrors: true` — TypeScript errors do not fail the build
- `images.unoptimized: true` — Next.js Image Optimization disabled
- Wrapped with `createNextIntlPlugin()` for i18n route awareness
- Prebuild hook: `npm run generate:themes` runs `scripts/generate-theme-registry.js`

**PostCSS:**
- Config: `postcss.config.mjs`
- Plugin: `@tailwindcss/postcss` (Tailwind v4 integration)

## Platform Requirements

**Development:**
- Node.js 22+
- `.env.dev` file with all required secrets (see INTEGRATIONS.md)
- `npm run dev` starts Next.js dev server with dev environment

**Production:**
- Deployment target: Vercel (inferred from `@vercel/analytics` dependency and `npm run build:prod`)
- Runtime: Node.js (webhook routes declare `export const runtime = "nodejs"`)

---

*Stack analysis: 2026-04-21*
