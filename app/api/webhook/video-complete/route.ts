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
  timestamp: string,
  secret: string
): boolean {
  try {
    console.log("[Webhook] ========== SIGNATURE VERIFICATION ==========");
    console.log("[Webhook] Timestamp:", timestamp);
    console.log("[Webhook] Signature received:", signature);
    console.log("[Webhook] Payload length:", payload.length);
    console.log("[Webhook] Payload preview:", payload.substring(0, 200));
    console.log("[Webhook] Secret length:", secret.length);
    console.log("[Webhook] Secret starts with:", secret.substring(0, 10));
    
    // OpenAI webhook signature format:
    // 1. Get timestamp from OpenAI-Timestamp header
    // 2. Concatenate: timestamp + "." + payload
    // 3. Compute HMAC-SHA256 of the concatenated string
    // 4. Compare with signature (hex format)
    
    if (!timestamp) {
      console.error("[Webhook] ❌ Missing timestamp for signature verification");
      return false;
    }
    
    // Validate timestamp to prevent replay attacks (within 5 minutes)
    const timestampNum = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTime - timestampNum);
    const fiveMinutes = 5 * 60; // 5 minutes in seconds
    
    console.log("[Webhook] Timestamp (parsed):", timestampNum);
    console.log("[Webhook] Current time:", currentTime);
    console.log("[Webhook] Time difference:", timeDifference, "seconds");
    
    if (timeDifference > fiveMinutes) {
      console.error(`[Webhook] ❌ Timestamp too old or too far in future. Difference: ${timeDifference}s (max: ${fiveMinutes}s)`);
      return false;
    }
    
    console.log("[Webhook] ✅ Timestamp validation passed");
    
    // Construct the signed payload: timestamp.payload
    const signedPayload = `${timestamp}.${payload}`;
    console.log("[Webhook] Signed payload length:", signedPayload.length);
    console.log("[Webhook] Signed payload preview:", signedPayload.substring(0, 100));
    
    // Compute the expected signature using HMAC-SHA256
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");
    
    console.log("[Webhook] Expected signature (computed):", expectedSignature);
    console.log("[Webhook] Received signature:", signature);
    console.log("[Webhook] Signatures match length:", expectedSignature.length === signature.length);
    
    // Try to compare signatures
    try {
      // Compare signatures using timing-safe comparison
      // Signature should be in hex format
      const signatureBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");
      
      console.log("[Webhook] Signature buffer length:", signatureBuffer.length);
      console.log("[Webhook] Expected buffer length:", expectedBuffer.length);
      
      if (signatureBuffer.length !== expectedBuffer.length) {
        console.error("[Webhook] ❌ Signature lengths don't match!");
        console.error("[Webhook] Received signature (hex):", signature);
        console.error("[Webhook] Expected signature (hex):", expectedSignature);
        return false;
      }
      
      const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
      
      if (isValid) {
        console.log("[Webhook] ✅ Signature verification SUCCESSFUL");
      } else {
        console.error("[Webhook] ❌ Signature verification FAILED");
        console.error("[Webhook] Received:", signature);
        console.error("[Webhook] Expected:", expectedSignature);
        // Show first 50 chars for comparison
        console.error("[Webhook] Received (first 50):", signature.substring(0, 50));
        console.error("[Webhook] Expected (first 50):", expectedSignature.substring(0, 50));
      }
      
      return isValid;
    } catch (bufferError) {
      console.error("[Webhook] ❌ Error creating buffers for comparison:", bufferError);
      console.error("[Webhook] Signature might not be in hex format. Trying direct comparison...");
      
      // Fallback: try direct string comparison (less secure but for debugging)
      const isValid = signature === expectedSignature;
      console.log("[Webhook] Direct string comparison result:", isValid);
      return isValid;
    }
  } catch (error) {
    console.error("[Webhook] ❌ Signature verification error:", error);
    if (error instanceof Error) {
      console.error("[Webhook] Error message:", error.message);
      console.error("[Webhook] Error stack:", error.stack);
    }
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    
    // Log all headers for debugging
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log("[Webhook] ========== WEBHOOK REQUEST RECEIVED ==========");
    console.log("[Webhook] Timestamp:", new Date().toISOString());
    console.log("[Webhook] URL:", request.url);
    console.log("[Webhook] Method:", request.method);
    console.log("[Webhook] All headers:", JSON.stringify(allHeaders, null, 2));
    
    // Get signature and timestamp from headers (OpenAI uses OpenAI-Signature and OpenAI-Timestamp)
    const signature = 
      request.headers.get("openai-signature") ||
      request.headers.get("OpenAI-Signature") ||
      request.headers.get("x-openai-signature") ||
      request.headers.get("X-OpenAI-Signature");
    
    const timestamp = 
      request.headers.get("openai-timestamp") ||
      request.headers.get("OpenAI-Timestamp") ||
      request.headers.get("x-openai-timestamp") ||
      request.headers.get("X-OpenAI-Timestamp");
    
    console.log("[Webhook] Signature header found:", signature ? "yes" : "no");
    console.log("[Webhook] Signature value:", signature ? `${signature.substring(0, 50)}...` : "missing");
    console.log("[Webhook] Signature full length:", signature?.length || 0);
    console.log("[Webhook] Timestamp header found:", timestamp ? "yes" : "no");
    console.log("[Webhook] Timestamp value:", timestamp || "missing");
    console.log("[Webhook] Body length:", body.length);
    console.log("[Webhook] Body (first 500 chars):", body.substring(0, 500));
    
    const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET;
    const skipVerification = process.env.OPENAI_WEBHOOK_SKIP_VERIFICATION === "true";
    
    console.log("[Webhook] Secret configured:", !!webhookSecret);
    console.log("[Webhook] Secret length:", webhookSecret?.length || 0);
    console.log("[Webhook] Secret starts with:", webhookSecret ? webhookSecret.substring(0, 10) : "N/A");
    console.log("[Webhook] Skip verification:", skipVerification);
    
    // Verify signature if secret is configured
    if (webhookSecret && !skipVerification) {
      if (!signature) {
        console.error("[Webhook] ❌ Missing signature header");
        console.error("[Webhook] Available headers:", Object.keys(allHeaders));
        console.error("[Webhook] All header keys (lowercase):", Object.keys(allHeaders).map(k => k.toLowerCase()));
        return NextResponse.json(
          { error: "Missing signature header" },
          { status: 401 }
        );
      }
      
      if (!timestamp) {
        console.error("[Webhook] ❌ Missing timestamp header");
        console.error("[Webhook] Available headers:", Object.keys(allHeaders));
        console.error("[Webhook] All header keys (lowercase):", Object.keys(allHeaders).map(k => k.toLowerCase()));
        return NextResponse.json(
          { error: "Missing timestamp header" },
          { status: 401 }
        );
      }
      
      // OpenAI webhook secrets might have a prefix (like Stripe's whsec_)
      // Try with and without prefix
      let secretToUse = webhookSecret;
      if (webhookSecret.startsWith("whsec_")) {
        // Remove the whsec_ prefix if present (some systems use this format)
        secretToUse = webhookSecret.substring(6);
        console.log("[Webhook] Removed whsec_ prefix from secret");
      }
      
      console.log("[Webhook] Using secret length:", secretToUse.length);
      
      const isValid = verifyOpenAIWebhookSignature(body, signature, timestamp, secretToUse);
      
      if (!isValid) {
        // Try with original secret (with prefix) if first attempt failed
        if (webhookSecret.startsWith("whsec_") && webhookSecret !== secretToUse) {
          console.log("[Webhook] Retrying with original secret (with prefix)");
          const isValidWithPrefix = verifyOpenAIWebhookSignature(body, signature, timestamp, webhookSecret);
          if (isValidWithPrefix) {
            console.log("[Webhook] ✅ Signature verified with prefixed secret");
          } else {
            console.error("[Webhook] ❌ Signature verification failed with both secret formats");
            return NextResponse.json(
              { error: "Invalid signature" },
              { status: 401 }
            );
          }
        } else {
          console.error("[Webhook] ❌ Signature verification failed");
          return NextResponse.json(
            { error: "Invalid signature" },
            { status: 401 }
          );
        }
      } else {
        console.log("[Webhook] ✅ Signature verified successfully");
      }
    } else if (skipVerification) {
      console.warn("[Webhook] ⚠️ SKIPPING signature verification (OPENAI_WEBHOOK_SKIP_VERIFICATION=true)");
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
