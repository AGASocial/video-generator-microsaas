# Phase 3: Security, Storage & Launch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 03-security-storage-launch
**Areas discussed:** Testing scope, Checklist delivery format, Deploy target

---

## Gray Areas Presented

| Option | Description | Selected |
|--------|-------------|----------|
| RLS audit scope | How deep to audit: verify existing policies vs full service role audit | |
| Video download UX | Download button behavior, filename, placement | |
| Password reset email | Custom SMTP vs Supabase template editor | |
| Stripe error surface | Toast vs error page vs redirect with message | |

**User's response:** "I got all that already, I'm going to deploy. Just missing testing."

---

## Testing Scope

| Option | Description | Selected |
|--------|-------------|----------|
| RLS isolation tests | SQL or API-level tests for cross-user isolation | |
| Webhook end-to-end | Stripe + Kling replay protection and refund path | |
| Video proxy + download | Content-type and download smoke test | |
| Pre-deploy checklist | Env vars, no missing-env errors, key flow smoke tests | ✓ |

**User's choice:** Pre-deploy checklist

---

## Checklist Delivery Format

| Option | Description | Selected |
|--------|-------------|----------|
| Runbook doc | Markdown checklist in .planning/ | ✓ |
| Executable script | Shell/Node script with pass/fail output | |
| Both | Runbook + script | |

**User's choice:** Runbook doc

---

## Deploy Target

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel | Set env vars via Vercel dashboard or vercel env | ✓ |
| Other platform | Self-hosted, Railway, Render, etc. | |

**User's choice:** Vercel

---

## Claude's Discretion

- If checklist reveals missing implementations (download button, Spanish email, Stripe error handler), plan includes the fix before the validation step.
- RLS verification via Supabase dashboard or SQL — no test harness.
- Stripe error surface: minimal toast/redirect with generic message if not already handled.

## Deferred Ideas

None.
