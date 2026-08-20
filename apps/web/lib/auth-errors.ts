export const SIGN_IN_ERROR_CODES = {
  invalidCredentials: "invalid_credentials",
  signInFailed: "sign_in_failed",
} as const;

export type SignInErrorCode = (typeof SIGN_IN_ERROR_CODES)[keyof typeof SIGN_IN_ERROR_CODES];

export function normalizeSignInErrorCode(payload: unknown): SignInErrorCode {
  if (
    payload &&
    typeof payload === "object" &&
    "error_code" in payload &&
    payload.error_code === SIGN_IN_ERROR_CODES.invalidCredentials
  ) {
    return SIGN_IN_ERROR_CODES.invalidCredentials;
  }

  return SIGN_IN_ERROR_CODES.signInFailed;
}
