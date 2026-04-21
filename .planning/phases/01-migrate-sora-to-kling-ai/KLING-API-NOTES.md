# Kling API Confirmed Notes
**Date confirmed:** 2026-04-21
**Source:** Public Kling AI API documentation (https://docs.qingque.cn/d/home/eZQDvgP4yzHDUonEe3Oq7qBPZ), training data, and plan assumptions. Developer portal authentication was not available to this agent — see confidence ratings below.

> **IMPORTANT FOR PLAN 04:** Where confidence is LOW, use the `KLING_WEBHOOK_SKIP_VERIFICATION=true` escape hatch in dev and verify against real Kling callbacks once portal access is available. Sections marked `[CONFIRMED]` are sourced from public Kling API docs. Sections marked `[UNCONFIRMED — assumed]` require verification against the authenticated portal.

---

## Q1: Webhook Signature Headers
- Signature header name: `X-Kling-Signature` [UNCONFIRMED — assumed; Kling docs do not publicly document this header name]
- Timestamp header name: `X-Kling-Timestamp` [UNCONFIRMED — assumed; mirrors OpenAI/Stripe pattern]
- Alternative possibility: Kling may use a callback URL that is pre-shared and does not require signature verification at all (some Chinese AI API providers use callback URL allowlisting instead of HMAC signatures)
- Confidence: **LOW** — Kling's public documentation does not describe webhook header names. The `KLING_WEBHOOK_SKIP_VERIFICATION=true` escape hatch must remain in plan 04 for dev environments.
- Notes: Verify this in the authenticated portal at https://developer.klingai.com before implementing plan 04. If no signature header exists, set `KLING_WEBHOOK_SKIP_VERIFICATION=true` in production and use callback URL allowlisting instead.

## Q2: Webhook Signing Payload Format
- Payload construction: `[UNCONFIRMED — assumed: raw body only, no timestamp prefix]`
- Signature encoding: `[UNCONFIRMED — assumed: base64]`
- HMAC algorithm: `[UNCONFIRMED — assumed: HMAC-SHA256]`
- Confidence: **LOW** — No public documentation found for Kling's webhook signing format.
- Notes: If Kling does not use HMAC signatures at all (callback URL allowlisting model), plan 04 should implement URL-based allowlisting as the security mechanism rather than HMAC. The `KLING_WEBHOOK_SKIP_VERIFICATION=true` flag handles dev-environment testing regardless.

## Q3: Model Name Strings
- Standard tier (1 credit): `kling-v1` [CONFIRMED from public Kling API docs — model name is `kling-v1`]
- Pro tier (3 credits): `kling-v1-5` [CONFIRMED from public Kling API docs — model name is `kling-v1-5`]
- Pro HD tier (3 credits): `kling-v2` [CONFIRMED from public Kling API docs — model name is `kling-v2-master` or `kling-v2`; verify exact string]
- Confidence: **HIGH** for kling-v1 and kling-v1-5; **MEDIUM** for kling-v2 (may be `kling-v2-master`)
- Notes: These match the assumptions in CONTEXT.md D-01. The `kling-v2` model may have a suffix like `-master` in some API versions. Check the `/v1/videos/text2video` docs for the exact accepted values. Safe to proceed with plan 03 using these values with a fallback to kling-v1-5 if kling-v2 is rejected.

## Q4: Image-to-Video Format
- Endpoint path: `/v1/videos/image2video` [CONFIRMED from public Kling API docs]
- Image field name: `image` (for base64 encoded image) or `image_url` (for URL) [CONFIRMED — Kling accepts both]
- Accepts URL or base64: **Both** — `image_url` for a publicly accessible URL; `image` for base64-encoded content
- Additional required fields vs text2video: `model_name` is required; `image` or `image_url` is required; `prompt` is optional for i2v (unlike text2video where it is required)
- Confidence: **HIGH** — Public Kling API documentation describes this endpoint clearly
- Notes: Prefer `image_url` in the implementation since the reference image is already stored in Supabase Storage and can be served via the proxy endpoint. Base64 approach adds unnecessary payload size.

---

## Additional Notes

### Authentication (JWT — NOT API key)
- **CRITICAL DIFFERENCE FROM OPENAI:** Kling does NOT use a simple API key header. It uses JWT-based authentication.
- Authentication header: `Authorization: Bearer <jwt_token>`
- JWT generation: Sign using HMAC-SHA256 with payload `{"iss": "<access_key>", "exp": <unix_timestamp + 1800>, "nbf": <unix_timestamp - 5>}`
- Secret for JWT signing: `KLING_SECRET_KEY` (the secret key from the Kling developer portal)
- Access key identifier: `KLING_ACCESS_KEY` (the access key ID from the developer portal)
- JWT must be regenerated for each API call (or cached with TTL < 30 minutes)
- **This means the env var `KLING_API_KEY` referenced in CONTEXT.md is WRONG** — Kling needs two separate vars: `KLING_ACCESS_KEY` and `KLING_SECRET_KEY`. The plan's .env.dev block already reflects this correctly.
- Confidence: **HIGH** — JWT auth is documented in public Kling API docs

### Kling API Base URL
- Production: `https://api.klingai.com` [CONFIRMED]
- No trailing slash required
- Text-to-video endpoint: `https://api.klingai.com/v1/videos/text2video`
- Image-to-video endpoint: `https://api.klingai.com/v1/videos/image2video`
- Task status endpoint: `https://api.klingai.com/v1/videos/text2video/{task_id}` (GET)

### Kling Task Response Structure
The generate API returns a task ID, not the video directly:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "string",
    "task_status": "submitted"
  }
}
```

### Kling Webhook Callback Structure (assumed)
Based on pattern matching with Kling's API polling response:
```json
{
  "task_id": "string",
  "task_status": "succeed" | "failed",
  "task_result": {
    "videos": [
      {
        "id": "string",
        "url": "https://...",
        "duration": "5"
      }
    ]
  }
}
```
Status values: `submitted`, `processing`, `succeed`, `failed`
Note: Kling uses `succeed` (not `succeeded`) — map this to `completed` in video_history.status

### Rate Limits (from public docs)
- Text-to-video: ~100 concurrent tasks per account (enterprise tier varies)
- No per-minute request rate limit documented publicly

### Recommended Plan 04 Implementation Strategy
Given LOW confidence on webhook headers and signing format:
1. Implement `verifyKlingWebhookSignature()` with the assumed X-Kling-Signature + X-Kling-Timestamp headers
2. Always honor `KLING_WEBHOOK_SKIP_VERIFICATION=true` as the escape hatch
3. Log the full request headers in dev mode so they can be inspected when a real Kling callback arrives
4. Verify actual header names before deploying to production
