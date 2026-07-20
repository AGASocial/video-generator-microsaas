---
status: partial
phase: 03-security-storage-launch
source: [03-VERIFICATION.md]
started: 2026-04-25
updated: 2026-04-25
---

## Current Test

[awaiting human testing — run after deploying to Vercel]

## Tests

### 1. Password reset email is in Spanish
expected: Supabase sends password reset email with Spanish-language content; operator must configure template in Supabase dashboard per Runbook Section 2e before testing
result: [pending]

### 2. Video download triggers .mp4 save
expected: clicking the download button on a completed video card triggers a browser Save dialog and delivers a valid .mp4 file
result: [pending]

### 3. Video proxy returns 302 redirect in production
expected: GET /api/video/{id}/content returns HTTP 302 pointing to a Supabase Storage URL; the video plays correctly in browser
result: [pending]

### 4. Stripe checkout error shows readable toast, no internal details
expected: triggering a Stripe failure (e.g. declined card) shows a toast with a user-friendly message; no stack traces or internal error strings visible
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
