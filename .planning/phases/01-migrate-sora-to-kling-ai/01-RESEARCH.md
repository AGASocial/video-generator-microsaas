# Phase 1: Provider Migration - Research

**Researched:** 2026-04-21
**Domain:** Kling AI API integration — video generation, webhook handling, JWT authentication
**Confidence:** MEDIUM (Kling's official docs require login; findings cross-verified via multiple third-party implementations and community sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep 3 tiers — map directly from Sora to Kling models:
  - sora-2 → `kling-v1` (1 credit — Standard)
  - sora-2-pro → `kling-v1-5` (3 credits — Pro)
  - sora-2-pro-HD → `kling-v2` (3 credits — Pro HD)
- **D-02:** Do NOT reprice credits in Phase 1. Keep costs at 1/3/3.

### Claude's Discretion
- **Idempotency approach:** Use lightweight mechanism for Phase 1 — a `processed` flag or unique constraint on `video_history.job_id` to prevent double-processing Kling completion events. Do NOT build `processed_webhook_events` table yet (Phase 2 scope).
- **Polling fallback:** Remove `pollVideoStatus`. Kling's webhook is the sole completion path.
- **Error message i18n:** Add new i18n keys under `errors.kling.*` in `messages/es.json` and `messages/en.json`. Reuse existing error display UI.
- **Kling API client:** Use native `fetch` (no SDK unless Kling's official SDK matures).
- **Webhook signature scheme:** Implement Kling's actual header names and signing format — not OpenAI's.

### Deferred Ideas (OUT OF SCOPE)
- Credit repricing — defer until Kling production costs confirmed
- `processed_webhook_events` table — Phase 2 scope
- Polling fallback for Kling — removed in Phase 1; re-evaluate if unreliable
- Additional Kling model tiers — future phase once migration is stable
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAT-03 | Kling webhook signature verified using HMAC before processing; invalid signatures rejected with 401 | JWT auth confirmed; webhook signature scheme is ASSUMED (see A2) |
| STAT-04 | Kling webhook handler is idempotent — replaying the same completion event does not update video record twice | Stripe pattern confirmed reusable; job_id unique check is the mechanism |
| STAT-05 | Kling webhook handler rejects events with timestamps older than 5 minutes | Replay protection via timestamp check in signing payload or payload field; see A2 |
| ERR-01 | Kling API errors (rate limit, content policy, unavailable) caught and surfaced with human-readable message in ES/EN | Error categories confirmed; i18n key structure researched |
| ERR-03 | Server-side errors in webhook handlers logged with sufficient context (video ID, event type, error message) | Current logging pattern confirmed reusable with [KlingWebhook] prefix |
</phase_requirements>

---

## Summary

The Kling AI official API (`api.klingai.com`) uses **JWT-based authentication** rather than a static bearer token. The JWT is generated per-request using an AccessKey and SecretKey obtained from the Kling developer console, signed with HS256 algorithm. This is a meaningful difference from the current Sora integration, which uses a static `OPENAI_API_KEY`. The generate route must implement a JWT token generator that constructs and signs a fresh (or cached) token for every Kling API call.

The video generation endpoint is asynchronous only — Kling always returns a `task_id` immediately with `task_status: "submitted"`. There is no synchronous completion path (unlike Sora, which could return `status: "completed"` in the same response). This simplifies the generate route: always store the `task_id`, always wait for the webhook — no inline-download branch. The polling fallback (`pollVideoStatus`) is removed per the locked decision.

The webhook signature scheme for Kling's native API is **not publicly documented** in non-authenticated sources. Multiple third-party providers (PiAPI, Pollo AI, EvoLink) implement Kling API access with their own signature schemes that differ from Kling's. The planner must include a Wave 0 discovery task to read the actual Kling developer portal docs and confirm the exact webhook header names, signing algorithm, and payload construction before the webhook handler can be written. A skip-verification env var (`KLING_WEBHOOK_SKIP_VERIFICATION`) is essential for unblocking development while signature details are confirmed.

**Primary recommendation:** Implement the generate route change first (JWT auth + Kling endpoint + task_id storage), then the webhook handler with skip-verification for dev, then fill in the real signature scheme once confirmed via Kling developer docs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Video generation request | API Layer (`app/api/generate/route.ts`) | — | Auth, credit check, DB write all server-side; no browser involvement |
| JWT token generation for Kling | API Layer (utility function) | — | Tokens must never be generated browser-side; must stay server-only |
| Webhook signature verification | API Layer (`app/api/webhook/video-complete/route.ts`) | — | Raw body + HMAC verification is server-only; requires `runtime = "nodejs"` |
| Kling job ID storage | Database (Supabase `video_history.job_id`) | — | Existing column; no schema change needed |
| Idempotency check | API Layer (webhook route) | Database | Select-before-update pattern on `video_history.job_id`; mirrors Stripe pattern |
| Video download from Kling | API Layer (`lib/video-storage.ts`) | — | Download URL changes; upload-to-Supabase logic unchanged |
| Error message surfacing | API Layer (generate route response) | Frontend (i18n key lookup) | Server returns error key; client renders translated string |
| i18n error strings | Messages layer (`messages/es.json`, `messages/en.json`) | — | New `errors.kling.*` keys; no component changes needed |

---

## Standard Stack

### Core (Required for This Phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jsonwebtoken` | 9.x | Generate JWT tokens for Kling API auth | Standard Node.js JWT library; already likely in ecosystem |
| `crypto` (Node built-in) | — | HMAC-SHA256 for webhook signature verification | Already used in current webhook handler; no install needed |
| `next` | existing | API routes, webhook handler | Already installed |

**Version verification:**
```bash
npm view jsonwebtoken version
# Verified: 9.0.2 [VERIFIED: npm registry search results]
```

**Note:** The `jsonwebtoken` library may already be present. Check `package.json` before installing.

**Alternative:** Implement JWT manually using `crypto` (no additional dependency) — the pattern from `generate-jwt.mjs` in the mcp-kling project shows this is feasible with ~20 lines of code using `crypto.createHmac`. [VERIFIED: github.com/199-mcp/mcp-kling/blob/main/generate-jwt.mjs]

**Installation (only if not present):**
```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/jsonwebtoken` | 9.x | TypeScript types for JWT | If using `jsonwebtoken` npm package |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jsonwebtoken` npm package | Manual JWT via Node `crypto` | Manual approach: zero dependencies, ~20 lines of code; jwt package: well-tested, more readable. Either works; prefer manual if avoiding new deps |
| Kling's native webhook | Third-party Kling proxy (PiAPI, Pollo, EvoLink) | Third-party adds abstraction but different endpoint/auth/webhook format; locked decision is native Kling API |

---

## Architecture Patterns

### System Architecture Diagram

```
User Browser
    |
    v
POST /api/generate
    |
    +-- Auth check (Supabase)
    +-- Credit check + deduct
    +-- Insert video_history (status: "processing")
    +-- Generate JWT token [NEW: HS256, iss=AccessKey]
    +-- POST api.klingai.com/v1/videos/text2video (or image2video)
    |       {model_name, prompt, duration, aspect_ratio, callback_url}
    +-- Store task_id in video_history.job_id
    +-- Return {videoId, status: "processing"} to client
    
                    [async — Kling generates video]
                            |
                            v
                   POST /api/webhook/video-complete [REWRITTEN]
                            |
                   +-- Read raw body (request.text())
                   +-- Verify signature [ASSUMED scheme — see A2]
                   +-- Check timestamp (> 5 min → 401)
                   +-- Parse JSON: extract task_id + task_status
                   +-- Lookup video_history WHERE job_id = task_id
                   +-- Idempotency check: status already "completed"? → 200 skip
                   +-- If task_status == "succeed":
                   |       download from task_result.videos[0].url
                   |       upload to Supabase Storage
                   |       update video_history (status: "completed", video_url)
                   +-- If task_status == "failed":
                   |       update video_history (status: "failed")
                   +-- Return 200

Client polls GET /api/video/status?videoId=X
    |
    v
Returns {status} from video_history — no change to polling client
```

### Recommended Project Structure

No new directories required. Changes touch existing files:

```
app/api/
├── generate/route.ts          # Replace Sora call with Kling; remove pollVideoStatus
├── webhook/
│   └── video-complete/route.ts  # Full rewrite for Kling signature + payload
lib/
├── kling-auth.ts              # NEW: JWT generation helper (generateKlingToken)
├── video-storage.ts           # Adapt: replace OpenAI URL with Kling CDN URL
├── products.ts                # Update: model name string constants only
messages/
├── es.json                    # Add: errors.kling.* keys
└── en.json                    # Add: errors.kling.* keys
```

### Pattern 1: JWT Token Generation for Kling API

**What:** Generate a short-lived JWT signed with `KLING_SECRET_KEY`, used as the Bearer token for every Kling API request.

**When to use:** Every outbound call to `api.klingai.com` — both generation requests and any status queries.

**Example (manual, no extra dependency):**
```typescript
// lib/kling-auth.ts
// Source: pattern verified from github.com/199-mcp/mcp-kling generate-jwt.mjs
import crypto from "crypto";

function base64url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function generateKlingToken(): string {
  const accessKey = process.env.KLING_ACCESS_KEY!;
  const secretKey = process.env.KLING_SECRET_KEY!;
  
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    iss: accessKey,
    exp: now + 1800,  // 30-minute expiry
    nbf: now - 5,     // valid 5s ago (clock skew tolerance)
  }));
  
  const message = `${header}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  
  return `${message}.${signature}`;
}
```

