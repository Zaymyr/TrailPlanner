import { describe, expect, it } from "vitest";

import { normalizeSignInErrorCode, SIGN_IN_ERROR_CODES } from "../../lib/auth-errors";

describe("normalizeSignInErrorCode", () => {
  it("keeps the stable invalid credentials code", () => {
    expect(normalizeSignInErrorCode({ error_code: "invalid_credentials" })).toBe(
      SIGN_IN_ERROR_CODES.invalidCredentials
    );
  });

  it("does not expose unknown Supabase error codes", () => {
    expect(normalizeSignInErrorCode({ error_code: "unexpected_provider_error" })).toBe(
      SIGN_IN_ERROR_CODES.signInFailed
    );
  });

  it("falls back when Supabase returns no JSON payload", () => {
    expect(normalizeSignInErrorCode(null)).toBe(SIGN_IN_ERROR_CODES.signInFailed);
  });
});
