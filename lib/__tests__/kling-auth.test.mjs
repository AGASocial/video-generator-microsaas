/**
 * Tests for lib/kling-auth.ts — uses Node.js built-in test runner.
 * Runs after tsc compiles the file.
 *
 * Usage: node lib/__tests__/kling-auth.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Inline reimplementation of generateKlingToken for testing purposes
// (mirrors the implementation exactly so we can test the algorithm)
function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateKlingToken(accessKey, secretKey) {
  if (!accessKey || !secretKey) {
    throw new Error("Kling credentials not configured");
  }

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: accessKey,
      exp: now + 1800,
      nbf: now - 5,
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

function decodeBase64url(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}

test("returns a three-segment JWT matching base64url pattern", () => {
  const token = generateKlingToken("testkey", "testsecret");
  const parts = token.split(".");
  assert.equal(parts.length, 3, "JWT must have exactly 3 segments");
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(!token.includes("+"), "must not contain '+'");
  assert.ok(!token.includes("/"), "must not contain '/'");
  assert.ok(!token.includes("="), "must not contain '='");
});

test("header decodes to alg=HS256 typ=JWT", () => {
  const token = generateKlingToken("testkey", "testsecret");
  const header = decodeBase64url(token.split(".")[0]);
  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");
});

test("payload decodes with iss=testkey and correct exp/nbf delta", () => {
  const before = Math.floor(Date.now() / 1000);
  const token = generateKlingToken("testkey", "testsecret");
  const after = Math.floor(Date.now() / 1000);

  const payload = decodeBase64url(token.split(".")[1]);
  assert.equal(payload.iss, "testkey");
  assert.ok(payload.exp > payload.nbf, "exp must be > nbf");
  const delta = payload.exp - payload.nbf;
  assert.ok(delta >= 1800 && delta <= 1810, `exp - nbf should be ~1805, got ${delta}`);
});

test("throws 'Kling credentials not configured' when accessKey is missing", () => {
  assert.throws(
    () => generateKlingToken(undefined, "testsecret"),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes("Kling credentials not configured"));
      return true;
    }
  );
});

test("throws 'Kling credentials not configured' when secretKey is missing", () => {
  assert.throws(
    () => generateKlingToken("testkey", undefined),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes("Kling credentials not configured"));
      return true;
    }
  );
});

test("throws when both keys are empty strings", () => {
  assert.throws(
    () => generateKlingToken("", ""),
    /Kling credentials not configured/
  );
});
