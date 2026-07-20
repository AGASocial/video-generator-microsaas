# Phase 1: Provider Migration - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/kling-auth.ts` | utility | request-response | `app/api/webhook/video-complete/route.ts` (crypto import + HMAC pattern) | partial (same crypto module, different operation) |
| `app/api/generate/route.ts` | controller | request-response | `app/api/generate/route.ts` (self — rewrite) | exact |
| `app/api/webhook/video-complete/route.ts` | controller | event-driven | `app/api/webhook/video-complete/route.ts` (self — rewrite) | exact |
| `lib/video-storage.ts` | utility | file-I/O | `lib/video-storage.ts` (self — adapt) | exact |
| `lib/products.ts` | config | — | `lib/products.ts` (self — update strings) | exact |
| `messages/es.json` | config | — | `messages/es.json` (self — extend) | exact |
| `messages/en.json` | config | — | `messages/en.json` (self — extend) | exact |

---

## Pattern Assignments

### `lib/kling-auth.ts` (utility, request-response)

**Analog:** `app/api/webhook/video-complete/route.ts` — crypto import and HMAC construction; also `app/api/webhook/video-complete/route.ts` lines 59-63 for `createHmac` call pattern.

**This is a NEW file with no direct codebase analog.** Use the verified external pattern from RESEARCH.md combined with the project's existing `crypto` usage.

**Imports pattern** — follow the existing webhook handler's crypto import (line 4):
```typescript
import crypto from "crypto";
```

**Core JWT generation pattern** (from RESEARCH.md — verified against github.com/199-mcp/mcp-kling):
```typescript
// lib/kling-auth.ts
// server-only: never import this from client components
import crypto from "crypto";

function base64url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function generateKlingToken(): string {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.error("[Kling] KLING_ACCESS_KEY or KLING_SECRET_KEY is not configured");
    throw new Error("Kling credentials not configured");
  }

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: accessKey,
      exp: now + 1800, // 30-minute expiry
      nbf: now - 5,    // valid 5s ago (clock skew tolerance)
    })
  );

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

**HMAC construction analog** — from `app/api/webhook/video-complete/route.ts` lines 59-63:
```typescript
const expectedSignature = crypto
  .createHmac("sha256", secret)
  .update(signedPayload)
  .digest("hex");
```
Note: JWT signing uses `.digest("base64")` with base64url replacement (not hex). The webhook verification analog uses hex — do NOT mix these.

**Missing env var guard pattern** — from `app/api/generate/route.ts` lines 248-253:
```typescript
if (!process.env.OPENAI_API_KEY) {
  console.error("[v0] OPENAI_API_KEY is not set");
  return NextResponse.json(
    { error: "OpenAI API key is not configured" },
    { status: 500 }
  );
}
```
Apply same pattern for `KLING_ACCESS_KEY` / `KLING_SECRET_KEY` — but since `generateKlingToken()` is a utility (not a route handler), throw an Error instead of returning a NextResponse; the calling route handler catches it.

---

### `app/api/generate/route.ts` (controller, request-response)

**Analog:** `app/api/generate/route.ts` (current file — rewrite in place)

**Imports pattern** (lines 1-4 of current file):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreditCost } from "@/lib/products";
import { downloadAndStoreVideoFromOpenAI } from "@/lib/video-storage";
```
Replace the last import with:
```typescript
import { downloadAndStoreVideoFromKling } from "@/lib/video-storage";
import { generateKlingToken } from "@/lib/kling-auth";
```

**Auth + credit check pattern** — keep unchanged (lines 103-185 of current file):
```typescript
const supabase = await createClient();
const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
if (authError || !authUser) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// ... user fetch, credit check at lines 120-185
```

**Form data parse pattern** — keep unchanged (lines 135-141 of current file):
```typescript
const formData = await request.formData();
const userPrompt = formData.get("prompt") as string;
const duration = parseInt(formData.get("duration") as string);
const model = formData.get("model") as string;
const size = formData.get("size") as string;
const imageFile = formData.get("image") as File | null;
```

**Prefix prompt pattern** — keep unchanged (lines 151-169 of current file):
```typescript
try {
  const { data: promptSetting, error: promptError } = await supabase
    .from("video_prompt_settings")
    .select("prefix_prompt")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!promptError && promptSetting?.prefix_prompt) {
    finalPrompt = `${promptSetting.prefix_prompt}. ${userPrompt}`;
    console.log("[Generate] Applied prefix prompt to user input");
  }
} catch (error) {
  console.error("[Generate] Error fetching prefix prompt:", error);
}
```

