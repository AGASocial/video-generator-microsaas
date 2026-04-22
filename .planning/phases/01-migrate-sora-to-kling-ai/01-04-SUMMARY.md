---
plan: 01-04
phase: 01-migrate-sora-to-kling-ai
status: complete
completed: 2026-04-22
---

# Plan 01-04: Kling Webhook Handler + Video Storage

## What Was Built

**Task 1 — lib/video-storage.ts:** Added `downloadAndStoreVideoFromKling()` function. Wraps the existing generic `downloadAndStoreVideo()` — Kling CDN is public, no auth header needed. Includes 24-hour expiry warning comment. Existing functions untouched.

**Task 2 — app/api/webhook/video-complete/route.ts:** Full rewrite for Kling's webhook format:
- `verifyKlingWebhookSignature()` — HMAC-SHA256 with timing-safe comparison (`crypto.timingSafeEqual`)
- Replay attack protection: rejects timestamps older than 5 minutes (STAT-05)
- Idempotency: returns 200 immediately if video status is already terminal (STAT-04)
- `KLING_WEBHOOK_SKIP_VERIFICATION=true` escape hatch for dev
- On `succeed` event: downloads from Kling CDN via `downloadAndStoreVideoFromKling()` immediately
- All error paths log `[KlingWebhook]` prefix with videoId + taskId + error (ERR-03)

## Deviations / Notes

- Webhook signature headers (X-Kling-Signature, X-Kling-Timestamp) and signing payload format are UNCONFIRMED per KLING-API-NOTES.md Q1/Q2 (LOW confidence). Implementation uses assumed values matching OpenAI pattern. `KLING_WEBHOOK_SKIP_VERIFICATION=true` is the escape hatch until real Kling callbacks confirm the format.

## Self-Check: PASSED

- `grep "verifyKlingWebhookSignature"` → present ✓
- `grep "timingSafeEqual"` → present (STAT-03) ✓
- `grep "fiveMinutes"` → present (STAT-05) ✓
- `grep "downloadAndStoreVideoFromKling"` → present in both files ✓
- `grep "OpenAI\|OPENAI_WEBHOOK"` → 0 results ✓

## Commits

- `7f7e3fb`: feat(01-04): rewrite webhook handler for Kling — signature verification, idempotency, replay protection
