/**
 * Kling AI JWT Authentication
 * Generates short-lived JWT tokens for Kling API requests.
 * Server-side only — never import from client components.
 *
 * JWT spec verified from: github.com/199-mcp/mcp-kling/blob/main/generate-jwt.mjs
 * Algorithm: HS256 (HMAC-SHA256)
 * Claims: iss=KLING_ACCESS_KEY, exp=now+1800, nbf=now-5
 */
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
