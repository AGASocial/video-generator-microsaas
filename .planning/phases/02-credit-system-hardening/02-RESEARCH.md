# Phase 2: Credit System Hardening - Research

**Researched:** 2026-04-22
**Domain:** PostgreSQL atomicity (Supabase RPC), webhook idempotency, credit lifecycle
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `processed_webhook_events` table schema: `(id, event_type, event_id, provider, user_id, processed_at, unique(provider, event_id, event_type))`
- **D-02:** Supabase RPC (stored procedure) for atomic credit deduction + video_history creation in a single transaction
- **D-03:** Refund only when Kling webhook signals `task_status: "failed"` — NOT on API errors
- **D-04:** Stripe webhook uses `processed_webhook_events` for idempotency; no changes to credit allocation logic
- **D-05:** Keep immediate-deduction model (no holds/reserves)
- **D-06:** End-to-end test both refund paths (Stripe replay → no double-credit; Kling failure → refund guaranteed)

### Claude's Discretion

None recorded in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)

- Credit holds/reserves
- Rate limiting per user/provider via `processed_webhook_events`
- Webhook retry logic / explicit retry queue
- Credit expiration/usage window
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRED-04 | Stripe webhook credit allocation is idempotent — replaying the same webhook event does not double-credit the user | D-01 `processed_webhook_events` table + unique constraint |
| CRED-05 | Credit deduction and refund operations are atomic — partial states cannot occur | D-02 Supabase RPC transaction |
| PAY-03 | Stripe webhook handler rejects duplicate payment events (idempotency key check) | D-01 check + D-04 no logic changes |
| ERR-04 | Failed video generation triggers credit refund before returning error — no case where generation fails and credits are not returned | D-03 refund on Kling `task_status: "failed"` + remove current per-API-error refunds |
</phase_requirements>

---

## Summary

Phase 2 hardens three distinct points where the credit lifecycle can break: (1) Stripe webhook replay causing double-credit, (2) non-atomic credit deduction + video_history creation in `generate/route.ts`, and (3) the refund path being fragile and split across API error handlers.

The core technical work is: one new SQL migration (table + RPC), two webhook handler patches (Stripe and Kling), and a rewrite of the credit deduction section in `generate/route.ts`. The total surface area is small — roughly 4 files modified, 1 file added.

The most complex piece is the Supabase RPC (D-02). Writing a PostgreSQL function that atomically checks balance, deducts credits, and inserts a `video_history` row — returning the new row — requires careful attention to Supabase's `SECURITY DEFINER` vs `SECURITY INVOKER` distinction and return type. The `processed_webhook_events` table (D-01) is a straightforward unique-constraint dedup pattern already proven in the Stripe handler.

**Primary recommendation:** Implement the RPC first (it anchors the generate route rewrite), then the migration for `processed_webhook_events`, then patch both webhook handlers.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Webhook idempotency dedup | API / Backend | Database | Dedup logic runs server-side before any state mutation |
| Atomic credit deduction | Database (RPC) | API / Backend | Must be inside a single DB transaction; cannot be split across two network calls |
| Credit refund on failure | API / Backend | Database | Webhook handler decides when to trigger; DB executes the update |
| Idempotency audit trail | Database | — | `processed_webhook_events` is a persistent record; no application tier ownership |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS `@supabase/supabase-js` | already installed | RPC call via `supabase.rpc()` | Project's existing Supabase client; `.rpc()` is the standard way to invoke Postgres functions |
| PostgreSQL (via Supabase) | managed | Stored procedure + unique constraint | All existing migrations use plain SQL; same pattern here |

No new npm packages are required for this phase. All work is SQL migrations + TypeScript edits to existing files.

---

## Architecture Patterns

### System Architecture Diagram