**Kling API call pattern** (replace the OpenAI fetch block starting at line 256 — always async, always JSON, task_id replaces soraVideoId):
```typescript
const klingApiUrl = process.env.KLING_API_URL || "https://api.klingai.com";
const token = generateKlingToken();

// Text-to-video (no image)
const klingResponse = await fetch(`${klingApiUrl}/v1/videos/text2video`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model_name: model,    // "kling-v1" | "kling-v1-5" | "kling-v2"
    prompt: finalPrompt,
    duration: duration,
    aspect_ratio: aspectRatio,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/video-complete`,
  }),
});
```

**task_id storage pattern** (replaces soraVideoId storage at lines 342-348 of current file):
```typescript
// Store Kling task_id in job_id column
await supabase
  .from("video_history")
  .update({
    job_id: taskId,   // was: soraVideoId
    status: "processing", // always "processing" — Kling never completes synchronously
  })
  .eq("id", videoEntry.id);
// Always return processing — remove the openaiData.status === "completed" branch
return NextResponse.json({
  success: true,
  videoId: videoEntry.id,
  message: "Video generation started",
  status: "processing",
  videoUrl: null,
});
```

**Error handling + credit refund pattern** — keep unchanged (lines 397-419 of current file):
```typescript
} catch (openaiError) {
  console.error("[v0] OpenAI API error:", openaiError);
  const errorMessage = openaiError instanceof Error
    ? openaiError.message
    : "Failed to generate video";
  await supabase.from("video_history").update({ status: "failed" }).eq("id", videoEntry.id);
  await supabase.from("users").update({ credits: user.credits }).eq("id", authUser.id);
  return NextResponse.json({ error: errorMessage }, { status: 500 });
}
```
Change the log prefix from `[v0]` to `[Kling]`.

**Remove entirely:**
- `pollVideoStatus` function (lines 7-101 of current file) — locked decision
- `if (openaiData.status === "completed")` branch (lines 350-384 of current file) — Kling is always async
- The `downloadAndStoreVideoFromOpenAI` import and call from within the generate route (downloading now happens only in the webhook handler)

---

### `app/api/webhook/video-complete/route.ts` (controller, event-driven)

**Analog:** `app/api/webhook/video-complete/route.ts` (current file — full rewrite in place)

**Route config** — keep unchanged (lines 7-8 of current file):
```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

**Imports pattern** (adapt from current file lines 1-4):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadAndStoreVideoFromKling } from "@/lib/video-storage";
import crypto from "crypto";
```

**Signature verification function** — structural copy of `verifyOpenAIWebhookSignature` (lines 10-116 of current file); rename to `verifyKlingWebhookSignature` and change header-name references. Core logic to preserve:
```typescript
function verifyKlingWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  try {
    if (!timestamp) {
      console.error("[KlingWebhook] Missing timestamp for signature verification");
      return false;
    }

    // Replay protection: reject events older than 5 minutes
    const timestampNum = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTime - timestampNum);
    if (timeDifference > 5 * 60) {
      console.error(`[KlingWebhook] Timestamp too old. Difference: ${timeDifference}s`);
      return false;
    }

    // Construct signed payload — ASSUMED: same format as OpenAI (timestamp.body)
    // CRITICAL: confirm exact format from Kling developer portal docs in Wave 0
    const signedPayload = `${timestamp}.${payload}`;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      console.error("[KlingWebhook] Signature length mismatch");
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error("[KlingWebhook] Signature verification error:", error);
    return false;
  }
}
```

**Header extraction pattern** — adapt from current file lines 135-145 (replace OpenAI header names with Kling equivalents — exact names to be confirmed in Wave 0):
```typescript
// ASSUMED header names — confirm from Kling developer portal docs in Wave 0
const signature =
  request.headers.get("x-kling-signature") ||
  request.headers.get("X-Kling-Signature");

const timestamp =
  request.headers.get("x-kling-timestamp") ||
  request.headers.get("X-Kling-Timestamp");
