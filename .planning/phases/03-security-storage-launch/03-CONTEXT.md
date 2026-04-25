# Phase 3: Security, Storage & Launch - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Pre-deploy validation and hardening before accepting real users. The platform is code-complete. This phase is about **verifying** everything works in production and producing a runbook that gives confidence before flipping the switch.

In scope: pre-deploy runbook, RLS policy verification, env var audit, video proxy confirmation, download button, password reset Spanish email, Stripe error surface
Out of scope: new features, repricing, UI redesign, analytics

</domain>

<decisions>
## Implementation Decisions

### Delivery Format
- **D-01:** The primary output is a **markdown runbook** (`.planning/phases/03-security-storage-launch/PRE-DEPLOY-RUNBOOK.md`) — a top-to-bottom checklist the operator works through before going live. No automated scripts needed.

### Deploy Target
- **D-02:** Deploying to **Vercel**. Env var instructions reference Vercel dashboard and `vercel env` CLI. Production domain already configured.

### Testing Scope
- **D-03:** User confirmed the feature work (RLS, proxy, download, password reset, Stripe error) is already implemented. The gap is a structured pre-deploy checklist, not new code.
- **D-04:** Runbook must cover: all production env vars verified, RLS isolation checked (SQL or dashboard), video proxy smoke test, download button smoke test, password reset flow check, Stripe checkout error path check.

### Claude's Discretion
- If any checklist item reveals a missing implementation (e.g., download button doesn't exist, Spanish email not configured), the plan should include the fix as a task before the runbook step that validates it.
- RLS verification: use Supabase dashboard Table Editor or a SQL query to confirm policies exist and are enabled — no test harness required unless policies are found to be missing.
- Stripe error surface: if no checkout error handler exists, add a minimal toast/redirect with a generic user-facing message (no internal details).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & RLS
- `scripts/001_create_tables.sql` — Defines RLS policies for `users`, `video_history`, `transactions` tables. Verify these are applied in production.
- `scripts/005_add_users_insert_policy.sql` — Supplemental users insert policy.
- `scripts/010_create_processed_webhook_events.sql` — Webhook events table (Phase 2).
- `scripts/011_create_deduct_credits_rpc.sql` — Atomic credit RPC (Phase 2).

### API Routes to smoke-test
- `app/api/video/[videoId]/content/route.ts` — Video proxy; must return correct content-type in production.
- `app/api/webhook/stripe/route.ts` — Stripe webhook; idempotency verified in Phase 2.
- `app/api/webhook/video-complete/route.ts` — Kling webhook; signature verification + refund path verified in Phases 1–2.

### Environment
- `.env.dev` — Dev env var reference. Production equivalents: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live), `KLING_ACCESS_KEY`, `KLING_SECRET_KEY`, `KLING_WEBHOOK_SECRET`.

### Phase Context (prior decisions that apply)
- `.planning/phases/01-migrate-sora-to-kling-ai/01-CONTEXT.md` — Kling env var naming conventions.
- `.planning/phases/02-credit-system-hardening/02-CONTEXT.md` — Webhook idempotency and RPC decisions.

### Requirements being closed
- `INFRA-01`, `INFRA-02` — Env vars and RLS
- `VID-03`, `VID-04` — Download button and video proxy
- `AUTH-03` — Spanish password reset email
- `ERR-02` — Stripe checkout error surface

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/001_create_tables.sql` — RLS policies already written; verification is SQL-level, not code changes.
- `app/api/video/[videoId]/content/route.ts` — Video proxy exists; needs production smoke test.

### Established Patterns
- `console.log("[ContextTag]")` logging prefix — use `[PreDeploy]` or context-specific tags in any new logging.
- i18n via `messages/es.json` + `messages/en.json` — any new user-facing error strings go here.

### Integration Points
- Vercel dashboard / `vercel env` CLI — env vars are set and pulled via these.
- Supabase dashboard — RLS verification and email template configuration happen here, not in code.

</code_context>

<specifics>
## Specific Ideas

- The user confirmed all feature work is already done — this phase is purely verification + runbook production.
- If gaps are found during verification (e.g., a missing env var, a broken proxy), fixes are small and in-scope.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-security-storage-launch*
*Context gathered: 2026-04-25*
