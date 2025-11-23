# Supabase Architecture Analysis

## Executive Summary

This analysis examines how Supabase is used in the video-generator-microsaas project. **The anon_key IS being used**, but primarily on the **server-side** (Server Components and API routes). The frontend makes **almost no direct Supabase calls** - instead, it uses REST API routes. The architecture is **primarily REST API-based** with minimal direct Supabase client usage.

---

## Key Findings

### ✅ Anon Key Usage
- **IS USED** extensively on the server-side via `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Used in:
  - Server Components (`lib/supabase/server.ts`)
  - Middleware (`lib/supabase/middleware.ts`)
  - API routes (most routes)
  - Browser client (`lib/supabase/client.ts`) - but rarely used

### ✅ Service Role Key Usage
- **IS USED** in specific scenarios via `SUPABASE_SERVICE_ROLE_KEY`
- Used in:
  - Webhook processing (`app/api/webhook/stripe/route.ts`)
  - User creation fallback (`app/actions/user.ts`)

### 🔍 Key Difference from iablee-app
- **video-generator-microsaas**: Frontend uses REST API calls, NOT direct Supabase calls
- **iablee-app**: Frontend makes direct Supabase calls for most operations

---

## Architecture Breakdown

### 1. Server Components (Using Anon Key via Server Client)

Server Components use the server Supabase client (which uses anon key) for data fetching:

#### Generate Page
- **File**: `app/[locale]/generate/page.tsx`
- Operations:
  - `supabase.auth.getUser()` - Get authenticated user
  - `supabase.from('users').select()` - Get user data
  - `supabase.from('video_history').select()` - Get video history

#### Credits Page
- **File**: `app/[locale]/credits/page.tsx`
- Operations:
  - `supabase.auth.getUser()` - Get authenticated user
  - `supabase.from('users').select()` - Get user data
  - `supabase.from('transactions').select()` - Get transaction history

#### Profile Page
- **File**: `app/[locale]/profile/page.tsx`
- Operations:
  - `supabase.auth.getUser()` - Get authenticated user
  - `supabase.from('users').select()` - Get user data
  - `supabase.from('video_history').select()` - Get video history

#### Home Page
- **File**: `app/[locale]/page.tsx`
- Operations:
  - `supabase.auth.getUser()` - Get authenticated user
  - `supabase.from('users').select()` - Get user data

### 2. API Routes (Using Anon Key via Server Client)

Most API routes use the server Supabase client (anon key):

#### Authentication Routes
- **File**: `app/api/auth/login/route.ts`
  - `supabase.auth.signInWithPassword()` - User login

- **File**: `app/api/auth/signup/route.ts`
  - `supabase.auth.signUp()` - User registration

- **File**: `app/api/auth/signout/route.ts`
  - `supabase.auth.signOut()` - User logout

#### Video Generation Route
- **File**: `app/api/generate/route.ts`
  - `supabase.auth.getUser()` - Verify authentication
  - `supabase.from('users').select()` - Get user credits
  - `supabase.from('prompt_settings').select()` - Get prompt settings
  - `supabase.from('users').update()` - Deduct credits
  - `supabase.from('video_history').insert()` - Create video entry
  - `supabase.from('video_history').update()` - Update video status

#### User Credits Route
- **File**: `app/api/user/credits/route.ts`
  - `supabase.auth.getUser()` - Verify authentication
  - `supabase.from('users').select()` - Get user credits

#### Prompts Route
- **File**: `app/api/prompts/route.ts`
  - `supabase.auth.getUser()` - Verify authentication
  - `supabase.from('predefined_prompts').select()` - Get prompts

#### Video Routes
- **File**: `app/api/video/[videoId]/content/route.ts`
  - Uses Supabase client for video retrieval

- **File**: `app/api/video/status/route.ts`
  - Uses Supabase client for status checks

#### Checkout Routes
- **File**: `app/api/checkout/payment-link/route.ts`
  - `supabase.auth.getUser()` - Verify authentication

### 3. API Routes (Using Service Role Key)

Only specific routes use the service role key:

#### Webhook Route
- **File**: `app/api/webhook/stripe/route.ts`
  - Uses `SUPABASE_SERVICE_ROLE_KEY` to:
    - Check for duplicate transactions (bypasses RLS)
    - Look up users by email
    - Update user credits
    - Insert transaction records
  - **Reason**: Webhooks don't have user sessions, so service role is needed

### 4. Server Actions (Using Service Role Key)

#### User Creation Fallback
- **File**: `app/actions/user.ts`
  - Uses `SUPABASE_SERVICE_ROLE_KEY` to create users if database trigger fails
  - **Reason**: Bypasses RLS to ensure user creation works even if trigger didn't fire

### 5. Middleware (Using Anon Key)

- **File**: `lib/supabase/middleware.ts`
  - Uses anon key to:
    - Verify user sessions
    - Protect routes
    - Redirect authenticated/unauthenticated users
  - Uses `createServerClient` from `@supabase/ssr`

### 6. Frontend Client Components (Minimal Direct Usage)

The frontend makes **almost no direct Supabase calls**. Instead, it uses REST API calls:

#### Video Generator Form
- **File**: `components/video-generator-form.tsx`
  - `fetch('/api/prompts')` - Get predefined prompts
  - `fetch('/api/generate')` - Generate video
  - **No direct Supabase calls**

#### Video List
- **File**: `components/video-list.tsx`
  - `fetch(videoUrl)` - Download videos
  - **No direct Supabase calls**

#### Authentication Pages
- **File**: `app/[locale]/auth/login/page.tsx`
  - `fetch('/api/auth/login')` - Login via API
  - **No direct Supabase calls**

- **File**: `app/[locale]/auth/sign-up/page.tsx`
  - `fetch('/api/auth/signup')` - Signup via API
  - **No direct Supabase calls**

#### Exception: Theme Preference Hook
- **File**: `hooks/use-theme-preference.ts`
  - Uses `createClient()` from `lib/supabase/client.ts`
  - **Only frontend file using direct Supabase client**

---

## Environment Variables

### Frontend (Public)
- `NEXT_PUBLIC_SUPABASE_URL` - Used by all Supabase clients
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Used by:
  - Server Components
  - API routes
  - Middleware
  - Browser client (rarely used)

### Backend (Private)
- `SUPABASE_SERVICE_ROLE_KEY` - Used by:
  - Webhook processing
  - User creation fallback

---

## Architecture Pattern Comparison

### video-generator-microsaas (Current Project)
```
Frontend (Client Components)
  ↓ REST API calls
