---
phase: 01-migrate-sora-to-kling-ai
plan: "05"
subsystem: i18n
tags: [i18n, error-messages, kling, next-intl]
dependency_graph:
  requires: ["01-02"]
  provides: ["errors.kling i18n keys for UI rendering"]
  affects: ["messages/es.json", "messages/en.json"]
tech_stack:
  added: []
  patterns: ["next-intl key lookup via dot-notation string"]
key_files:
  modified:
    - messages/es.json
    - messages/en.json
decisions:
  - "Added errors.kling.* as a new top-level 'errors' key rather than nesting under existing sections, matching the key path returned by app/api/generate/route.ts"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-21"
  tasks_completed: 2
  files_changed: 2
---

# Phase 01 Plan 05: Add Kling Error i18n Keys Summary

**One-liner:** Added `errors.kling.*` block with five translated error keys to both es.json and en.json for user-facing Kling API error display via next-intl.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add errors.kling.* keys to messages/es.json | 32bf1e3 | messages/es.json |
| 2 | Add errors.kling.* keys to messages/en.json | c4b6dc2 | messages/en.json |

## What Was Built

Both i18n message files now contain a top-level `errors` key with a `kling` sub-object. The five keys match exactly the error key strings returned by `app/api/generate/route.ts`:

- `errors.kling.rateLimit`
- `errors.kling.contentPolicy`
- `errors.kling.modelUnavailable`
- `errors.kling.generationFailed`
- `errors.kling.unknownError`

Without these keys, users would see raw key strings (e.g., "errors.kling.rateLimit") instead of readable error messages in the UI.

## Verification

- `node -e "JSON.parse(...es.json); console.log('ok')"` — Valid JSON
- `node -e "JSON.parse(...en.json); console.log('ok')"` — Valid JSON
- All five keys confirmed present in both files
- All existing keys unchanged (verified videoList and common still present)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The added content is static translated strings with no user input, no network endpoints, and no trust boundary exposure. JSON validity is enforced by node at commit time (T-05-02 mitigated).

## Self-Check: PASSED

- messages/es.json modified and committed at 32bf1e3
- messages/en.json modified and committed at c4b6dc2
- Both files parse as valid JSON
- All five kling error keys present in both files
