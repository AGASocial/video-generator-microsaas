import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { downloadAndStoreVideoFromKling } from "@/lib/video-storage";
import crypto from "crypto";

// Required for Node.js crypto module in Next.js App Router
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies Kling webhook signature (HMAC-SHA256, timing-safe).
 *
 * IMPLEMENTATION NOTE: The signing payload format and header names below
 * are ASSUMED based on OpenAI/Stripe patterns. Check KLING-API-NOTES.md Q1
 * and Q2 and use the confirmed values. If different, update accordingly.
 *
 * Assumed (LOW confidence — KLING-API-NOTES.md Q1 and Q2):
 * - Signature header: X-Kling-Signature (UNCONFIRMED — see KLING-API-NOTES.md Q1)
 * - Timestamp header: X-Kling-Timestamp (UNCONFIRMED — see KLING-API-NOTES.md Q1)
 * - Signing payload: raw body only, no timestamp prefix (UNCONFIRMED — see KLING-API-NOTES.md Q2)
 * - Signature encoding: base64 (UNCONFIRMED — see KLING-API-NOTES.md Q2)
 *
 * Use KLING_WEBHOOK_SKIP_VERIFICATION=true in dev until real Kling callbacks
 * can be inspected to confirm header names and signing format.
 */
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

    // STAT-05: Replay attack prevention — reject events older than 5 minutes
    const timestampNum = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTime - timestampNum);
    const fiveMinutes = 5 * 60;

    if (timeDifference > fiveMinutes) {
      console.error(
        `[KlingWebhook] Timestamp too old. Difference: ${timeDifference}s (max: ${fiveMinutes}s)`
      );
      return false;
    }

    // [UNCONFIRMED — KLING-API-NOTES.md Q2]: raw body only (no timestamp prefix)
    // If Kling uses timestamp.body format instead, change to: `${timestamp}.${payload}`
    const signedPayload = payload;

    // [UNCONFIRMED — KLING-API-NOTES.md Q2]: base64 encoding
    // If Kling uses hex encoding instead, change digest to "hex" and Buffer.from encoding to "hex"
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("base64");

    // STAT-03: Timing-safe comparison (prevents timing attacks)
    const signatureBuffer = Buffer.from(signature, "base64");
    const expectedBuffer = Buffer.from(expectedSignature, "base64");

    if (signatureBuffer.length !== expectedBuffer.length) {
      console.error("[KlingWebhook] Signature length mismatch");
      return false;
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    if (!isValid) {
      console.error("[KlingWebhook] Signature verification failed");
    }
    return isValid;
  } catch (error) {
    console.error("[KlingWebhook] Signature verification error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Raw body read MUST be first — before any JSON.parse — to preserve HMAC integrity
    const body = await request.text();

    // Log all headers in dev so real Kling callback headers can be inspected
    // (needed to confirm Q1: actual header names Kling sends)
    if (process.env.NODE_ENV !== "production") {
      const allHeaders: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        allHeaders[key] = value;
      });
      console.log("[KlingWebhook] Incoming headers:", JSON.stringify(allHeaders, null, 2));
    }

    console.log("[KlingWebhook] Webhook received:", {
      timestamp: new Date().toISOString(),
      bodyLength: body.length,
    });

    // [UNCONFIRMED — KLING-API-NOTES.md Q1]: assumed header names
    // Verify against real Kling callbacks before going to production
    const signature =
      request.headers.get("x-kling-signature") ||
      request.headers.get("X-Kling-Signature");

    const timestamp =
      request.headers.get("x-kling-timestamp") ||
      request.headers.get("X-Kling-Timestamp");

    const webhookSecret = process.env.KLING_WEBHOOK_SECRET;
    const skipVerification = process.env.KLING_WEBHOOK_SKIP_VERIFICATION === "true";

    // STAT-03: Signature verification
    if (webhookSecret && !skipVerification) {
      if (!signature) {
        console.error("[KlingWebhook] Missing signature header");
        return NextResponse.json({ error: "Missing signature header" }, { status: 401 });
      }

      if (!timestamp) {
        console.error("[KlingWebhook] Missing timestamp header");
        return NextResponse.json({ error: "Missing timestamp header" }, { status: 401 });
      }

      const isValid = verifyKlingWebhookSignature(body, signature, timestamp, webhookSecret);
      if (!isValid) {
        console.error("[KlingWebhook] Invalid signature or expired timestamp — rejecting");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }

      console.log("[KlingWebhook] Signature verified");
    } else if (skipVerification) {
      console.warn("[KlingWebhook] SKIPPING signature verification (KLING_WEBHOOK_SKIP_VERIFICATION=true)");
    } else {
      console.warn("[KlingWebhook] KLING_WEBHOOK_SECRET not configured — skipping verification");
    }

    // Parse Kling webhook payload
    const bodyJson = JSON.parse(body);
    const taskId = bodyJson.data?.task_id;
    const taskStatus = bodyJson.data?.task_status;

    console.log("[KlingWebhook] Parsed event:", { taskId, taskStatus });

    if (!taskId) {
      console.error("[KlingWebhook] Missing task_id in webhook payload:", bodyJson);
      return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    }

    // Only process terminal states — ignore intermediate updates
    if (taskStatus !== "succeed" && taskStatus !== "failed") {
      console.log("[KlingWebhook] Ignoring non-terminal status:", taskStatus);
      return NextResponse.json({ received: true });
    }

    // Lookup video_history by Kling task_id (stored in job_id column)
    // Fix: use service role client — no user session exists in webhook context (RESEARCH.md Finding 4)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[KlingWebhook] SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: videoEntry, error: videoError } = await supabase
      .from("video_history")
      .select("id, user_id, status, job_id, credit_cost")
      .eq("job_id", taskId)
      .single();

    if (videoError || !videoEntry) {
      // ERR-03: Log with sufficient context for debugging
      console.error("[KlingWebhook] Video not found:", { taskId, error: videoError?.message });
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const videoId = videoEntry.id;

    // D-01: processed_webhook_events dedup for Kling (closes race window on duplicate delivery)
    const { data: existingKlingEvent, error: existingKlingError } = await supabase
      .from("processed_webhook_events")
      .select("id")
      .eq("provider", "kling")
      .eq("event_id", taskId)
      .eq("event_type", taskStatus)
      .single();

    if (existingKlingError && existingKlingError.code !== "PGRST116") {
      console.error("[ProcessedEvents] Error checking Kling processed events:", existingKlingError);
    }

    if (existingKlingEvent) {
      console.log("[ProcessedEvents] Already processed Kling event:", { taskId, taskStatus });
      return NextResponse.json({ received: true });
    }

    // STAT-04: Idempotency check — skip if already in a terminal state
    // Mirrors the Stripe pattern: select-before-update
    if (videoEntry.status === "completed" || videoEntry.status === "failed") {
      console.log("[KlingWebhook] Event already processed:", { taskId, videoId, currentStatus: videoEntry.status });
      return NextResponse.json({ received: true });
    }

    // Process terminal event
    if (taskStatus === "succeed") {
      const klingVideoUrl = bodyJson.data?.task_result?.videos?.[0]?.url;

      if (!klingVideoUrl) {
        // ERR-03: Log with video ID, event type, error details
        console.error("[KlingWebhook] No video URL in succeed event:", { videoId, taskId, taskStatus });
        // Mark as failed — no URL means we cannot store the video
        await supabase
          .from("video_history")
          .update({ status: "failed" })
          .eq("id", videoId);
        return NextResponse.json({ error: "No video URL in succeed result" }, { status: 400 });
      }

      // Download from Kling CDN and store in Supabase immediately
      // CDN URL expires in 24 hours — must be done now
      console.log("[KlingWebhook] Downloading and storing video:", { videoId, taskId });
      const storageResult = await downloadAndStoreVideoFromKling(
        videoId,
        klingVideoUrl,
        videoEntry.user_id
      );

      if (!storageResult.success) {
        // ERR-03: Log error with full context
        console.error("[KlingWebhook] Storage failed:", {
          videoId,
          taskId,
          error: storageResult.error,
        });
        // Return 200 to prevent Kling from retrying — storage failure is not a Kling problem
        return NextResponse.json({
          success: true,
          warning: "Video completed but storage failed.",
        });
      }

      console.log("[KlingWebhook] Video stored successfully:", {
        videoId,
        taskId,
        supabaseUrl: storageResult.supabaseUrl,
      });
    } else {
      // taskStatus === "failed"
      await supabase
        .from("video_history")
        .update({ status: "failed" })
        .eq("id", videoId);

      // D-03: Refund credits when Kling confirms failure (webhook-only, never on API errors)
      // Uses increment RPC (credits + N) not absolute set — safe for concurrent writes
      if (videoEntry.credit_cost && videoEntry.credit_cost > 0) {
        const { error: refundError } = await supabase.rpc("refund_video_credits", {
          p_user_id: videoEntry.user_id,
          p_amount: videoEntry.credit_cost,
        });
        if (refundError) {
          console.error("[KlingWebhook] Credit refund failed — credits not restored:", {
            videoId,
            userId: videoEntry.user_id,
            creditCost: videoEntry.credit_cost,
            error: refundError.message,
          });
        } else {
          console.log("[KlingWebhook] Credit refund issued:", {
            videoId,
            userId: videoEntry.user_id,
            creditCost: videoEntry.credit_cost,
          });
        }
      } else {
        console.warn("[KlingWebhook] No credit_cost on video entry — skipping refund:", { videoId });
      }

      // ERR-03: Log failure with context
      console.error("[KlingWebhook] Video generation failed:", {
        videoId,
        taskId,
        taskStatus,
        statusMsg: bodyJson.data?.task_status_msg,
      });

      // D-01: Record as processed AFTER all side effects complete (refund must be above this line)
      await supabase.from("processed_webhook_events").insert({
        event_type: taskStatus,
        event_id: taskId,
        provider: "kling",
        user_id: videoEntry.user_id,
      });
      console.log("[ProcessedEvents] Recorded Kling event:", {
        provider: "kling",
        eventId: taskId,
        eventType: taskStatus,
      });
    }

    // D-01: Record succeed event as processed (insert last)
    if (taskStatus === "succeed") {
      await supabase.from("processed_webhook_events").insert({
        event_type: taskStatus,
        event_id: taskId,
        provider: "kling",
        user_id: videoEntry.user_id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // ERR-03: Log with sufficient context
    console.error("[KlingWebhook] Unhandled error:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