API Routes (Server)
  ↓ Supabase Server Client (anon key)
Supabase Database
```

**Characteristics:**
- ✅ Frontend uses REST API exclusively
- ✅ Server Components use Supabase directly
- ✅ API routes use server client (anon key)
- ✅ Service role only for webhooks and fallbacks
- ✅ Minimal direct Supabase usage on frontend

### iablee-app (Comparison)
```
Frontend (Client Components)
  ↓ Direct Supabase calls (anon key)
  ↓ REST API calls (for billing)
Supabase Database
```

**Characteristics:**
- ✅ Frontend makes direct Supabase calls
- ✅ Frontend also uses REST API for specific operations
- ✅ Mixed architecture

---

## Security Implications

### ✅ Current Security Model

1. **Server-Side RLS**: Most operations use anon key on the server, which means:
   - RLS policies are enforced
   - User context is available via cookies/sessions
   - Secure by default

2. **Service Role Key**: Only used when necessary:
   - Webhooks (no user session)
   - User creation fallback (bypasses RLS)

3. **Frontend Isolation**: Frontend doesn't have direct database access:
   - All operations go through API routes
   - Business logic is centralized
   - Easier to secure and maintain

### ✅ Advantages of This Architecture

1. **Centralized Business Logic**: All database operations go through API routes
2. **Better Security**: Frontend can't directly access database
3. **Easier Maintenance**: Single source of truth for business logic
4. **Better Error Handling**: Consistent error responses
5. **Type Safety**: Can validate inputs at API boundary

### ⚠️ Potential Concerns

1. **Slightly More Latency**: Extra hop through API route
2. **More Code**: Need to create API routes for operations
3. **Anon Key on Server**: While secure, using anon key on server means RLS must be comprehensive

---

## Code Examples

### Server Component (Anon Key)
```typescript
// app/[locale]/generate/page.tsx
const supabase = await createClient(); // Uses anon key
const { data: { user } } = await supabase.auth.getUser();
const { data: userData } = await supabase
  .from('users')
  .select('*')
  .eq('id', user.id)
  .single();
