---
plan: 01-03
phase: 01-migrate-sora-to-kling-ai
status: complete
completed: 2026-04-22
---

# Plan 01-03: Rewrite generate route for Kling AI

## What Was Built

Rewrote `app/api/generate/route.ts` to replace the OpenAI Sora API call with Kling AI. The generate route now:
- Calls `generateKlingToken()` to produce a fresh JWT per request
- POSTs to `api.klingai.com/v1/videos/text2video` (or `/image2video` for i2v)
- Always returns `status: "processing"` — Kling is always async
- Maps Kling HTTP error codes to `errors.kling.*` i18n keys
- Refunds credits on any Kling API failure (same behavior as before)
- Stores Kling `task_id` in `video_history.job_id`

## Key Changes

- **Removed:** entire `pollVideoStatus` function (~100 lines), OpenAI fetch block, sync-completion branch (`if openaiData.status === "completed"`), `soraVideoId` variable, `downloadAndStoreVideoFromOpenAI` import
- **Added:** `generateKlingToken` import, Kling JWT auth per request, `callback_url` field pointing to webhook endpoint, error-to-i18n-key mapping
- **Image-to-video:** Uses `image_url` field with Supabase URL (confirmed from KLING-API-NOTES.md Q4 — preferred over base64)

## Self-Check: PASSED

- `grep "pollVideoStatus" app/api/generate/route.ts` → 0 results ✓
- `grep "OPENAI_API_KEY" app/api/generate/route.ts` → 0 results ✓
- `grep "generateKlingToken" app/api/generate/route.ts` → present ✓
- `grep "klingai.com" app/api/generate/route.ts` → present ✓
- `grep "task_id" app/api/generate/route.ts` → 3+ results ✓
- `grep "errors.kling" app/api/generate/route.ts` → 3+ results ✓

## Commits

- `ae91722`: feat(01-03): rewrite generate route for Kling AI — replace Sora with JWT-based Kling API call