**Critical note:** `KLING_ACCESS_KEY` and `KLING_SECRET_KEY` are separate credentials — not the same as a single `OPENAI_API_KEY`. Both must be added as env vars.

### Pattern 2: Kling Video Generation Request

**What:** POST to Kling's text2video or image2video endpoint.

**When to use:** In `app/api/generate/route.ts` replacing the Sora fetch call.

**Example (text-to-video):**
```typescript
// Source: cross-verified from multiple sources including pythonbid.com Kling tutorial,
// mcp-kling docs, and agentsapis.com Kling API guide [MEDIUM confidence]
const klingApiUrl = process.env.KLING_API_URL || "https://api.klingai.com";
const token = generateKlingToken();

const response = await fetch(`${klingApiUrl}/v1/videos/text2video`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model_name: model,           // "kling-v1" | "kling-v1-5" | "kling-v2"
    prompt: finalPrompt,
    duration: duration,          // integer (seconds)
    aspect_ratio: aspectRatio,   // "16:9" | "9:16" | "1:1"
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/video-complete`,
    mode: "std",                 // or "pro" — [ASSUMED] may differ per model tier
  }),
});

const data = await response.json();
// data.data.task_id — the job ID to store in video_history.job_id
// data.data.task_status — initially "submitted"
```

**Image-to-video:** Same endpoint structure but `POST /v1/videos/image2video` with an additional `image` field (URL or base64). The exact field name (`image` vs `image_url` vs `image_file`) is [ASSUMED] — must be confirmed from Kling docs.

### Pattern 3: Kling Webhook Payload (Status Callback)

**What:** The structure of the POST body Kling sends to `callback_url` when a task completes.

**When to use:** In the webhook handler to extract job ID and status.

**Expected payload (cross-verified, MEDIUM confidence):**
```typescript
// Source: Cross-verified via multiple community implementations and mcp-kling docs
// [CITED: github.com/199-mcp/mcp-kling/blob/main/kling-api-docs.md]
interface KlingWebhookPayload {
  code: number;           // 0 = success
  message: string;        // "SUCCEED" or error message
  request_id: string;
  data: {
    task_id: string;      // matches video_history.job_id
    task_status: string;  // "submitted" | "processing" | "succeed" | "failed"
    task_status_msg?: string;
    task_result?: {
      videos: Array<{
        id: string;
        url: string;      // CDN URL — valid 24 hours only!
      }>;
    };
  };
}
```

**CRITICAL:** Kling video URLs are only valid for **24 hours**. The webhook handler must download and store the video to Supabase immediately on receipt — not defer it.

### Pattern 4: Idempotency Check (Stripe Pattern Adapted)

**What:** Prevent double-processing the same Kling completion event.

**When to use:** At the start of webhook processing, before any state changes.

```typescript
// Source: adapted from app/api/webhook/stripe/route.ts idempotency pattern
// [VERIFIED: read from codebase]
const { data: videoEntry } = await supabase
  .from("video_history")
  .select("id, user_id, status, job_id")
  .eq("job_id", taskId)
  .single();

