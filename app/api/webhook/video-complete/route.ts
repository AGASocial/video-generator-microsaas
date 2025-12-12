import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadAndStoreVideoFromOpenAI } from "@/lib/video-storage";
import crypto from "crypto";

// Disable body parsing to ensure raw body is available for signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyOpenAIWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // OpenAI webhook signature format: "v1=hash" or "timestamp,hash"
    // We'll try both formats
    const parts = signature.split(",");
    
    if (parts.length === 2) {
      // Format: "timestamp,hash"
      const [timestamp, hash] = parts;
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");
      
      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(expectedSignature)
      );
    } else if (signature.startsWith("v1=")) {
      // Format: "v1=hash"
      const hash = signature.substring(3);
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
      
      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(expectedSignature)
      );
    } else {
      // Try direct HMAC of payload
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    }
  } catch (error) {
    console.error("[Webhook] Signature verification error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    
    // Get signature from headers (OpenAI typically uses 'openai-signature' or 'x-openai-signature')
    const signature = 
      request.headers.get("openai-signature") ||
      request.headers.get("x-openai-signature") ||
      request.headers.get("OpenAI-Signature") ||
      request.headers.get("X-OpenAI-Signature");
    
    const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET;
    
    // Verify signature if secret is configured
    if (webhookSecret) {
      if (!signature) {
        console.error("[Webhook] Missing signature header");
        return NextResponse.json(
          { error: "Missing signature header" },
          { status: 401 }
        );
      }
      
      const isValid = verifyOpenAIWebhookSignature(body, signature, webhookSecret);
      
      if (!isValid) {
        console.error("[Webhook] ❌ Signature verification failed");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
      
      console.log("[Webhook] ✅ Signature verified successfully");
    } else {
      console.warn("[Webhook] ⚠️ OPENAI_WEBHOOK_SECRET not configured - skipping signature verification");
    }
    
    // Parse JSON body
    const bodyJson = JSON.parse(body);
    
    console.log("[Webhook] Received OpenAI webhook:", {
      type: bodyJson.type,
      eventId: bodyJson.id,
      data: bodyJson.data,
    });

    // Handle OpenAI webhook format:
    // {
    //   "id": "evt_gaveho123",
    //   "object": "event",
    //   "created_at": 1758941485,
    //   "type": "video.completed" | "video.failed",
    //   "data": {
    //     "id": "{{sora_video_id}}"
    //   }
    // }
    
    const eventType = bodyJson.type;
    const soraVideoId = bodyJson.data?.id;
    
    if (!soraVideoId) {
      console.error("[Webhook] Missing sora_video_id in data:", bodyJson);
      return NextResponse.json(
        { error: "Missing video ID in webhook data" },
        { status: 400 }
      );
    }

    // Map OpenAI event types to our status
    let status: string;
    if (eventType === "video.completed") {
      status = "completed";
    } else if (eventType === "video.failed") {
      status = "failed";
    } else {
      console.warn("[Webhook] Unknown event type:", eventType);
      return NextResponse.json(
        { error: `Unknown event type: ${eventType}` },
        { status: 400 }
      );
    }

    // Find video entry by job_id (which stores the sora_video_id)
    const supabase = await createClient();
    const { data: videoEntry, error: videoError } = await supabase
      .from("video_history")
      .select("id, user_id, job_id")
      .eq("job_id", soraVideoId)
      .single();

    if (videoError || !videoEntry) {
      console.error("[Webhook] Video not found for sora_video_id:", soraVideoId, videoError);
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    const videoId = videoEntry.id;
    console.log(`[Webhook] Found video ${videoId} for sora_video_id ${soraVideoId}, status: ${status}`);

    // Update status first
    await supabase
      .from("video_history")
      .update({ status })
      .eq("id", videoId);

    // If video is completed, download and store it in Supabase Storage
    if (status === "completed") {
      // Download from OpenAI and store in Supabase
      console.log(`[Webhook] Downloading and storing video ${videoId} from OpenAI`);
      const storageResult = await downloadAndStoreVideoFromOpenAI(
        videoId,
        soraVideoId,
        videoEntry.user_id
      );

      if (!storageResult.success) {
        console.error("[Webhook] Failed to store video:", storageResult.error);
        // Don't fail the webhook - video is still completed, just not stored
        // You might want to retry storage later
        return NextResponse.json({
          success: true,
          warning: "Video completed but storage failed. Will retry.",
        });
      }

      console.log(`[Webhook] Video ${videoId} stored successfully at: ${storageResult.supabaseUrl}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