```
[generate/route.ts]
      |
      | supabase.rpc("deduct_credits_and_create_video", { user_id, creditCost, ... })
      v
[PostgreSQL RPC: deduct_credits_and_create_video]
      |-- BEGIN
      |-- SELECT credits FROM users WHERE id = user_id FOR UPDATE  (lock row)
      |-- IF credits < cost THEN RAISE EXCEPTION 'insufficient_credits'
      |-- UPDATE users SET credits = credits - cost WHERE id = user_id
      |-- INSERT INTO video_history (...) RETURNING *
      |-- COMMIT / ROLLBACK on any error
      |
      v
  Returns: { videoEntry } or error code

[webhook/stripe/route.ts]
      |
      | INSERT INTO processed_webhook_events (event_type, event_id, provider, user_id)
      | ON CONFLICT (provider, event_id, event_type) DO NOTHING
      | → if 0 rows inserted: return 200 (already processed)
      | → if 1 row inserted: continue with credit allocation
      v
  Stripe credit allocation (existing logic — no changes)

[webhook/video-complete/route.ts]
      |
      | Receives Kling callback with task_status = "succeed" | "failed"
      | → "succeed": download + store video, update status = "completed"
      | → "failed":
      |     1. UPDATE video_history SET status = "failed"
      |     2. UPDATE users SET credits = credits + creditCost  (refund)
      |     3. Log refund with [KlingWebhook] prefix
      v
  Returns 200 (idempotency guard: check current status before acting)
```

### Recommended Project Structure

No new directories needed. Work touches:

```
scripts/
└── 010_create_processed_webhook_events.sql   (NEW — migration)

app/api/
├── generate/route.ts                          (MODIFY — replace separate deduct+insert with RPC)
└── webhook/
    ├── stripe/route.ts                        (MODIFY — add processed_webhook_events dedup)
    └── video-complete/route.ts                (MODIFY — add credit refund on "failed" status)
```

The RPC function itself lives in the migration SQL (scripts/010_...). It does not need a separate lib file — it is invoked via `supabase.rpc()` from the generate route.

---

### Pattern 1: Atomic RPC for Credit Deduction + Record Creation

**What:** Single PostgreSQL function that validates balance, deducts credits, and inserts a `video_history` row — all in one transaction. If any step fails, both roll back.

**When to use:** Any operation that must write to two tables and must never leave them inconsistent.

**Key Supabase detail:** Use `SECURITY DEFINER` on the RPC so it runs with the function owner's privileges (bypasses RLS for the internal writes). The calling context (user session or service role) controls who can invoke it, but the internals need full table access. [ASSUMED — standard Supabase RPC practice; verify against Supabase docs if needed]

**Example SQL:**

```sql
-- Source: Supabase docs pattern for atomic operations
-- scripts/010_create_processed_webhook_events.sql

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
  -- Lock the user row to prevent concurrent deductions
  SELECT credits INTO v_current_credits
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_current_credits < p_credit_cost THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  -- Deduct credits
  UPDATE public.users
  SET credits = credits - p_credit_cost
  WHERE id = p_user_id;

  -- Create video_history record
  INSERT INTO public.video_history (user_id, prompt, image_url, duration, model, status)
  VALUES (p_user_id, p_prompt, p_image_url, p_duration, p_model, 'processing')
  RETURNING to_json(video_history.*) INTO v_video_entry;

  RETURN v_video_entry;
END;
$$;
```

**Invocation from generate route:**

```typescript
// Source: [VERIFIED: Supabase JS docs — supabase.rpc()]
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
  if (rpcError.message.includes("insufficient_credits")) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }
  return NextResponse.json({ error: "Failed to start generation" }, { status: 500 });
}
```

---

### Pattern 2: Webhook Idempotency via `processed_webhook_events`

**What:** Before processing any webhook, attempt to insert into `processed_webhook_events`. If the row already exists (unique constraint violation → `ON CONFLICT DO NOTHING`), the webhook was already processed — return 200 with no side effects.

**Key detail:** INSERT … ON CONFLICT DO NOTHING returns 0 affected rows when dedup fires. Check `count` on the result or use a two-step SELECT + INSERT. The simpler approach is SELECT first (matches existing Stripe pattern) then INSERT.