```

### API Route (Anon Key)
```typescript
// app/api/generate/route.ts
const supabase = await createClient(); // Uses anon key
const { data: { user } } = await supabase.auth.getUser();
const { data: userData } = await supabase
  .from('users')
  .select('*')
  .eq('id', user.id)
  .single();
```

### API Route (Service Role Key)
```typescript
// app/api/webhook/stripe/route.ts
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role
);
const { data: user } = await supabase
  .from('users')
  .select('credits')
  .eq('id', userId)
  .single();
```

### Frontend REST API Call
```typescript
// components/video-generator-form.tsx
const response = await fetch('/api/generate', {
  method: 'POST',
  body: formData,
});
const data = await response.json();
```

### Frontend Direct Supabase Call (Rare)
```typescript
// hooks/use-theme-preference.ts
const supabase = createClient(); // Browser client with anon key
// Only used for theme preferences
```

---

## Recommendations

### ✅ Current Architecture is Excellent

The current REST API-based architecture is well-designed:

1. **Keep Current Pattern**: Continue using REST API routes for all operations
2. **Server Components**: Continue using server Supabase client for data fetching
3. **Service Role**: Only use for webhooks and necessary fallbacks
4. **Frontend**: Continue avoiding direct Supabase calls

### 🔄 Potential Improvements

1. **Consider Edge Functions**: For complex operations that need to bypass RLS
2. **Add Rate Limiting**: Protect API routes from abuse
3. **Add Request Validation**: Use Zod or similar for API route inputs
4. **Add Response Caching**: For read-heavy operations

---

## Conclusion

**The anon_key IS being used**, but primarily on the **server-side**:
- Server Components use anon key via server client
- API routes use anon key via server client
- Middleware uses anon key
- Frontend makes REST API calls, NOT direct Supabase calls

**The service_role_key IS used** for:
- Webhook processing (no user session)
- User creation fallback (bypasses RLS)

This architecture is **more secure and maintainable** than direct frontend Supabase calls because:
- All business logic is centralized in API routes
- Frontend has no direct database access
- Easier to secure, validate, and maintain
- Consistent error handling

---

## Files Summary

### Server Components Using Supabase (Anon Key)
- `app/[locale]/generate/page.tsx`
- `app/[locale]/credits/page.tsx`
- `app/[locale]/profile/page.tsx`
- `app/[locale]/page.tsx`

### API Routes Using Supabase (Anon Key)
- `app/api/auth/login/route.ts`
- `app/api/auth/signup/route.ts`
- `app/api/auth/signout/route.ts`
- `app/api/generate/route.ts`
- `app/api/user/credits/route.ts`
- `app/api/prompts/route.ts`
- `app/api/video/[videoId]/content/route.ts`
- `app/api/video/status/route.ts`
- `app/api/checkout/payment-link/route.ts`

### API Routes Using Service Role Key
- `app/api/webhook/stripe/route.ts`

### Server Actions Using Service Role Key
- `app/actions/user.ts`

### Middleware
- `lib/supabase/middleware.ts` (uses anon key)

### Frontend Files (REST API Only)
- `components/video-generator-form.tsx` - Uses `fetch('/api/generate')`
- `components/video-list.tsx` - Uses `fetch()` for downloads
- `app/[locale]/auth/login/page.tsx` - Uses `fetch('/api/auth/login')`
- `app/[locale]/auth/sign-up/page.tsx` - Uses `fetch('/api/auth/signup')`

### Frontend Files (Direct Supabase - Rare)
- `hooks/use-theme-preference.ts` - Only file using browser client

### Supabase Client Files
- `lib/supabase/client.ts` - Browser client (rarely used)
- `lib/supabase/server.ts` - Server client (used extensively)
- `lib/supabase/middleware.ts` - Middleware client

---

*Analysis Date: 2025-01-27*
*Project: video-generator-microsaas*

