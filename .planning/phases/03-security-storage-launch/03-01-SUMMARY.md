---
phase: 03-security-storage-launch
plan: "01"
subsystem: video-proxy
tags: [video, storage, supabase, redirect, env]
dependency_graph:
  requires: []
  provides: [working-video-proxy, next-public-app-url]
  affects: [app/api/video/[videoId]/content/route.ts, .env.dev]
tech_stack:
  added: []
  patterns: [302-redirect, supabase-storage-url]
key_files:
  created: []
  modified:
    - app/api/video/[videoId]/content/route.ts
    - .env.dev (gitignored — updated on disk only)
decisions:
  - "Replace dead OpenAI proxy with 302 redirect to Supabase Storage URL stored in video_history.video_url"
  - "NEXT_PUBLIC_APP_URL added to .env.dev; file is gitignored so change is disk-only"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
requirements:
  - VID-04
  - INFRA-01
---

# Phase 03 Plan 01: Fix Video Proxy and Add NEXT_PUBLIC_APP_URL Summary

**One-liner:** Replaced dead OpenAI video proxy with 302 redirect to Supabase Storage URL and added missing NEXT_PUBLIC_APP_URL dev env var.

## What Was Built

**Task 1 — Fix video proxy route**

The `GET /api/video/[videoId]/content` route was fetching video bytes from `https://api.openai.com/v1/videos/{job_id}/content` — a dead endpoint since Phase 1 migrated video generation to Kling AI. Videos are now stored in Supabase Storage and `video_history.video_url` holds the public URL.

Changes to `app/api/video/[videoId]/content/route.ts`:
- `.select("job_id, user_id, status")` → `.select("video_url, user_id, status")`
- Removed `if (!video.job_id)` null check block
- Added `if (!video.video_url)` null check returning 400
- Replaced entire OpenAI fetch + blob + response block with `return NextResponse.redirect(video.video_url, 302)`
- Updated catch block log tag from `[v0]` to `[VideoProxy]`

Auth check, ownership check (`.eq("user_id", authUser.id)`), and status check are preserved verbatim.

**Task 2 — Add NEXT_PUBLIC_APP_URL to .env.dev**

Added `NEXT_PUBLIC_APP_URL=http://localhost:3000` after the `SUPABASE_SERVICE_ROLE_KEY` line in `.env.dev`. This env var was missing, which caused the Kling webhook callback URL to be empty, leaving all video generations stuck in "processing" status.

Note: `.env.dev` is gitignored — the change was applied to the file on disk at the main repo path. No git commit was made for this file (as expected for secrets files).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 43ee2e0 | fix(03-01): replace OpenAI proxy with Supabase Storage redirect |

## Deviations from Plan

### Environment Constraints

**1. [Rule 3 - Environment] TypeScript build check skipped — no node_modules installed**
- **Found during:** Post-task verification
- **Issue:** `node_modules` not present in worktree or main repo; `tsc --noEmit` cannot run
- **Impact:** Cannot confirm zero TypeScript errors from CI; however the code change is straightforward (select different column, return redirect) and no type-level issues are expected
- **Action:** Documented; no fix attempted as this is a pre-existing environment state

**2. [Info] .env.dev is gitignored — Task 2 commit is disk-only**
- The plan's `files_modified` lists `.env.dev` but this file is gitignored by design (contains secrets). The env var was successfully added to the file on disk.

## Known Stubs

None.

## Threat Flags

No new security surface introduced. The 302 redirect exposes the Supabase Storage URL directly to the client — this is accepted per T-03-01-03 (bucket is public by design).

## Self-Check: PASSED

- route.ts exists and contains redirect logic (verified via Read tool)
- Commit 43ee2e0 exists in git log
- .env.dev updated on disk (gitignored, not committable)
