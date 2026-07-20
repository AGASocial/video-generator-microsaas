# Phase 2: Credit System Hardening - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 5 (4 modified, 1 new)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/010_create_processed_webhook_events.sql` | migration | CRUD | `scripts/004_add_job_id_column.sql` | role-match |
| `app/api/generate/route.ts` | controller | request-response | self (modify in-place) | exact |
| `app/api/webhook/stripe/route.ts` | controller | event-driven | self (modify in-place) | exact |
| `app/api/webhook/video-complete/route.ts` | controller | event-driven | `app/api/webhook/stripe/route.ts` | role-match |
| *(RPC function — embedded in migration SQL)* | stored procedure | CRUD | `scripts/001_create_tables.sql` | role-match |

---

## Pattern Assignments

### `scripts/010_create_processed_webhook_events.sql` (migration, CRUD)

**Analog:** `scripts/001_create_tables.sql`

**Table creation pattern** (lines 1-36 of 001_create_tables.sql):
```sql
-- Existing pattern: plain SQL, IF NOT EXISTS guards, gen_random_uuid() PK,
-- timestamps with time zone DEFAULT now(), foreign keys with ON DELETE CASCADE
create table if not exists public.video_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  credits integer not null default 0,
  created_at timestamp with time zone default now()
);
```

**New table should follow same conventions:**
```sql
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,
  event_id     text NOT NULL,
  provider     text NOT NULL,
  user_id      uuid REFERENCES public.video_users(id) ON DELETE SET NULL,
  processed_at timestamp with time zone DEFAULT now(),
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE (provider, event_id, event_type)
);
```

**RPC function to embed in same migration** (pattern from RESEARCH.md Pattern 1):
```sql
CREATE OR REPLACE FUNCTION public.deduct_credits_and_create_video(
  p_user_id     uuid,
  p_credit_cost integer,
  p_prompt      text,
  p_duration    integer,
  p_model       text,
  p_image_url   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits integer;
  v_video_entry     json;
BEGIN
  SELECT credits INTO v_current_credits
  FROM public.video_users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_current_credits < p_credit_cost THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE public.video_users
  SET credits = credits - p_credit_cost
  WHERE id = p_user_id;

  INSERT INTO public.video_history (user_id, prompt, image_url, duration, model, status, credit_cost)
  VALUES (p_user_id, p_prompt, p_image_url, p_duration, p_model, 'processing', p_credit_cost)
  RETURNING to_json(video_history.*) INTO v_video_entry;

  RETURN v_video_entry;
END;
$$;
```

**Note on `credit_cost` column:** The migration must also `ALTER TABLE public.video_history ADD COLUMN IF NOT EXISTS credit_cost integer;` before creating the RPC. This allows the Kling webhook refund handler to read the exact credit amount stored at generation time, immune to future pricing changes.

---

### `app/api/generate/route.ts` (controller, request-response) — MODIFY

**Analog:** self (existing file, lines 1-316)

**Existing imports pattern** (lines 1-4):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreditCost } from "@/lib/products";
import { generateKlingToken } from "@/lib/kling-auth";
```

**Auth pattern** (lines 11-25) — keep as-is:
```typescript
const supabase = await createClient();
const {
  data: { user: authUser },
  error: authError,
} = await supabase.auth.getUser();
if (authError || !authUser) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Current two-call deduction pattern to REPLACE** (lines 119-157 — the bug):
```typescript
// REMOVE THIS BLOCK — replace with supabase.rpc() call
const { error: updateError } = await supabase
  .from("users")
  .update({ credits: user.credits - creditCost })
  .eq("id", authUser.id);
// ... and the separate INSERT into video_history ...
```

**Replacement RPC pattern** (RESEARCH.md Pattern 1):
```typescript
const { data: videoEntry, error: rpcError } = await supabase.rpc(
  "deduct_credits_and_create_video",
  {
    p_user_id: authUser.id,
    p_credit_cost: creditCost,
    p_prompt: userPrompt,
    p_duration: duration,
    p_model: model,
    p_image_url: imageFile ? imageFile.name : null,
  }
);

if (rpcError) {
  console.error("[AtomicDeduction] RPC failed:", rpcError);
  if (rpcError.message.includes("insufficient_credits")) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }
  return NextResponse.json({ error: "Failed to start generation" }, { status: 500 });
}
```

