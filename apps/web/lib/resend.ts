import { z } from "zod";

export type ResendConfig = {
  apiKey: string;
  from: string;
};

const DEFAULT_RESEND_FROM = "Pace Yourself <hello@mail.pace-yourself.com>";

const resendConfigSchema = z.object({
  apiKey: z.string().trim().min(1),
  from: z.string().trim().min(1),
});

export const getResendConfig = (): ResendConfig | null => {
  const parsed = resendConfigSchema.safeParse({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM ?? DEFAULT_RESEND_FROM,
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

export type ResendIdentifiedUser = {
  id: string;
  email?: string | null;
  isAnonymous?: boolean;
  appMetadata?: {
    provider?: string;
  } | null;
  userMetadata?: Record<string, unknown> | null;
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

export type ResendIdentifiedUserSyncResult =
  | {
      status: "skipped";
      reason: "missing-email" | "anonymous-user" | "missing-config";
    }
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

export type OrganizerAssignmentEmailResult =
  | { status: "sent"; id?: string }
  | { status: "skipped"; reason: "missing-config" }
  | { status: "failed"; statusCode?: number; message: string };

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

const getMetadataString = (metadata: Record<string, unknown> | null | undefined, keys: string[]): string | null => {
  if (!metadata) return null;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
};

const splitName = (fullName: string | null): Pick<ResendContactPayload, "firstName" | "lastName"> => {
  if (!fullName) return {};

  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
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

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });

const buildOrganizerAssignmentHtml = (eventName: string, organizerUrl: string): string => `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>Une nouvelle course vous a été attribuée</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; display: block; outline: none; text-decoration: none; }
      body { margin: 0; padding: 0; width: 100% !important; background: #eceae3; }
      a { color: #2d5016; }
      @media screen and (max-width: 640px) {
        .container { width: 100% !important; }
        .mobile-px { padding-left: 22px !important; padding-right: 22px !important; }
        .mobile-button { width: 100% !important; }
        .mobile-title { font-size: 28px !important; line-height: 34px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#eceae3;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; line-height:1px;">
      Vous pouvez maintenant gérer ${eventName} sur Pace Yourself.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eceae3;">
      <tr>
        <td align="center" style="padding:30px 14px;">
          <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:600px;">
            <tr>
              <td style="padding:0 0 14px 0;">
                <img src="https://pace-yourself.com/branding/logo-horizontal-v2.png" width="178" alt="Pace Yourself" style="width:178px; max-width:178px; height:auto;">
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e2d8;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="mobile-px" style="padding:36px 38px 20px 38px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="background:#f4f2ec; border:1px solid #e5e2d8; border-radius:999px; color:#5c6450; font-family:Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; letter-spacing:.4px; padding:7px 12px;">
                            Accès organisateur
                          </td>
                        </tr>
                      </table>
                      <h1 class="mobile-title" style="margin:22px 0 14px 0; color:#1f2410; font-family:Arial, Helvetica, sans-serif; font-size:34px; line-height:41px; font-weight:700; letter-spacing:-.3px;">
                        Une nouvelle course vous a été attribuée.
                      </h1>
                      <p style="margin:0; color:#5c6450; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:26px;">
                        Bonjour,<br><br>Votre compte Pace Yourself a été rattaché à cette course en tant qu’organisateur.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-px" style="padding:4px 38px 28px 38px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#faf8f2; border:1px solid #e5e2d8; border-left:4px solid #2d5016; border-radius:12px;">
                        <tr>
                          <td style="padding:18px 20px;">
                            <p style="margin:0 0 6px 0; color:#8a917e; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase;">Course attribuée</p>
                            <p style="margin:0; color:#1f2410; font-family:Arial, Helvetica, sans-serif; font-size:18px; line-height:25px; font-weight:700;">${eventName}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" class="mobile-px" style="padding:0 38px 32px 38px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="mobile-button">
                        <tr>
                          <td align="center" style="background:#2d5016; border-radius:12px;">
                            <a href="${organizerUrl}" style="display:inline-block; padding:15px 28px; color:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:20px; font-weight:700; text-decoration:none;">Gérer cette course</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:14px 0 0 0; color:#8a917e; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px;">
                        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
                        <a href="${organizerUrl}" style="color:#2d5016; word-break:break-all;">${organizerUrl}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-px" style="padding:0 38px 34px 38px;">
                      <p style="margin:0; color:#5c6450; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:23px;">
                        À bientôt,<br><strong style="color:#1f2410;">L’équipe Pace Yourself</strong>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 18px 0 18px;">
                <p style="margin:0; color:#8a917e; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px;">
                  Cet e-mail confirme l’ajout d’un accès organisateur à votre compte sur <a href="https://pace-yourself.com" style="color:#2d5016;">pace-yourself.com</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const sendOrganizerAssignmentEmail = async (input: {
  to: string;
  eventName: string;
  organizerUrl: string;
}): Promise<OrganizerAssignmentEmailResult> => {
  const config = getResendConfig();
  if (!config) return { status: "skipped", reason: "missing-config" };

  const eventName = input.eventName.trim();
  const escapedEventName = escapeHtml(eventName);
  const escapedOrganizerUrl = escapeHtml(input.organizerUrl);
  const { response, payload } = await requestResend(config, "/emails", {
    method: "POST",
    body: JSON.stringify({
      from: config.from,
      to: [input.to.trim().toLowerCase()],
      subject: `Vous gérez maintenant ${eventName} sur Pace Yourself`,
      html: buildOrganizerAssignmentHtml(escapedEventName, escapedOrganizerUrl),
      text: `Bonjour,\n\nVous avez été rattaché à ${eventName} en tant qu’organisateur sur Pace Yourself.\n\nGérer cette course : ${input.organizerUrl}\n\nÀ bientôt,\nL’équipe Pace Yourself`,
    }),
  });

  if (response.ok) {
    const parsed = resendContactResponseSchema.safeParse(payload);
    return { status: "sent", id: parsed.success ? parsed.data.id : undefined };
  }

  return {
    status: "failed",
    statusCode: response.status,
    message: extractErrorMessage(payload, "Unable to send organizer assignment email."),
  };
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

export const syncIdentifiedUserToResendContact = async (
  user: ResendIdentifiedUser,
  options: ResendContactSyncOptions = {}
): Promise<ResendIdentifiedUserSyncResult> => {
  if (user.isAnonymous || user.appMetadata?.provider === "anonymous") {
    return { status: "skipped", reason: "anonymous-user" };
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return { status: "skipped", reason: "missing-email" };
  }

  const config = getResendConfig();
  if (!config) {
    return { status: "skipped", reason: "missing-config" };
  }

  const fullName = getMetadataString(user.userMetadata, ["full_name", "name"]);

  return upsertResendContact(
    config,
    {
      email,
      ...splitName(fullName),
      unsubscribed: false,
    },
    options
  );
};
