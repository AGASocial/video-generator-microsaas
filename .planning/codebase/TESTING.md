# Testing Patterns

**Analysis Date:** 2026-04-21

## Test Framework

**Runner:** None installed

**Assertion Library:** None

**Test files found:** Zero — no `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files exist in the repository.

**Test config files:** None — no `jest.config.*`, `vitest.config.*`, or similar found.

**devDependencies audit:** No testing libraries in `package.json`. devDependencies contain only:
- TypeScript type definitions (`@types/node`, `@types/react`, `@types/react-dom`)
- Build tooling (`tailwindcss`, `postcss`, `@tailwindcss/postcss`, `tw-animate-css`)
- Dev utilities (`dotenv-cli`)

## What Exists Instead

The project uses a **manual QA checklist** at `TESTING_CHECKLIST.md` (project root) that defines:

- Pre-testing environment setup steps (database migrations, env vars, Stripe CLI)
- Manual test flows for auth, credits, video generation, and payment links
- Known configuration considerations

This is a human-executed checklist, not automated tests.

## Coverage

**Requirements:** None enforced — no coverage tooling configured.

**Coverage report:** Not applicable.

## Test Types

**Unit Tests:** Not present

**Integration Tests:** Not present

**E2E Tests:** Not present

**Manual Testing:** Defined in `TESTING_CHECKLIST.md`

## Adding Tests — Recommended Approach

If tests are introduced, the natural fit given the existing stack is:

**Unit/Integration: Vitest**
```bash
pnpm add -D vitest @vitejs/plugin-react
```
Config would be `vitest.config.ts` at project root.

**E2E: Playwright**
```bash
pnpm add -D @playwright/test
```

**Test file placement convention to adopt** (co-location is standard for Next.js):
```
lib/api-client.test.ts       # alongside lib/api-client.ts
components/video-list.test.tsx
app/api/generate/route.test.ts
```

**Critical paths that need tests first** (based on TESTING_CHECKLIST.md manual flows):
1. Credit deduction logic in `app/api/generate/route.ts`
2. Stripe webhook credit addition in `app/api/webhook/stripe/route.ts`
3. `lib/api-client.ts` — `getCurrentUser`, `getRecentVideos` fetch helpers
4. `lib/products.ts` — `getCreditCost` function (pure function, easiest entry point)

## Mocking

No mocking framework is present. If Vitest is added, `vi.mock()` would be the natural approach for:
- Supabase client (`@/lib/supabase/server`)
- `fetch` calls to OpenAI API
- Stripe SDK (`@/lib/stripe`)

---

*Testing analysis: 2026-04-21*