**Logging convention** (from CONTEXT.md `code_context`):
- Use `[AtomicDeduction]` prefix for RPC-related log lines
- Existing patterns: `console.log("[Generate] ...")`, `console.error("[Kling] ...")`

**Remove refund-on-API-error** (lines 169-171, 295-299 — per D-03): After RPC replacement, there is no separate credit deduction to refund. The `catch (klingError)` block (lines 282-305) must NOT include any credit refund call — refund is now only triggered by the Kling webhook on `task_status: "failed"`. Update the video_history status to "failed" only; remove the `supabase.from("users").update(...)` refund calls entirely.

---

### `app/api/webhook/stripe/route.ts` (controller, event-driven) — MODIFY

**Analog:** self (existing file, lines 1-397)

**Service role client pattern** (lines 130-146) — keep as-is, this is the correct pattern:
```typescript
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

**Existing idempotency check pattern** (lines 147-166) — this is the model to adapt for `processed_webhook_events`:
```typescript
const { data: existingTransaction, error: checkError } = await supabase
  .from("video_transactions")
  .select("id")
  .eq("stripe_session_id", session.id)
  .single();

if (checkError && checkError.code !== 'PGRST116') {
  console.error("[WEBHOOK] Error checking for existing transaction:", checkError);
}

if (existingTransaction) {
  console.log(`[WEBHOOK] ⚠️ Transaction for session ${session.id} already processed. Skipping.`);
  return NextResponse.json({ received: true, message: "Transaction already processed" }, { status: 200 });
}
```

**New `processed_webhook_events` dedup check to ADD** (insert BEFORE existing idempotency check, after supabase client init):
```typescript
// Check processed_webhook_events table (D-01: provider-agnostic idempotency)
const { data: existingEvent } = await supabase
  .from("processed_webhook_events")
  .select("id")
  .eq("provider", "stripe")
  .eq("event_id", event.id)
  .eq("event_type", event.type)
  .single();

if (existingEvent) {
  console.log("[ProcessedEvents] Already processed:", { provider: "stripe", eventId: event.id, eventType: event.type });
  return NextResponse.json({ received: true, message: "Already processed" }, { status: 200 });
}
```

**Insert dedup row AFTER all side effects succeed** (RESEARCH.md Pitfall 2 — insert last):
```typescript
// After transaction.insert succeeds:
await supabase.from("processed_webhook_events").insert({
  event_type: event.type,
  event_id: event.id,
  provider: "stripe",
  user_id: userId,
});
console.log("[ProcessedEvents] Recorded event:", { provider: "stripe", eventId: event.id });
```

**Keep existing `transactions` check** (lines 147-166) as defense-in-depth per RESEARCH.md Open Question 3.

---

### `app/api/webhook/video-complete/route.ts` (controller, event-driven) — MODIFY

**Analog:** `app/api/webhook/stripe/route.ts` for service-role client pattern; self for existing structure.

**Client fix — replace user-session client with service role** (line 159 — RESEARCH.md Finding 4):
```typescript
// REMOVE: const supabase = await createClient();

// ADD: service role client (no user session in webhook context)
import { createClient as createServiceClient } from "@supabase/supabase-js";
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

**Add `credit_cost` to select query** (line 160-164 — needed for refund):
```typescript
// REPLACE existing select:
const { data: videoEntry, error: videoError } = await supabase
  .from("video_history")
  .select("id, user_id, status, job_id, credit_cost")  // add credit_cost
  .eq("job_id", taskId)
  .single();
```

**Add `processed_webhook_events` dedup for Kling** (after supabase client init, before video lookup — RESEARCH.md Pitfall 4):
```typescript
const { data: existingKlingEvent } = await supabase
  .from("processed_webhook_events")
  .select("id")
  .eq("provider", "kling")
  .eq("event_id", taskId)
  .eq("event_type", taskStatus)
  .single();

if (existingKlingEvent) {
  console.log("[ProcessedEvents] Already processed Kling event:", { taskId, taskStatus });
  return NextResponse.json({ received: true });
}
```