if (!videoEntry) {
  console.error("[KlingWebhook] Video not found for task_id:", taskId);
  return NextResponse.json({ error: "Video not found" }, { status: 404 });
}

// Idempotency: skip if already processed
if (videoEntry.status === "completed" || videoEntry.status === "failed") {
  console.log("[KlingWebhook] Event already processed for task_id:", taskId);
  return NextResponse.json({ received: true });
}
```

### Anti-Patterns to Avoid

- **Do not generate JWT in the browser:** AccessKey/SecretKey are server secrets. JWT generation belongs only in server-side API routes or utilities.
- **Do not reuse the same JWT token across requests:** Tokens expire in 30 minutes. Either generate a fresh token per request or implement short-lived caching.
- **Do not assume Kling video URLs are permanent:** CDN URLs expire in 24 hours. Download to Supabase immediately in the webhook handler.
- **Do not assume synchronous completion:** Unlike Sora, Kling always returns `task_status: "submitted"` — never `"succeed"` on the initial generation response. The synchronous-completion branch in the current generate route must be removed.
- **Do not keep the polling fallback:** `pollVideoStatus` must be removed. Its removal simplifies the code and is a locked decision.
- **Do not expose JWT generation errors:** If `KLING_ACCESS_KEY` or `KLING_SECRET_KEY` is missing, return a clean 500 error — same pattern as current missing `OPENAI_API_KEY` check.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT generation | Custom base64/HMAC implementation from scratch | Manual crypto pattern (verified) or `jsonwebtoken` npm | The base64url encoding with `+`/`/`/`=` replacement is a known pitfall — use the verified pattern |
| Webhook replay protection | Custom timestamp database table | Timestamp field in webhook payload + 5-minute window check | Matches the existing pattern in the current webhook handler; no schema change |
| Video URL persistence | Trusting Kling CDN URL as permanent | Download + re-upload to Supabase Storage immediately | Kling CDN URLs expire in 24 hours |

**Key insight:** The hardest part of this migration is the JWT auth scheme and the unknown webhook signature format — not the business logic, which is nearly identical to the existing Sora integration.

---

## Runtime State Inventory

> This is NOT a rename/refactor phase. No runtime state inventory is needed.
> The only "runtime" concern is that new env vars (`KLING_ACCESS_KEY`, `KLING_SECRET_KEY`, `KLING_WEBHOOK_SECRET`, `KLING_API_URL`) must be added to `.env.dev` and `.env.prod`.

---

## Common Pitfalls

### Pitfall 1: JWT Token Auth vs Static API Key

**What goes wrong:** Developer treats `KLING_ACCESS_KEY` like `OPENAI_API_KEY` and passes it directly as a Bearer token. Kling rejects all requests with 401.

**Why it happens:** The Sora integration uses `Authorization: Bearer ${OPENAI_API_KEY}` — a direct static key. Kling uses a signed JWT that encodes the AccessKey in the `iss` claim and is signed with the SecretKey.

**How to avoid:** Implement `generateKlingToken()` as a dedicated function. Never use `KLING_ACCESS_KEY` directly as a Bearer value.

**Warning signs:** Consistent 401 responses from `api.klingai.com` despite correct credentials.

### Pitfall 2: Kling Webhook Signature Scheme is Underdocumented

**What goes wrong:** The webhook handler implements signature verification based on assumptions or analogies to Stripe/OpenAI, and production webhooks are rejected.

**Why it happens:** Kling's official docs require authentication to access. The exact header names for the signature and timestamp — and the signing payload construction — are not confirmed in publicly available sources. This is the single highest-risk unknown in Phase 1.

**How to avoid:** 
1. Include `KLING_WEBHOOK_SKIP_VERIFICATION=true` for local dev from day 1.
2. Read the actual Kling developer portal docs (requires Kling account) before implementing verification.
3. Plan Wave 0 to confirm: (a) header name for signature, (b) header name for timestamp, (c) signing payload format (`${timestamp}.${body}` or different), (d) signature encoding (hex vs base64).

**Warning signs:** Webhooks accepted in dev (skip verification) but rejected in production.

### Pitfall 3: 24-Hour Kling CDN URL Expiry

**What goes wrong:** Webhook handler stores `data.task_result.videos[0].url` directly as `video_url` in the database. Videos become inaccessible within 24 hours.

**Why it happens:** OpenAI Sora also required download-and-store (hence `downloadAndStoreVideoFromOpenAI`), but the parallel is easy to miss when adapting the webhook handler.

**How to avoid:** The webhook handler must always call the Supabase Storage upload path on success. Store the Kling CDN URL temporarily only for downloading — never as the final `video_url`.

**Warning signs:** Videos play immediately after generation but show broken links 24+ hours later.

### Pitfall 4: Model Name String Mismatch

**What goes wrong:** The Kling API rejects `kling-v1`, `kling-v1-5`, or `kling-v2` as invalid model names because the actual identifiers use different formatting (e.g., `kling-v1-5` vs `kling-v1.5` vs `kling-v1_5`).

**Why it happens:** Multiple sources use inconsistent separators. `kling-v1-5` (hyphen) is the most commonly cited form but is [ASSUMED] — the official docs may use a different format.

**How to avoid:** Include model name validation in Wave 0 — call the Kling API with each model tier and confirm the exact strings that return 200 vs 400. The CONTEXT.md names (`kling-v1`, `kling-v1-5`, `kling-v2`) are the target; verify they're accepted.

**Warning signs:** 400 Bad Request from the generation endpoint with "invalid model" error.

### Pitfall 5: `callback_url` Not Reaching Webhook in Dev

**What goes wrong:** Kling cannot POST to `localhost`. Dev webhook callbacks never arrive, making it impossible to test the completion flow locally.

**Why it happens:** Kling's servers need a publicly reachable URL to deliver webhook events.

**How to avoid:** Use `KLING_WEBHOOK_SKIP_VERIFICATION=true` and trigger webhook events manually (using a test HTTP client to POST to `localhost:3000/api/webhook/video-complete`) during dev. For integration testing, use a tunnel (ngrok) or test against a staging deployment.

---

## Code Examples

### Kling Task Status Polling Response (for reference)

```typescript
// Source: cross-verified from multiple sources [MEDIUM confidence]
// GET ${KLING_API_URL}/v1/videos/text2video/{task_id}
// Response structure:
{
  code: 0,
  message: "SUCCEED",
  request_id: "CjMkWmdJhuIAAAAAAKXApA",
  data: {
    task_id: "CjMkWmdJhuIAAAAAAKKcRg",
    task_status: "succeed",    // "submitted" | "processing" | "succeed" | "failed"
    task_status_msg: "",
    task_result: {
      videos: [{
        id: "2e0bd237-31ac-464d-98b3-ab0535ea8fee",
        url: "https://cdn.klingai.com/bs2/u/..."   // 24-hour expiry
      }]
    }
  }
}
```

### Updated `lib/products.ts` Model Constants

```typescript
// Source: locked decision from CONTEXT.md [VERIFIED: read from codebase + CONTEXT.md]
export const CREDIT_COSTS = {
  "kling-v1": 1,      // was "sora-2"
  "kling-v1-5": 3,    // was "sora-2-pro"
  "kling-v2": 3,      // was "sora-2-pro-HD"
} as const;
```

### New i18n Error Keys

```json
// messages/es.json — add under top-level "errors" key (create if absent)
{
  "errors": {
    "kling": {
      "rateLimit": "Has alcanzado el límite de solicitudes. Por favor, intenta nuevamente en unos minutos.",
      "contentPolicy": "Tu solicitud fue rechazada por la política de contenido. Por favor, modifica el prompt e intenta nuevamente.",
      "modelUnavailable": "El modelo de generación de video no está disponible temporalmente. Por favor, intenta nuevamente en unos minutos.",
      "generationFailed": "La generación de video falló. Por favor, intenta nuevamente.",
      "unknownError": "Ocurrió un error al generar el video. Por favor, intenta nuevamente."
    }
  }
}
```

```json
// messages/en.json — matching keys
{
  "errors": {
    "kling": {
      "rateLimit": "You have reached the request limit. Please try again in a few minutes.",
      "contentPolicy": "Your request was rejected by the content policy. Please modify your prompt and try again.",
      "modelUnavailable": "The video generation model is temporarily unavailable. Please try again in a few minutes.",
      "generationFailed": "Video generation failed. Please try again.",
      "unknownError": "An error occurred while generating the video. Please try again."
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAI Sora (static API key) | Kling AI (JWT auth with AccessKey + SecretKey) | Phase 1 | Auth layer needs JWT generator; two new env vars |
| Sora: sync or async completion | Kling: always async (task_id + webhook) | Phase 1 | Remove sync-completion branch in generate route |
| Sora polling fallback | Webhook-only (polling removed) | Phase 1 | Simpler generate route; webhook must be reliable |
| OpenAI webhook signature | Kling webhook signature (scheme TBD) | Phase 1 | Rewrite verification logic once scheme confirmed |

**Deprecated/outdated (to remove):**
- `pollVideoStatus` function in `app/api/generate/route.ts` — removed per locked decision
- `downloadAndStoreVideoFromOpenAI` function — replace with `downloadAndStoreVideoFromKling`
- `OPENAI_API_KEY`, `OPENAI_API_URL`, `OPENAI_WEBHOOK_SECRET`, `OPENAI_WEBHOOK_SKIP_VERIFICATION` env vars — replace with Kling equivalents

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Kling model identifiers are `kling-v1`, `kling-v1-5`, `kling-v2` (hyphen-separated, no dots) | Standard Stack, Code Examples | Generation requests return 400 "invalid model"; fix is a string constant change |
| A2 | Kling webhook signature scheme uses HMAC-SHA256 with a timestamp header and signing payload constructed as `${timestamp}.${rawBody}` (analogous to OpenAI's scheme) | Architecture Patterns, Common Pitfalls | Wrong header names or signing format → all production webhooks rejected with 401 |
| A3 | Kling webhook POST body contains `data.task_id` and `data.task_status` with values `"succeed"` and `"failed"` | Architecture Patterns, Code Examples | Webhook handler fails to extract job ID or misidentifies status → video never updates |
| A4 | Kling text-to-video endpoint is `POST /v1/videos/text2video` and image-to-video is `POST /v1/videos/image2video` on base `api.klingai.com` | Architecture Patterns | Generation requests 404; fix is updating the endpoint path constant |
| A5 | The `callback_url` field in the generation request body is accepted by Kling API to configure the webhook delivery target | Architecture Patterns | Webhook never fires; would require polling fallback to be re-added |
| A6 | The `mode` field is optional and `"std"` is a valid value for all three model tiers | Code Examples | Generation requests fail with 400 for mode mismatch; remove `mode` field if not needed |

---

## Open Questions

1. **Kling webhook signature scheme (CRITICAL — blocks production webhook handler)**
   - What we know: Kling's webhook requires signature verification; scheme is HMAC-based
   - What's unclear: Exact header names (is it `X-Kling-Signature`? `Kling-Signature`?), timestamp header name, signing payload format (`timestamp.body` or just `body`), signature encoding (hex vs base64)
   - Recommendation: Wave 0 must include reading the actual Kling developer portal documentation (requires Kling account). Use `KLING_WEBHOOK_SKIP_VERIFICATION=true` until confirmed.

2. **Exact model name strings accepted by Kling API**
   - What we know: Multiple sources cite `kling-v1`, `kling-v1-5`, `kling-v2` but also `kling-v1.6`, `kling-v2-master` etc.
   - What's unclear: Which strings are valid for the current Kling production API at `api.klingai.com`
   - Recommendation: The generate route should validate the model against a known list. Include an API test call in Wave 0.

3. **Image-to-video request format (field name for image)**
   - What we know: Kling accepts reference images for i2v; field is URL-based
   - What's unclear: Field name is `image`, `image_url`, or `image_file`; whether base64 is accepted or URL only
   - Recommendation: Consult Kling docs. The current Sora integration sends multipart form-data with `input_reference` — Kling's format may differ significantly.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `crypto` module | JWT generation, HMAC verification | ✓ | built-in | — |
| `jsonwebtoken` npm package | JWT generation (if using npm path) | ✗ (not in package.json) | — | Manual crypto implementation (preferred) |
| Kling API account + credentials | Generation endpoint auth | ✗ (not yet configured) | — | Dev can use `KLING_WEBHOOK_SKIP_VERIFICATION=true` for webhook testing |
| Public webhook URL | Kling callback delivery in dev | ✗ (localhost) | — | Manual webhook POST for dev testing; ngrok for integration tests |

**Missing dependencies with no fallback:**
- Kling API credentials (`KLING_ACCESS_KEY`, `KLING_SECRET_KEY`) — required for any generation request in dev or prod

**Missing dependencies with fallback:**
- `jsonwebtoken` npm package — can use manual crypto implementation instead (zero new dependencies)
- Public webhook URL in dev — use `KLING_WEBHOOK_SKIP_VERIFICATION=true` and POST test payloads manually

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to `false` in config.json — validation architecture included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, pytest.ini, or test/ directory found |
| Config file | None — Wave 0 must decide: add testing framework or use manual verification only |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

**Project context:** This is a Next.js 14 App Router project with no existing test infrastructure. The `package.json` devDependencies contain no testing libraries. The project uses manual verification (API calls, browser testing) as its primary quality gate.

**Recommendation for Phase 1:** Given no existing test framework, validation for this phase should use manual integration tests documented in a checklist (the project already has `TESTING_CHECKLIST.md`). The 7 success criteria from the ROADMAP.md Phase 1 section become the manual checklist items. Introducing a full test framework in Phase 1 is out of scope.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-03 | Webhook with invalid signature rejected with 401 | manual integration | N/A — no test framework | ❌ Wave 0: document in TESTING_CHECKLIST.md |
| STAT-03 | Webhook with valid signature accepted (200) | manual integration | N/A | ❌ |
| STAT-04 | Replaying same webhook event returns 200 without double-update | manual integration | N/A | ❌ |
| STAT-05 | Webhook with timestamp > 5 min old rejected with 401 | manual integration | N/A | ❌ |
| ERR-01 | Rate limit error from Kling → user sees Spanish/English message | manual | N/A | ❌ |
| ERR-03 | Server error logs include video ID, event type, error message | manual (log inspection) | N/A | ❌ |

### Wave 0 Gaps

- [ ] Read Kling developer portal docs to confirm: webhook signature headers, model name strings, i2v request format
- [ ] Add Kling env vars to `.env.dev`: `KLING_ACCESS_KEY`, `KLING_SECRET_KEY`, `KLING_WEBHOOK_SECRET`, `KLING_API_URL`, `KLING_WEBHOOK_SKIP_VERIFICATION`
- [ ] Update `TESTING_CHECKLIST.md` with Phase 1 manual verification steps matching the 7 success criteria

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT with HS256; short TTL (30 min); server-side only |
| V3 Session Management | no | No session involved in webhook or generation API |
| V4 Access Control | yes | Existing Supabase auth check in generate route; webhook doesn't need user auth |
| V5 Input Validation | yes | Validate `model` against known list; validate `prompt` length |
| V6 Cryptography | yes | HMAC-SHA256 for webhook signature; never hand-roll — use Node built-in `crypto` |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook replay attack | Spoofing/Tampering | Timestamp check (> 5 min → 401); HMAC signature verification |
| Forged webhook delivery | Spoofing | HMAC-SHA256 signature verification with `timingSafeEqual` |
| JWT secret exposure | Information Disclosure | `KLING_SECRET_KEY` server-side only; never in client bundle; `server-only` guard if extracted to `lib/` |
| Double credit consumption | Tampering | Idempotency check: skip if `video_history.status` already terminal |
| Prompt injection via prefix | Tampering | Existing prefix system is operator-controlled; no new attack surface |

---

## Sources

### Primary (HIGH confidence)
- `app/api/webhook/video-complete/route.ts` — Current OpenAI webhook implementation; verified by direct file read
- `app/api/generate/route.ts` — Current Sora generation implementation; verified by direct file read
- `app/api/webhook/stripe/route.ts` — Idempotency pattern reference; verified by direct file read
- `lib/video-storage.ts`, `lib/products.ts` — Current abstractions; verified by direct file read
- `github.com/199-mcp/mcp-kling/blob/main/generate-jwt.mjs` — JWT generation code; verified field names (iss, exp, nbf), algorithm (HS256), manual base64url implementation
- `.planning/phases/01-migrate-sora-to-kling-ai/01-CONTEXT.md` — All locked decisions; verified by direct file read

### Secondary (MEDIUM confidence)
- Cross-verified from `pythonbid.com Kling tutorial` + `agentsapis.com Kling API guide` + `mcp-kling docs`: JWT payload uses `iss=AccessKey`, `exp=now+1800`, `nbf=now-5`, algorithm HS256; base URL is `https://api.klingai.com`
- Cross-verified from `mcp-kling/kling-api-docs.md` + community search results: task status values are `submitted`, `processing`, `succeed`, `failed`; completion response structure is `data.task_result.videos[{id, url}]`; CDN URLs expire in 24 hours
- Cross-verified from multiple sources: task ID field name is `data.task_id` in generation response; `data.data.task_id` form also seen in some wrappers

### Tertiary (LOW confidence — flag for validation)
- Kling model identifiers `kling-v1`, `kling-v1-5`, `kling-v2` — seen in multiple community wrappers but not confirmed against official Kling API response
- Webhook signature scheme (header names, signing format) — entirely ASSUMED; no public source confirms Kling native webhook signature format
- `callback_url` field name in generation request body — seen in multiple wrappers but not confirmed against `api.klingai.com` specifically
- `mode: "std"` parameter — seen in third-party wrappers; may not be valid for all model tiers

---

## Metadata

**Confidence breakdown:**
- JWT auth mechanism: HIGH — code verified from mcp-kling implementation
- API base URL (`api.klingai.com`): HIGH — consistently cited, cross-verified
- Task status values: HIGH — consistently cited across multiple independent implementations
- Endpoint paths (`/v1/videos/text2video`): MEDIUM — commonly cited but not verified from official docs
- Model name strings: MEDIUM — consistent but cannot be confirmed without Kling account
- Webhook signature scheme: LOW — critical unknown; no public source documents Kling native webhook signature format
- Webhook payload structure: MEDIUM — task_id/task_status cross-verified; video URL structure verified

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days; Kling API evolving rapidly — re-verify model names if more than 2 weeks pass before implementation)