**Example SQL for the table + unique constraint:**

```sql
-- scripts/010_create_processed_webhook_events.sql
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,
  event_id     text NOT NULL,
  provider     text NOT NULL,
  user_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  processed_at timestamp with time zone DEFAULT now(),
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE (provider, event_id, event_type)
);
```

**TypeScript dedup check (follows existing Stripe pattern at lines 127-150):**

```typescript
// Source: adapted from app/api/webhook/stripe/route.ts lines 147-165
// [VERIFIED: codebase — existing idempotency pattern]
const { data: existingEvent } = await supabase
  .from("processed_webhook_events")
  .select("id")
  .eq("provider", "stripe")
  .eq("event_id", event.id)
  .eq("event_type", event.type)
  .single();

if (existingEvent) {
  console.log("[ProcessedEvents] Already processed:", { provider: "stripe", eventId: event.id });
  return NextResponse.json({ received: true, message: "Already processed" }, { status: 200 });
}

// After successful processing, record the event
await supabase.from("processed_webhook_events").insert({
  event_type: event.type,
  event_id: event.id,
  provider: "stripe",
  user_id: userId,
});
```

---

### Pattern 3: Credit Refund on Kling `task_status: "failed"`

**What:** The Kling webhook handler must look up the video entry's `credit_cost` (or derive it from `model`) and refund the user when `task_status === "failed"`.

**Gap identified:** The current `video_history` table does NOT store `credit_cost`. The webhook handler cannot know how many credits to refund without either:
  - (a) Adding a `credit_cost` column to `video_history` (populated by the RPC), OR
  - (b) Deriving cost from the stored `model` field using `getCreditCost(model)` (already available in lib/products.ts)

Option (b) requires no schema change and is consistent with the existing code pattern. Option (a) is more explicit and safer if `getCreditCost` logic ever changes.

**Recommendation:** Add `credit_cost` column to `video_history` as part of the migration (or a separate `ALTER TABLE`). Populate it from the RPC. This makes refunds self-contained and immune to future pricing changes.

**Refund code in video-complete/route.ts:**

```typescript
// After confirming taskStatus === "failed":
const { data: videoEntry } = await supabase
  .from("video_history")
  .select("id, user_id, status, job_id, credit_cost")
  .eq("job_id", taskId)
  .single();

// ... (idempotency check: skip if already terminal)

await supabase
  .from("video_history")
  .update({ status: "failed" })
  .eq("id", videoId);

// Refund credits atomically
await supabase
  .from("users")
  .update({ credits: supabase.raw("credits + " + videoEntry.credit_cost) })
  .eq("id", videoEntry.user_id);

console.log("[KlingWebhook] Credit refund issued:", {
  videoId,
  userId: videoEntry.user_id,
  creditCost: videoEntry.credit_cost,
});
```

**IMPORTANT:** The refund update above uses a simple `SET credits = credits + N` pattern. This is NOT atomic if a concurrent refund fires (e.g., duplicate webhook delivery). The Kling webhook already has an idempotency guard via `videoEntry.status` check at line 176 — if the webhook is already `"failed"`, it skips processing. This guard makes the refund safe. [VERIFIED: codebase — lines 175-179 of video-complete/route.ts]

---

### Anti-Patterns to Avoid

- **Two separate DB calls for credit deduction + video_history insert (current code):** Lines 119-157 of generate/route.ts do `UPDATE users` then `INSERT video_history` as two separate Supabase calls. A crash between them leaves the user with deducted credits but no video record. The RPC eliminates this window entirely.
- **Refunding via setting absolute value (`credits: user.credits`):** Current refund code at lines 149-152 and 295-298 sets `credits` to a snapshot value captured at the start of the request. Concurrent requests can cause this to undercount credits if another credit event (e.g., Stripe allocation) fires between the snapshot and the refund write. Use `credits = credits + N` (increment) not `credits = N` (absolute set).
- **Inserting into `processed_webhook_events` BEFORE confirming success:** If the event processing fails after inserting the dedup row, the event will never be retried. Always insert the dedup row as the LAST step, after all side effects succeed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-table writes | Application-level "saga" with manual rollback | PostgreSQL stored function (Supabase RPC) | DB transactions are ACID; application-level rollback has race conditions and network failure windows |
| Row-level locking during deduction | Application-level "check then update" | `SELECT ... FOR UPDATE` inside RPC | Without row lock, two concurrent requests can both pass the balance check and both deduct |
| Idempotency tracking | In-memory Set or Redis | `processed_webhook_events` DB table with unique constraint | Webhook can arrive on any server instance; in-memory state is not shared across instances |