**Replace "failed" branch** (lines 224-238) — add credit refund using INCREMENT (not absolute set):
```typescript
// taskStatus === "failed"
await supabase
  .from("video_history")
  .update({ status: "failed" })
  .eq("id", videoId);

// D-03: Refund credits atomically using increment (not absolute value — prevents race)
if (videoEntry.credit_cost) {
  await supabase.rpc("increment_user_credits", {
    p_user_id: videoEntry.user_id,
    p_amount: videoEntry.credit_cost,
  });
  // OR use raw SQL increment via supabase (Supabase JS does not support raw SQL increments
  // without an RPC; use a second simple RPC or raw postgrest filter):
  // await supabase.from("users").update({ credits: supabase.rpc(...) })
  // Simpler: add a second RPC "refund_credits(p_user_id, p_amount)" to the migration
  console.log("[KlingWebhook] Credit refund issued:", {
    videoId,
    userId: videoEntry.user_id,
    creditCost: videoEntry.credit_cost,
  });
}
```

**Note on refund RPC:** Supabase JS client does not support `credits + N` in `.update()` without a raw RPC. The migration should include a second simple RPC `refund_video_credits(p_user_id uuid, p_amount integer)` that executes `UPDATE users SET credits = credits + p_amount WHERE id = p_user_id`. This keeps the refund atomic and avoids snapshot-overwrite bugs.

**Insert Kling dedup row AFTER all side effects** (insert last — same pitfall as Stripe):
```typescript
await supabase.from("processed_webhook_events").insert({
  event_type: taskStatus,
  event_id: taskId,
  provider: "kling",
  user_id: videoEntry.user_id,
});
```

**Existing idempotency check to KEEP** (lines 174-179 — keep as defense-in-depth):
```typescript
if (videoEntry.status === "completed" || videoEntry.status === "failed") {
  console.log("[KlingWebhook] Event already processed:", { taskId, videoId, currentStatus: videoEntry.status });
  return NextResponse.json({ received: true });
}
```

---

## Shared Patterns

### Service Role Client
**Source:** `app/api/webhook/stripe/route.ts` lines 130-146
**Apply to:** `app/api/webhook/video-complete/route.ts` (fix from `createClient()` to service role), both webhook handlers
```typescript
import { createClient as createServiceClient } from "@supabase/supabase-js";
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

### Webhook Idempotency Check (Select-before-act)
**Source:** `app/api/webhook/stripe/route.ts` lines 147-166
**Apply to:** Both `stripe/route.ts` and `video-complete/route.ts`
```typescript
const { data: existing } = await supabase
  .from("processed_webhook_events")
  .select("id")
  .eq("provider", "<provider>")
  .eq("event_id", <eventId>)
  .eq("event_type", <eventType>)
  .single();

if (existing) {
  console.log("[ProcessedEvents] Already processed:", { provider, eventId });
  return NextResponse.json({ received: true }, { status: 200 });
}
// ... side effects ...
// LAST: insert dedup row
await supabase.from("processed_webhook_events").insert({ ... });
```

### Logging Convention
**Source:** `app/api/generate/route.ts` and `app/api/webhook/video-complete/route.ts`
**Apply to:** All new log lines in Phase 2
- New credit deduction logs: `[AtomicDeduction]`
- New idempotency event logs: `[ProcessedEvents]`
- Kling refund logs: `[KlingWebhook]` (already established)
- Pattern: `console.log("[Tag] Message:", { key: value })`

### Error Code Handling for RPC
**Source:** `app/api/webhook/stripe/route.ts` line 153 — PGRST116 pattern
**Apply to:** All `.single()` Supabase queries
```typescript
if (checkError && checkError.code !== 'PGRST116') {  // PGRST116 = no rows found
  console.error("[Tag] Error:", checkError);
}
```

### SQL Migration File Convention
**Source:** `scripts/001_create_tables.sql` through `scripts/009_update_default_theme_to_christmas.sql`
**Apply to:** `scripts/010_create_processed_webhook_events.sql`
- Numbered prefix: `NNN_descriptive_name.sql`
- Next number: `010`
- Use `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`
- Lowercase SQL keywords in table DDL; uppercase in function bodies is acceptable

---

## No Analog Found

All files have close analogs. No gaps.

---

## Metadata

**Analog search scope:** `scripts/`, `app/api/generate/`, `app/api/webhook/`
**Files scanned:** 6 source files (4 route handlers + 2 SQL migrations)
**Pattern extraction date:** 2026-04-22