```

**Skip verification env var pattern** — copy from current file lines 155-156, rename:
```typescript
const webhookSecret = process.env.KLING_WEBHOOK_SECRET;
const skipVerification = process.env.KLING_WEBHOOK_SKIP_VERIFICATION === "true";
```

**Signature check + skip pattern** — copy structure from current file lines 163-226, rename log prefix and env var names:
```typescript
if (webhookSecret && !skipVerification) {
  if (!signature || !timestamp) {
    console.error("[KlingWebhook] Missing signature or timestamp header");
    return NextResponse.json({ error: "Missing signature header" }, { status: 401 });
  }
  const isValid = verifyKlingWebhookSignature(body, signature, timestamp, webhookSecret);
  if (!isValid) {
    console.error("[KlingWebhook] Signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
} else if (skipVerification) {
  console.warn("[KlingWebhook] SKIPPING signature verification (KLING_WEBHOOK_SKIP_VERIFICATION=true)");
}
```

**Kling payload parse pattern** (replaces OpenAI event type extraction at lines 248-272 of current file):
```typescript
// Kling webhook payload structure (MEDIUM confidence — cross-verified)
// { code, message, request_id, data: { task_id, task_status, task_result? } }
const bodyJson = JSON.parse(body);
const taskId = bodyJson.data?.task_id;
const taskStatus = bodyJson.data?.task_status; // "submitted"|"processing"|"succeed"|"failed"

if (!taskId) {
  console.error("[KlingWebhook] Missing task_id in webhook data:", bodyJson);
  return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
}

// Only process terminal states
if (taskStatus !== "succeed" && taskStatus !== "failed") {
  console.log("[KlingWebhook] Ignoring non-terminal status:", taskStatus);
  return NextResponse.json({ received: true });
}
```

**Idempotency check pattern** — adapt from Stripe webhook handler lines 147-166 (`app/api/webhook/stripe/route.ts`), targeting `video_history` instead of `transactions`:
```typescript
// Lookup video by Kling task_id
const supabase = await createClient();
const { data: videoEntry, error: videoError } = await supabase
  .from("video_history")
  .select("id, user_id, status, job_id")
  .eq("job_id", taskId)
  .single();

if (!videoEntry) {
  console.error("[KlingWebhook] Video not found for task_id:", taskId);
  return NextResponse.json({ error: "Video not found" }, { status: 404 });
}

// Idempotency: skip if already in a terminal state (same pattern as Stripe session check)
if (videoEntry.status === "completed" || videoEntry.status === "failed") {
  console.log("[KlingWebhook] Event already processed for task_id:", taskId);
  return NextResponse.json({ received: true });
}
```

**Completion path** — copy structure from current webhook handler lines 299-318, replacing `downloadAndStoreVideoFromOpenAI` call:
```typescript
if (taskStatus === "succeed") {
  const klingVideoUrl = bodyJson.data?.task_result?.videos?.[0]?.url;
  if (!klingVideoUrl) {
    console.error("[KlingWebhook] No video URL in succeed event for task_id:", taskId);
    return NextResponse.json({ error: "No video URL in result" }, { status: 400 });
  }
  console.log(`[KlingWebhook] Downloading and storing video ${videoEntry.id} from Kling`);
  const storageResult = await downloadAndStoreVideoFromKling(
    videoEntry.id,
    klingVideoUrl,
    videoEntry.user_id
  );
  if (!storageResult.success) {
    console.error("[KlingWebhook] Failed to store video:", storageResult.error);
    return NextResponse.json({ success: true, warning: "Video completed but storage failed." });
  }
  console.log(`[KlingWebhook] Video ${videoEntry.id} stored at: ${storageResult.supabaseUrl}`);
} else {
  // task_status === "failed"
  await supabase
    .from("video_history")
    .update({ status: "failed" })
    .eq("id", videoEntry.id);
  console.log(`[KlingWebhook] Video ${videoEntry.id} marked failed for task_id:`, taskId);
}

return NextResponse.json({ success: true });
```

**Outer error handler** — keep unchanged from current file lines 322-328:
```typescript
} catch (error) {
  console.error("[KlingWebhook] Error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

---

### `lib/video-storage.ts` (utility, file-I/O)

**Analog:** `lib/video-storage.ts` (current file — adapt in place)

**Keep entirely unchanged:**
- `DownloadAndStoreResult` interface (lines 8-12)
- `downloadAndStoreVideo()` function (lines 21-98) — the generic downloader; only change is removing the OpenAI-specific auth header injection (lines 33-37) which becomes irrelevant or can stay as a no-op for non-OpenAI URLs
- Supabase upload block (lines 53-65)
- Public URL + DB update block (lines 67-85)
- Error handling pattern (lines 91-96)

**The OpenAI-specific conditional auth header** (lines 33-37 of current file):
```typescript
headers: {
  ...(externalUrl.includes('api.openai.com') && process.env.OPENAI_API_KEY
    ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    : {}),
},
```
Kling CDN URLs (cdn.klingai.com) are publicly accessible without auth — no header needed. This conditional becomes irrelevant; it can stay or be removed. Do NOT add Kling JWT auth to the download request (CDN is public).

**New function to add** (copy from `downloadAndStoreVideoFromOpenAI` at lines 106-115 of current file, rename):
```typescript
/**
 * Downloads video from Kling CDN and stores in Supabase Storage.
 * IMPORTANT: Kling CDN URLs expire after 24 hours — call immediately on webhook receipt.
 * @param videoId - The UUID of the video entry in the database
 * @param klingVideoUrl - The Kling CDN URL from task_result.videos[0].url
 * @param userId - The UUID of the user who owns the video
 */
export async function downloadAndStoreVideoFromKling(
  videoId: string,
  klingVideoUrl: string,
  userId: string
): Promise<DownloadAndStoreResult> {
  // Kling CDN URLs are publicly accessible — no auth header needed
  return downloadAndStoreVideo(videoId, klingVideoUrl, userId);
}
```

Keep `downloadAndStoreVideoFromOpenAI` (lines 106-115) — do not remove it until Sora removal is confirmed safe. The generic `downloadAndStoreVideo` handles both.

---

### `lib/products.ts` (config, —)

**Analog:** `lib/products.ts` (current file — update string constants only)

**Keep unchanged:** `CreditPackage` interface (lines 1-7), `CREDIT_PACKAGES` array (lines 9-38), `getCreditCost()` function (lines 47-49). Structure, types, and credit amounts stay the same per D-02.

**Update only `CREDIT_COSTS`** (lines 41-45 of current file):
```typescript
// BEFORE (lines 41-45):
export const CREDIT_COSTS = {
  "sora-2": 1,
  "sora-2-pro": 3,
  "sora-2-pro-HD": 3,
} as const;

// AFTER:
export const CREDIT_COSTS = {
  "kling-v1": 1,      // was "sora-2"   — Standard tier
  "kling-v1-5": 3,    // was "sora-2-pro" — Pro tier
  "kling-v2": 3,      // was "sora-2-pro-HD" — Pro HD tier
} as const;
```

Note: `getCreditCost()` uses `CREDIT_COSTS[model as keyof typeof CREDIT_COSTS] || 1` — the fallback `|| 1` means old Sora keys passed at runtime return 1, not an error. After update, only Kling keys are recognized; passing a Sora key silently returns 1. This is acceptable during transition.

---

### `messages/es.json` (config, —)

**Analog:** `messages/es.json` (current file — extend at top level)

**Current top-level keys:** `common`, `navigation`, `home`, `form`, `generate`, `credits`, `creditPackages`, `auth`, `profile`, `videoList`

**There is no existing `errors` top-level key.** Add one. Insert after `"videoList"`:

```json
"errors": {
  "kling": {
    "rateLimit": "Has alcanzado el límite de solicitudes. Por favor, intenta nuevamente en unos minutos.",
    "contentPolicy": "Tu solicitud fue rechazada por la política de contenido. Por favor, modifica el prompt e intenta nuevamente.",
    "modelUnavailable": "El modelo de generación de video no está disponible temporalmente. Por favor, intenta nuevamente en unos minutos.",
    "generationFailed": "La generación de video falló. Por favor, intenta nuevamente.",
    "unknownError": "Ocurrió un error al generar el video. Por favor, intenta nuevamente."
  }
}
```

The JSON object must remain valid — add a comma after the closing `}` of `"videoList"` before adding the new key.

---

### `messages/en.json` (config, —)

**Analog:** `messages/en.json` (current file — extend at top level)

Same structure as `es.json`. Insert after `"videoList"` (line 250 of current file):

```json
"errors": {
  "kling": {
    "rateLimit": "You have reached the request limit. Please try again in a few minutes.",
    "contentPolicy": "Your request was rejected by the content policy. Please modify your prompt and try again.",
    "modelUnavailable": "The video generation model is temporarily unavailable. Please try again in a few minutes.",
    "generationFailed": "Video generation failed. Please try again.",
    "unknownError": "An error occurred while generating the video. Please try again."
  }
}
```

---

## Shared Patterns

### Raw body parsing for webhook HMAC integrity
**Source:** `app/api/webhook/video-complete/route.ts` line 121; `app/api/webhook/stripe/route.ts` line 17
**Apply to:** `app/api/webhook/video-complete/route.ts` (rewrite)
```typescript
// Must be the first read of the request body — before JSON.parse
const body = await request.text();
```
Do NOT use `request.json()` — it consumes the body and prevents HMAC verification over the raw bytes.

### `runtime = "nodejs"` declaration
**Source:** `app/api/webhook/video-complete/route.ts` line 7; `app/api/webhook/stripe/route.ts` line 4
**Apply to:** `app/api/webhook/video-complete/route.ts` (rewrite) — keep unchanged
```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```
Required for Node.js `crypto` module access in Next.js App Router.

### HMAC timing-safe comparison
**Source:** `app/api/webhook/video-complete/route.ts` lines 69-85
**Apply to:** `verifyKlingWebhookSignature()` in the rewritten webhook handler
```typescript
const signatureBuffer = Buffer.from(signature, "hex");
const expectedBuffer = Buffer.from(expectedSignature, "hex");
if (signatureBuffer.length !== expectedBuffer.length) {
  return false;
}
return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
```
Never use `===` for signature comparison — timing attacks.

### Supabase service client (webhook routes bypass RLS)
**Source:** `app/api/webhook/stripe/route.ts` lines 137-146
**Apply to:** `app/api/webhook/video-complete/route.ts` (rewrite) — the existing video-complete handler uses `createClient()` (user client), but since webhooks have no user session, consider the service client pattern if RLS blocks the `video_history` update:
```typescript
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```
The current OpenAI webhook handler uses `createClient()` and this appears to work (existing RLS policy allows webhook updates). Preserve `createClient()` unless RLS errors surface — don't change what works.

### Idempotency: select-before-update
**Source:** `app/api/webhook/stripe/route.ts` lines 147-166
**Apply to:** `app/api/webhook/video-complete/route.ts` (rewrite)
```typescript
// Stripe pattern (transactions table):
const { data: existingTransaction } = await supabase
  .from("video_transactions")
  .select("id")
  .eq("stripe_session_id", session.id)
  .single();
if (existingTransaction) {
  return NextResponse.json({ received: true, message: "Transaction already processed" }, { status: 200 });
}

// Kling adaptation (video_history table):
const { data: videoEntry } = await supabase
  .from("video_history")
  .select("id, user_id, status, job_id")
  .eq("job_id", taskId)
  .single();
if (videoEntry.status === "completed" || videoEntry.status === "failed") {
  return NextResponse.json({ received: true });
}
```

### Logging prefix convention
**Source:** `app/api/generate/route.ts` (uses `[v0]`, `[Generate]`, `[API]`, `[Polling]`); `app/api/webhook/video-complete/route.ts` (uses `[Webhook]`)
**Apply to:** All modified/new files
- `lib/kling-auth.ts` → `[Kling]`
- `app/api/generate/route.ts` → `[Kling]` (replace `[v0]`) and `[Generate]` (keep)
- `app/api/webhook/video-complete/route.ts` → `[KlingWebhook]` (replace `[Webhook]`)
- `lib/video-storage.ts` → `[Video Storage]` (keep existing prefix)

### Error response shape
**Source:** `app/api/generate/route.ts` lines 113-116, 128-131, 416-419
**Apply to:** All route handlers
```typescript
return NextResponse.json({ error: "Human-readable message" }, { status: 4xx_or_5xx });
```
Error key is always `"error"` (string). For 402 credit errors, also include `required` and `available` fields (lines 179-183 of generate route).

---

## No Analog Found

All files have codebase analogs. The only case without a direct in-project analog is `lib/kling-auth.ts` (JWT generation), but it has a partial analog in the existing `crypto` usage within the webhook handler, combined with the external verified pattern from RESEARCH.md.

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `lib/kling-auth.ts` | utility | request-response | No existing JWT generation in project; uses same Node `crypto` module as webhook handler — partial analog only |

---

## Metadata

**Analog search scope:** `app/api/`, `lib/`, `messages/`
**Files scanned:** 7 (all required reading files)
**Pattern extraction date:** 2026-04-21

**Critical Wave 0 unknowns that affect pattern implementation:**
1. Kling webhook signature header names (currently assumed: `X-Kling-Signature`, `X-Kling-Timestamp`) — must be confirmed before `verifyKlingWebhookSignature` can be finalized
2. Kling webhook signing payload format (currently assumed: `${timestamp}.${rawBody}` matching OpenAI's scheme) — must be confirmed
3. Exact model name strings accepted by `api.klingai.com` — assumed: `kling-v1`, `kling-v1-5`, `kling-v2`