**Key insight:** PostgreSQL's transaction isolation is the only reliable boundary for atomicity. Any solution that involves multiple Supabase client calls in a route handler has a failure window.

---

## Current Code: Critical Findings

### Finding 1: Absolute-value refund bug (HIGH risk)

**Location:** `app/api/generate/route.ts` lines 149-152 and 295-298

```typescript
// BUG: Uses snapshot value, not increment
await supabase.from("users").update({ credits: user.credits }).eq("id", authUser.id);
```

`user.credits` is read at the start of the request (~line 30). If a Stripe webhook credits the user between that read and this write, the refund OVERWRITES the Stripe-allocated credits. The correct refund is: `credits = credits + creditCost` (SQL increment).

After Phase 2, this code path is removed (replaced by the RPC for deduction + webhook-only refund), so the bug is eliminated structurally.

### Finding 2: `video_history` has no `credit_cost` column

The Kling webhook handler needs to know how many credits to refund. Currently it can only derive this from `model` via `getCreditCost()`. Adding `credit_cost` to `video_history` (populated in the RPC) is cleaner and immune to future pricing changes.

### Finding 3: Stripe webhook idempotency checks `transactions` table, not `processed_webhook_events`

Lines 147-165 of stripe/route.ts check `transactions.stripe_session_id`. After D-01, the canonical idempotency check will move to `processed_webhook_events`. The `transactions` check can remain as a secondary guard or be removed. Both approaches are valid; the planner should pick one and document it.

### Finding 4: Kling webhook uses `createClient()` (user session client)

Line 159 of video-complete/route.ts uses `createClient()` — the user-session client. Webhook handlers should use the service role client (no user session exists in a webhook context). The Stripe handler correctly uses `createServiceClient(...)`. The Kling handler may work due to RLS policies allowing the operation, but it is inconsistent and should be aligned.

---

## Common Pitfalls

### Pitfall 1: RPC return type mismatch

**What goes wrong:** Supabase's `supabase.rpc()` returns data shaped by the SQL function's RETURNS clause. If the TypeScript code expects `data.id` but the function returns `json` instead of `RETURNS SETOF video_history`, the shape will differ.

**How to avoid:** Define the RETURNS type as `json` (as shown in Pattern 1) and parse it in TypeScript. Alternatively, use `RETURNS SETOF video_history` and call with `.select()`.

**Warning signs:** `data` is null but `error` is also null; `data.id` is undefined.

### Pitfall 2: Inserting `processed_webhook_events` row before side effects complete

**What goes wrong:** If the dedup INSERT succeeds but credit allocation fails, the event is permanently marked as processed — the user never gets their credits.

**How to avoid:** Insert the dedup row as the LAST write operation. All business logic (credit update, transaction insert) must complete first.

**Warning signs:** Users report no credits after payment; logs show "Already processed" on first delivery.

### Pitfall 3: RPC called with user-session client (blocked by RLS)

**What goes wrong:** The generate route uses the user-session Supabase client (`createClient()`). The RPC runs as `SECURITY DEFINER`, so it bypasses RLS for internal writes — but the initial `supabase.rpc()` call itself must be authorized. If RLS on the `users` table blocks the call, the RPC returns a 403/RLS error.

**How to avoid:** The `deduct_credits_and_create_video` RPC should be callable by authenticated users (grant EXECUTE to `authenticated` role). The SECURITY DEFINER ensures the internal writes succeed. [ASSUMED — verify Supabase RPC grants pattern]

