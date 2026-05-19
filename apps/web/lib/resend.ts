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
    }
  | {
      status: "failed";
      statusCode?: number;
      message: string;
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

const mapSuccess = (payload: unknown, status: "created" | "updated"): ResendContactSyncResult => {
  const parsed = resendContactResponseSchema.safeParse(payload);
  return { status, id: parsed.success ? parsed.data.id : undefined };
};

const requestResend = async (
  config: ResendConfig,
  path: string,
  init: RequestInit
): Promise<{ response: Response; payload: unknown }> => {
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
  return { response, payload };
};

export const createResendContact = async (
  config: ResendConfig,
  contact: ResendContactPayload
): Promise<ResendContactSyncResult> => {
  const { response, payload } = await requestResend(config, "/contacts", {
    method: "POST",
    body: JSON.stringify(contact),
  });

  if (response.ok) return mapSuccess(payload, "created");

  return {
    status: "failed",
    statusCode: response.status,
    message: extractErrorMessage(payload, "Unable to create Resend contact."),
  };
};

export const updateResendContact = async (
  config: ResendConfig,
  contact: ResendContactPayload
): Promise<ResendContactSyncResult> => {
  const { email, ...updatePayload } = contact;
  const { response, payload } = await requestResend(config, `/contacts/${encodeURIComponent(email)}`, {
    method: "PATCH",
    body: JSON.stringify(updatePayload),
  });

  if (response.ok) return mapSuccess(payload, "updated");

  return {
    status: "failed",
    statusCode: response.status,
    message: extractErrorMessage(payload, "Unable to update Resend contact."),
  };
};

export const upsertResendContact = async (
  config: ResendConfig,
  contact: ResendContactPayload
): Promise<ResendContactSyncResult> => {
  const created = await createResendContact(config, contact);

  if (created.status !== "failed") return created;

  if (!created.statusCode || !isExistingContactError(created.statusCode, created.message)) {
    return created;
  }

  return updateResendContact(config, contact);
};
