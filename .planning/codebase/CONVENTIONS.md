# Coding Conventions

**Analysis Date:** 2026-04-21

## TypeScript Configuration

**Strict mode:** Enabled (`"strict": true` in `tsconfig.json`)

**Target:** ES6, module resolution: `bundler`

**Path aliases:**
- `@/*` maps to the project root (e.g. `@/lib/types`, `@/components/ui/button`)

**Key type pattern:** Interfaces are used for all domain shapes (not `type`), defined in `lib/types.ts`:
```typescript
export interface User { id: string; email: string; credits: number; ... }
export interface VideoHistory { id: string; user_id: string; ... }
```

## Naming Patterns

**Files:**
- Components: kebab-case `.tsx` — `video-generator-form.tsx`, `navigation.tsx`, `video-list.tsx`
- Hooks: `use-` prefix kebab-case — `use-toast.ts`, `use-mobile.ts`, `use-theme-preference.ts`
- API routes: `route.ts` inside named directories — `app/api/generate/route.ts`
- Server actions: plain `.ts` files in `app/actions/` — `user.ts`, `stripe.ts`
- Lib utilities: kebab-case — `api-client.ts`, `video-storage.ts`, `image-utils.ts`

**Functions:**
- Exported named functions for components: `export function VideoGeneratorForm(...)` (NOT default exports for components)
- Page components use default export: `export default async function GeneratePage(...)`
- Event handlers: `handleVerbNoun` — `handleSubmit`, `handleImageChange`, `handleCropComplete`
- Async data fetchers: `verbNoun` — `fetchPrompts`, `getRecentVideos`, `pollVideoStatus`

**Variables:**
- camelCase throughout
- Boolean state flags: `isLoading`, `isPolling`, `isCropperOpen`
- Error state: `error` as `string | null`

**Types/Interfaces:**
- PascalCase: `User`, `VideoHistory`, `VideoGeneratorFormProps`
- Props interfaces defined inline above their component: `interface VideoGeneratorFormProps { userCredits: number; }`

## Component Style

**Client vs Server components:**
- Client components always declare `"use client"` as the first line
- Server actions always declare `"use server"` as the first line
- Page components (in `app/[locale]/*/page.tsx`) are async server components by default
- Client components live in `components/` directory

**Component pattern:**
```tsx
"use client";

interface MyComponentProps { ... }

export function MyComponent({ prop }: MyComponentProps) {
  const t = useTranslations('namespace');
  // hooks first
  // derived state / useMemo
  // handlers
  return ( ... );
}
```

**Props destructuring:** Always destructured in function signature with default values inline:
```tsx
export function VideoList({
  videos,
  showEmptyMessage = true,
  emptyMessage,
  maxVideos,
  className = ""
}: VideoListProps)
```

**UI primitives:** All base UI from `components/ui/` (shadcn/ui pattern with Radix primitives + Tailwind). Use `cn()` from `lib/utils.ts` for conditional classes.

**Radix UI:** Imported directly from `@radix-ui/*` packages; wrapped and re-exported from `components/ui/`.

## Import Organization

**Order (no enforcer configured, observed pattern):**
1. React and Next.js imports
2. Third-party libraries (`lucide-react`, `next-intl`, `@radix-ui/*`)
3. Internal `@/components/ui/*`
4. Internal `@/components/*`
5. Internal `@/lib/*`, `@/hooks/*`, `@/i18n/*`

**No barrel files** (`index.ts`) — all imports use direct file paths.

## Error Handling

**API routes pattern:** Every route handler wraps the full body in `try/catch`. Returns `NextResponse.json({ error: "message" }, { status: NNN })`:
```typescript
export async function GET(request: NextRequest) {
  try {
    // ...
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[API] Error context:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Error message extraction pattern (consistent throughout):**
```typescript
const errorMessage = error instanceof Error ? error.message : "Fallback message";
```

**API client (lib/api-client.ts) pattern:** Returns discriminated union `{ success: boolean; data?: T; error?: string }`:
```typescript
return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
```

**Client component errors:** Stored as `error: string | null` state, rendered inline. `toast()` from `useToast()` used for user-visible notifications with `variant: "destructive"` for errors.

**Auth errors:** Checked immediately at page level before try/catch — redirect thrown outside try/catch to avoid catching redirect exceptions (Next.js 15 pattern).

## Async Patterns

**Server components:** Use top-level `await` directly (async server components):
```typescript
export default async function GeneratePage({ params }) {
  const { locale } = await params;
  const userResult = await getCurrentUser();
}
```

**Client-side fetch:** Uses native `fetch` directly (no abstraction library). Pattern:
```typescript
const response = await fetch("/api/endpoint", { method: "POST", body: formData });
const data = await response.json();
if (!response.ok) throw new Error(data.error || "Fallback message");
```

**Polling pattern:** Recursive `setTimeout`-based polling (not `setInterval`) in `pollVideoStatus`:
```typescript
const poll = async () => {
  if (attempts >= maxAttempts) { /* handle timeout */ return; }
  // ...check status...
  attempts++;
  setTimeout(poll, 3000);
};
setTimeout(poll, 3000);
```

**Server-side background polling:** `void`-style fire-and-forget using `.catch(console.error)`:
```typescript
pollVideoStatus(videoEntry.id, soraVideoId).catch(console.error);
```

## Logging

**Namespace prefixes:** Log messages include a bracketed module/context prefix — `[v0]`, `[API]`, `[Form]`, `[Generate]`, `[Polling]`, `[WEBHOOK]`, `[API Client]`

**Level usage:**
- `console.log` — normal flow, success confirmations
- `console.warn` — non-fatal issues, skipped processing
- `console.error` — failures, unexpected states

**Debug logging:** Heavy logging present in webhook handler and generate route for production debugging. `console.error` used for critical webhook events to ensure they flush.

## i18n Usage

**Library:** `next-intl` v4

**Locales:** `es` (default) and `en`. Config in `i18n/routing.ts`. Prefix mode: `always` — all routes have locale prefix (e.g. `/es/generate`, `/en/generate`).

**Message files:** `messages/en.json` and `messages/es.json` — flat namespaced JSON (~250 lines each). Namespaces: `common`, `navigation`, `home`, `form`, `generate`, `videoList`, `profile`, `credits`, `auth`.

**Server components:**
```typescript
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('generate');
t('yourRecentCreations')
```

**Client components:**
```typescript
import { useTranslations } from 'next-intl';
const t = useTranslations('form');
t('title')
t('creditsPerVideo', { count: creditCost, plural: creditCost > 1 ? 's' : '' })
```

**ICU message format:** Used for interpolated values `"credits": "Credits ({count})"` and plurals via manual `plural` parameter (not ICU plural selector — manual `s`/`` suffix string passed as param).

**API routes:** No translation — API routes return English error messages directly; translation happens in the client layer.

## Form Handling

`react-hook-form` is installed but not used in the main video generator. Forms use manual `useState` per field with `onSubmit` handlers and imperative state management. `zod` is installed but schema validation is not applied to forms currently.

## Styling

- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **CSS variables** for theming (light/dark) via `next-themes`; custom theme system with `themes/` directory and generated registry via `scripts/generate-theme-registry.js`
- **Class merging:** `cn(clsx(...), tailwind-merge)` from `lib/utils.ts`
- **CVA (class-variance-authority):** Used in UI primitives like `button.tsx` for variant management

---

*Convention analysis: 2026-04-21*