**Warning signs:** RPC returns `permission denied for table users` from inside the function.

### Pitfall 4: Concurrent duplicate Kling webhook delivery causes double refund

**What goes wrong:** Kling sends the same `task_status: "failed"` event twice in rapid succession. Both arrive before either updates the `video_history` status. Both pass the status check at line 176 (both see `processing`). Both issue a refund.

**How to avoid:** The idempotency guard at line 176 is a read-check-then-write pattern with a race window. For Phase 2, this is mitigated by the fact that the refund uses an INCREMENT (`credits + N`) rather than absolute set — a double-increment gives extra credits, which is worse than losing credits. Two options:
  - Accept the risk (Kling webhook duplicates are extremely rare in practice) [ASSUMED]
  - Use `processed_webhook_events` for the Kling webhook too (D-01 already supports this with `provider: "kling"`)

**Recommendation:** Add Kling webhook to `processed_webhook_events` dedup as well. The table already supports it via the `provider` field. This eliminates the race window entirely and satisfies the pattern's intent.

---

## Code Examples

### Supabase RPC invocation pattern

```typescript
// Source: [VERIFIED: Supabase JS docs — supabase.rpc()]
// Supabase client-side invocation of a PostgreSQL function
const { data, error } = await supabase.rpc("function_name", {
  param1: value1,
  param2: value2,
});
// data: return value of the function
// error: PostgreSQL exception or network error
```

### SQL increment for credit update (safe for concurrent writes)

```sql
-- Source: [VERIFIED: standard PostgreSQL pattern]
-- DO use this (atomic increment):
UPDATE users SET credits = credits + 50 WHERE id = $1;

-- DON'T use this (snapshot overwrite — race condition):
UPDATE users SET credits = 150 WHERE id = $1;
```

### `SELECT ... FOR UPDATE` in PL/pgSQL

```sql
-- Source: [VERIFIED: PostgreSQL docs — explicit locking]
-- Locks the row until the transaction completes; prevents concurrent deductions
SELECT credits INTO v_credits FROM users WHERE id = p_user_id FOR UPDATE;
```

---

## Runtime State Inventory

This is a code-only phase (no service renames, no rebrand). No runtime state audit required.

None — verified by phase scope review. Phase 2 adds a new table and modifies TypeScript handlers. No stored data keys, service configs, OS registrations, or build artifacts are renamed.

---

## Validation Architecture

No test framework exists in this project (verified: no jest.config, vitest.config, tests/ directory, or test scripts in package.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — Wave 0 must install |
| Config file | None — Wave 0 creates |
| Quick run command | `npm test -- --testPathPattern=credit` (after Wave 0) |
| Full suite command | `npm test` (after Wave 0) |

Given the project's `"mode": "yolo"` and no existing test infrastructure, and that the phase goal is hardening runtime behavior (atomicity, idempotency) that requires a real database to test meaningfully, the planner should decide: (a) install a test runner and write integration tests pointing at a test Supabase project, or (b) validate via manual end-to-end testing (D-06 already specifies E2E validation). The config's `nyquist_validation` key is absent (treated as enabled), but the absence of any test infrastructure makes automated unit tests impractical without Wave 0 setup.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRED-04 | Stripe webhook replay → no double-credit | E2E / manual | N/A (requires Stripe test webhook delivery) | ❌ Wave 0 |
| CRED-05 | Credit deduct + video_history insert are atomic | Integration | N/A (requires real DB) | ❌ Wave 0 |
| PAY-03 | Stripe duplicate event → 200 with no side effects | Integration | N/A | ❌ Wave 0 |
| ERR-04 | Kling failure webhook → credit refund guaranteed | E2E / manual | N/A | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] No test runner installed — add Jest or Vitest with ts-jest/vitest if automated tests are desired
- [ ] No test fixtures or Supabase test project configured
- [ ] D-06 specifies manual E2E validation; planner may choose to satisfy this via manual test scripts rather than a full test framework

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Supabase RLS + SECURITY DEFINER RPC (authenticated users only) |
| V5 Input Validation | yes | creditCost and user_id validated in RPC before mutation |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook replay / double-spend | Spoofing / Elevation | `processed_webhook_events` unique constraint |
| Concurrent credit deduction (race condition) | Tampering | `SELECT FOR UPDATE` inside RPC transaction |
| Credit manipulation via API | Tampering | RPC validates balance before deduct; RLS blocks direct `UPDATE users` |
| Refund to wrong user | Tampering | Refund reads `user_id` from `video_history` record (not from webhook payload) |

