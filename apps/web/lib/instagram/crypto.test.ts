import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createOAuthState,
  decryptSocialToken,
  encryptSocialToken,
  parseSocialTokenKey,
  SocialTokenKeyError,
  verifyOAuthState,
} from "./crypto";

describe("social token encryption", () => {
  const key = randomBytes(32);

  it("round-trips a token through the AES-256-GCM envelope", () => {
    const envelope = encryptSocialToken(key, "IGAAtoken-123");
    expect(envelope.startsWith("v1:")).toBe(true);
    expect(envelope).not.toContain("IGAAtoken");
    expect(decryptSocialToken(key, envelope)).toBe("IGAAtoken-123");
  });

  it("uses a fresh IV for every encryption", () => {
    expect(encryptSocialToken(key, "same")).not.toBe(encryptSocialToken(key, "same"));
  });

  it("rejects a tampered envelope or another key", () => {
    const envelope = encryptSocialToken(key, "IGAAtoken");
    const [version, iv, tag, ciphertext] = envelope.split(":");
    const flipped = `${version}:${iv}:${tag}:${ciphertext.slice(0, -2)}AA`;
    expect(() => decryptSocialToken(key, flipped)).toThrow(SocialTokenKeyError);
    expect(() => decryptSocialToken(randomBytes(32), envelope)).toThrow(SocialTokenKeyError);
    expect(() => decryptSocialToken(key, "clear-token")).toThrow(SocialTokenKeyError);
  });

  it("accepts 32-byte keys in hex or base64 only", () => {
    const raw = randomBytes(32);
    expect(parseSocialTokenKey(raw.toString("hex"))?.equals(raw)).toBe(true);
    expect(parseSocialTokenKey(raw.toString("base64"))?.equals(raw)).toBe(true);
    expect(parseSocialTokenKey(raw.toString("base64url"))?.equals(raw)).toBe(true);
    expect(parseSocialTokenKey("too-short")).toBeNull();
    expect(parseSocialTokenKey(undefined)).toBeNull();
  });
});

describe("OAuth state", () => {
  const key = randomBytes(32);
  const now = Date.parse("2026-11-19T10:00:00Z");

  it("accepts the state of the same admin with the matching cookie nonce", () => {
    const { state, nonce } = createOAuthState(key, "admin-1", now);
    expect(verifyOAuthState(key, { state, cookieNonce: nonce, userId: "admin-1", nowMs: now + 60_000 })).toBe(true);
  });

  it("rejects another admin, another nonce, an expired or a forged state", () => {
    const { state, nonce } = createOAuthState(key, "admin-1", now);
    expect(verifyOAuthState(key, { state, cookieNonce: nonce, userId: "admin-2", nowMs: now })).toBe(false);
    expect(verifyOAuthState(key, { state, cookieNonce: "other", userId: "admin-1", nowMs: now })).toBe(false);
    expect(verifyOAuthState(key, { state, cookieNonce: nonce, userId: "admin-1", nowMs: now + 11 * 60_000 })).toBe(false);
    expect(verifyOAuthState(randomBytes(32), { state, cookieNonce: nonce, userId: "admin-1", nowMs: now })).toBe(false);
    expect(verifyOAuthState(key, { state: null, cookieNonce: nonce, userId: "admin-1", nowMs: now })).toBe(false);
  });
});
