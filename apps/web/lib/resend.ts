import { z } from "zod";

export type ResendConfig = {
  apiKey: string;
};

const resendConfigSchema = z.object({
  apiKey: z.string().trim().min(1),
});

export const getResendConfig = (): ResendConfig | null => {
  const parsed = resendConfigSchema.safeParse({
    apiKey: process.env.RESEND_API_KEY,
  });

  if (!parsed.success) {
    console.error("Missing Resend configuration", parsed.error.flatten().fieldErrors);
    return null;
  }

  return parsed.data;
};

export type ResendContactPayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed: boolean;
  properties?: Record<string, string>;
};

export type ResendContactSyncResult =
  | {
      status: "created" | "updated";
      id?: string;
      propertiesDropped?: boolean;
    }
  | {
      status: "failed";
      statusCode?: number;
      message: string;
    };

export type ResendContactSyncOptions = {
  requestDelayMs?: number;
  maxRetries?: number;
};

const resendContactResponseSchema = z
  .object({
    id: z.string().optional(),
  })
  .passthrough();

const readResendPayload = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
};

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (!payload || typeof payload !== "object") return fallback;

  const candidate = payload as { message?: unknown; error?: unknown; name?: unknown };
  if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
  if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error;
  if (typeof candidate.name === "string" && candidate.name.trim()) return candidate.name;

  return fallback;
};

const isExistingContactError = (status: number, payload: unknown): boolean => {
  if (status === 409) return true;
  const message = extractErrorMessage(payload, "").toLowerCase();
  return message.includes("already") || message.includes("exists") || message.includes("duplicate");
};

const isMissingPropertiesError = (result: ResendContactSyncResult): boolean => {
  if (result.status !== "failed" || result.statusCode !== 422) return false;
  return result.message.toLowerCase().includes("properties");
};

const mapSuccess = (payload: unknown, status: "created" | "updated"): ResendContactSyncResult => {
  const parsed = resendContactResponseSchema.safeParse(payload);
  return { status, id: parsed.success ? parsed.data.id : undefined };
};

const sleep = (delayMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, delayMs));

let nextResendRequestAt = 0;

const waitForResendSlot = async (requestDelayMs = 0): Promise<void> => {
  if (requestDelayMs <= 0) return;

  const now = Date.now();
  const waitMs = Math.max(0, nextResendRequestAt - now);
  nextResendRequestAt = Math.max(now, nextResendRequestAt) + requestDelayMs;

  if (waitMs > 0) {
    await sleep(waitMs);
  }
};

const parseRetryAfterMs = (response: Response): number => {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return 1200;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);

  const date = new Date(retryAfter);
  if (Number.isFinite(date.getTime())) return Math.max(0, date.getTime() - Date.now());

  return 1200;
};

const requestResend = async (
  config: ResendConfig,
  path: string,
  init: RequestInit,
  options: ResendContactSyncOptions = {}
): Promise<{ response: Response; payload: unknown }> => {
  const maxRetries = options.maxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    await waitForResendSlot(options.requestDelayMs);

    const response = await fetch(`https://api.resend.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

    const payload = await readResendPayload(response);

    if (response.status !== 429 || attempt >= maxRetries) {
      return { response, payload };
    }

    await sleep(parseRetryAfterMs(response));
  }

  throw new Error("Unable to complete Resend request.");
};

export const createResendContact = async (
  config: ResendConfig,
  contact: ResendContactPayload,
  options: ResendContactSyncOptions = {}
): Promise<ResendContactSyncResult> => {
  const { response, payload } = await requestResend(config, "/contacts", {
    method: "POST",
    body: JSON.stringify(contact),
  }, options);

  if (response.ok) return mapSuccess(payload, "created");

  return {
    status: "failed",
    statusCode: response.status,
    message: extractErrorMessage(payload, "Unable to create Resend contact."),
  };
};

export const updateResendContact = async (
  config: ResendConfig,
  contact: ResendContactPayload,
  options: ResendContactSyncOptions = {}
): Promise<ResendContactSyncResult> => {
  const { email, ...updatePayload } = contact;
  const { response, payload } = await requestResend(config, `/contacts/${encodeURIComponent(email)}`, {
    method: "PATCH",
    body: JSON.stringify(updatePayload),
  }, options);

  if (response.ok) return mapSuccess(payload, "updated");

  return {
    status: "failed",
    statusCode: response.status,
    message: extractErrorMessage(payload, "Unable to update Resend contact."),
  };
};

export const upsertResendContact = async (
  config: ResendConfig,
  contact: ResendContactPayload,
  options: ResendContactSyncOptions = {}
): Promise<ResendContactSyncResult> => {
  const upsert = async (payload: ResendContactPayload): Promise<ResendContactSyncResult> => {
    const created = await createResendContact(config, payload, options);

    if (created.status !== "failed") return created;

    if (!created.statusCode || !isExistingContactError(created.statusCode, created.message)) {
      return created;
    }

    return updateResendContact(config, payload, options);
  };

  const result = await upsert(contact);

  if (!contact.properties || !isMissingPropertiesError(result)) {
    return result;
  }

  const { properties: _properties, ...contactWithoutProperties } = contact;
  const retryResult = await upsert(contactWithoutProperties);

  return retryResult.status === "failed" ? retryResult : { ...retryResult, propertiesDropped: true };
};
