import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM envelope for the Instagram long-lived token stored in social_accounts:
 * "v1:<iv>:<tag>:<ciphertext>" in base64url. The key (32 bytes, base64 or hex) is
 * SOCIAL_TOKEN_ENCRYPTION_KEY and never leaves the web server.
 */

const ENVELOPE_VERSION = "v1";
const AAD = Buffer.from("pace-yourself:social_accounts:access_token");

export class SocialTokenKeyError extends Error {}

export const parseSocialTokenKey = (raw: string | undefined | null): Buffer | null => {
  const value = raw?.trim();
  if (!value) return null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  try {
    const decoded = Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
};

export const getSocialTokenKey = () => parseSocialTokenKey(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY);

export const requireSocialTokenKey = () => {
  const key = getSocialTokenKey();
  if (!key) throw new SocialTokenKeyError("SOCIAL_TOKEN_ENCRYPTION_KEY absente ou invalide (32 octets en base64 ou hex).");
  return key;
};

export const encryptSocialToken = (key: Buffer, token: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
};

export const decryptSocialToken = (key: Buffer, envelope: string) => {
  const [version, ivRaw, tagRaw, ciphertextRaw] = envelope.split(":");
  if (version !== ENVELOPE_VERSION || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw new SocialTokenKeyError("Jeton chiffré illisible.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new SocialTokenKeyError("Le jeton Instagram ne peut pas être déchiffré (clé changée ?) : reconnecte le compte.");
  }
};

// ---------------------------------------------------------------------------------------------
// OAuth state (CSRF): "<expires>.<nonce>.<hmac>" bound to the admin who started the connection;
// the nonce is also kept in an httpOnly cookie and compared on the callback.

export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const stateKey = (key: Buffer) => createHmac("sha256", key).update("instagram-oauth-state").digest();

const signState = (key: Buffer, userId: string, expiresAt: number, nonce: string) =>
  createHmac("sha256", stateKey(key)).update(`${userId}:${expiresAt}:${nonce}`).digest("base64url");

export const createOAuthState = (key: Buffer, userId: string, nowMs = Date.now()) => {
  const nonce = randomBytes(18).toString("base64url");
  const expiresAt = Math.floor(nowMs / 1_000) + OAUTH_STATE_TTL_SECONDS;
  return { nonce, state: `${expiresAt}.${nonce}.${signState(key, userId, expiresAt, nonce)}` };
};

export const verifyOAuthState = (
  key: Buffer,
  { state, cookieNonce, userId, nowMs = Date.now() }: { state: string | null; cookieNonce: string | null; userId: string; nowMs?: number },
) => {
  if (!state || !cookieNonce) return false;
  const [expiresRaw, nonce, signature] = state.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || !nonce || !signature || expiresAt * 1_000 < nowMs) return false;
  const nonceMatches = nonce.length === cookieNonce.length && timingSafeEqual(Buffer.from(nonce), Buffer.from(cookieNonce));
  const expected = Buffer.from(signState(key, userId, expiresAt, nonce));
  const received = Buffer.from(signature);
  return nonceMatches && expected.length === received.length && timingSafeEqual(expected, received);
};