---

## Open Questions

1. **Does `video_history` need a `credit_cost` column?**
   - What we know: The webhook handler needs the credit amount to refund. Currently derivable from `model` via `getCreditCost()`.
   - What's unclear: Whether pricing may diverge from model names in the future (making derivation unreliable).
   - Recommendation: Add `credit_cost integer` to `video_history` in migration 010. Populate it inside the RPC. Eliminates any pricing-change risk.

2. **Should Kling webhook also use `processed_webhook_events` dedup?**
   - What we know: The Kling webhook has a status-based idempotency guard (line 176) but it has a race window. `processed_webhook_events` already supports `provider: "kling"`.
   - What's unclear: How often Kling delivers duplicate webhooks in practice.
   - Recommendation: Yes — add Kling dedup to `processed_webhook_events`. The table is already being created; adding one more INSERT per webhook is negligible overhead and closes the race window.

3. **Should the `transactions` table idempotency check in the Stripe handler be kept or removed after D-01?**
   - What we know: Lines 147-165 of stripe/route.ts check `transactions.stripe_session_id`. D-01 adds a cleaner, provider-agnostic check.
   - Recommendation: Keep both as defense-in-depth. The `transactions` check is a natural guard even without `processed_webhook_events`. Remove only if it causes confusion.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is code and SQL migration only. No new external tools, runtimes, or services required beyond the existing Supabase and Node.js environment already verified in Phase 1.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase RPC called with user-session client works when RPC is `SECURITY DEFINER` and `authenticated` role has EXECUTE grant | Pattern 1 / Pitfall 3 | RPC would return permission denied; fix is to add explicit GRANT or use service role client in generate route |
| A2 | Kling rarely delivers exact duplicate webhooks (race window in status check is acceptable without `processed_webhook_events` dedup) | Pitfall 4 | If duplicates are common, users receive extra credits on failure — financial exposure |
| A3 | `getCreditCost(model)` values are stable and will not change independently of model names | Pattern 3 | Refunds would be wrong amount if pricing changes without code deploy |

---

## Sources

### Primary (HIGH confidence)
- `app/api/generate/route.ts` — [VERIFIED: codebase] Current two-call deduction pattern (lines 119-157)
- `app/api/webhook/stripe/route.ts` — [VERIFIED: codebase] Existing idempotency pattern (lines 127-165)
- `app/api/webhook/video-complete/route.ts` — [VERIFIED: codebase] Current status idempotency guard (line 176) and missing refund path
- `scripts/001_create_tables.sql` — [VERIFIED: codebase] Schema for `users`, `video_history`, `transactions`

### Secondary (MEDIUM confidence)
- Supabase RPC / `supabase.rpc()` — standard documented pattern; [CITED: https://supabase.com/docs/reference/javascript/rpc]
- PostgreSQL `SELECT FOR UPDATE` — [CITED: https://www.postgresql.org/docs/current/explicit-locking.html]
- `SECURITY DEFINER` functions — [CITED: https://www.postgresql.org/docs/current/sql-createfunction.html]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all work is SQL + existing Supabase client
- Architecture: HIGH — patterns are derived directly from verified codebase analysis
- Pitfalls: HIGH (code bugs) / MEDIUM (race condition frequency — A2 assumption)

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable domain; only invalidated by Supabase API changes)
