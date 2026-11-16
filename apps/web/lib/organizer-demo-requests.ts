import { z } from "zod";

import { supportEmail } from "../app/support/copy";
import { ORGANIZER_UTM_KEYS, type OrganizerAttribution } from "./organizer-acquisition";
import { escapeEmailHtml, sendTransactionalEmail } from "./resend";
import type { SupabaseServiceConfig } from "./supabase";

const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^[+()\d\s.-]{6,40}$/.test(value), "Numéro de téléphone invalide.");

/** Public demo request form (email and race link required, phone optional). */
export const organizerDemoRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(320),
  raceUrl: z
    .string()
    .trim()
    .max(2048)
    .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
    .refine((value) => {
      try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
      } catch {
        return false;
      }
    }, "Lien de course invalide."),
  phone: optionalPhone,
  attribution: z.record(z.string(), z.string().max(200)).optional().default({}),
  // Honeypot: real visitors never fill this hidden field.
  website: z.string().max(200).optional(),
});

export type OrganizerDemoRequestInput = z.infer<typeof organizerDemoRequestSchema>;

export const demoRequestStatusSchema = z.enum(["pending", "completed", "rejected"]);

export const keepKnownAttribution = (attribution: Record<string, string>): OrganizerAttribution => {
  const kept: OrganizerAttribution = {};
  for (const key of ORGANIZER_UTM_KEYS) if (attribution[key]) kept[key] = attribution[key];
  return kept;
};

/** Where the admin notification is sent; defaults to the support mailbox. */
export const demoRequestAdminEmail = () => process.env.ORGANIZER_DEMO_NOTIFY_EMAIL?.trim() || supportEmail;

const layout = (title: string, body: string) => `<!doctype html>
<html lang="fr"><body style="margin:0; padding:24px 12px; background:#f4f1ea; font-family:Arial, Helvetica, sans-serif; color:#1f2410;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e5e2d8; border-radius:16px;">
    <tr><td style="padding:28px 28px 8px 28px;">
      <p style="margin:0 0 6px 0; color:#2d5016; font-size:12px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase;">Pace Yourself · Organisateurs</p>
      <h1 style="margin:0 0 16px 0; font-size:24px; line-height:31px;">${title}</h1>
    </td></tr>
    <tr><td style="padding:0 28px 28px 28px; font-size:15px; line-height:24px; color:#3d4433;">${body}</td></tr>
  </table>
</body></html>`;

const detailRow = (label: string, value: string) =>
  `<tr><td style="padding:6px 12px 6px 0; color:#8a917e; font-size:13px; white-space:nowrap; vertical-align:top;">${label}</td><td style="padding:6px 0; font-size:14px; word-break:break-all;">${value}</td></tr>`;

export function buildDemoRequestAdminEmail(request: { email: string; raceUrl: string; phone: string | null; attribution: OrganizerAttribution }) {
  const email = escapeEmailHtml(request.email);
  const raceUrl = escapeEmailHtml(request.raceUrl);
  const phone = request.phone ? escapeEmailHtml(request.phone) : "Non renseigné";
  const source = Object.entries(request.attribution).map(([key, value]) => `${key}=${value}`).join(" · ");
  const html = layout(
    "Nouvelle demande de démo",
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0">
      ${detailRow("E-mail", `<a href="mailto:${email}" style="color:#2d5016;">${email}</a>`)}
      ${detailRow("Course", `<a href="${raceUrl}" style="color:#2d5016;">${raceUrl}</a>`)}
      ${detailRow("Téléphone", phone)}
      ${source ? detailRow("Source", escapeEmailHtml(source)) : ""}
    </table>
    <p style="margin:18px 0 0 0;">La demande est aussi dans l’admin : Messagerie › Demandes de course.</p>`,
  );
  const text = [
    "Nouvelle demande de démo organisateur",
    `E-mail : ${request.email}`,
    `Course : ${request.raceUrl}`,
    `Téléphone : ${request.phone ?? "Non renseigné"}`,
    source ? `Source : ${source}` : null,
    "",
    "Aussi visible dans l'admin : Messagerie › Demandes de course.",
  ].filter((line) => line !== null).join("\n");
  return { subject: `Demande de démo · ${request.raceUrl}`.slice(0, 160), html, text };
}

export function buildDemoRequestConfirmationEmail(request: { raceUrl: string }) {
  const raceUrl = escapeEmailHtml(request.raceUrl);
  const html = layout(
    "Votre demande de démo est bien reçue",
    `<p style="margin:0 0 14px 0;">Bonjour,</p>
    <p style="margin:0 0 14px 0;">Merci pour votre intérêt pour Pace Yourself. Nous avons bien reçu votre demande de démo pour la course suivante :</p>
    <p style="margin:0 0 14px 0; padding:12px 14px; background:#faf8f2; border-left:4px solid #2d5016; border-radius:8px; word-break:break-all;"><a href="${raceUrl}" style="color:#2d5016;">${raceUrl}</a></p>
    <p style="margin:0 0 14px 0;">Nous revenons vers vous rapidement pour vous montrer le Livret coureur et le Livret supporter appliqués à votre événement.</p>
    <p style="margin:0;">À bientôt,<br><strong>L’équipe Pace Yourself</strong></p>`,
  );
  const text = `Bonjour,\n\nMerci pour votre intérêt pour Pace Yourself. Nous avons bien reçu votre demande de démo pour la course suivante :\n${request.raceUrl}\n\nNous revenons vers vous rapidement pour vous montrer le Livret coureur et le Livret supporter appliqués à votre événement.\n\nÀ bientôt,\nL'équipe Pace Yourself`;
  return { subject: "Votre demande de démo Pace Yourself est bien reçue", html, text };
}

type EmailStatus = "sent" | "skipped" | "failed";

/**
 * Stores the request (when the table is deployed), then e-mails the admin and
 * the organizer. The e-mails do not depend on the insert so a request is never
 * lost while the migration is pending; the insert result is reported back.
 */
export async function submitOrganizerDemoRequest(
  config: SupabaseServiceConfig | null,
  input: { email: string; raceUrl: string; phone: string | null; attribution: OrganizerAttribution },
): Promise<{ stored: boolean; adminEmail: EmailStatus; confirmationEmail: EmailStatus }> {
  let requestId: string | null = null;
  if (config) {
    try {
      const response = await fetch(`${config.supabaseUrl}/rest/v1/organizer_demo_requests?select=id`, {
        method: "POST",
        headers: {
          apikey: config.supabaseServiceRoleKey,
          Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ email: input.email, race_url: input.raceUrl, phone: input.phone, attribution: input.attribution }),
        cache: "no-store",
      });
      if (response.ok) {
        const rows = (await response.json().catch(() => [])) as Array<{ id?: string }>;
        requestId = rows[0]?.id ?? null;
      } else {
        console.error("Unable to store organizer demo request", response.status, await response.text().catch(() => ""));
      }
    } catch (error) {
      console.error("Unable to store organizer demo request", error);
    }
  }

  const idempotencySuffix = requestId ?? `${input.email}/${input.raceUrl}`.slice(0, 200);
  const adminCopy = buildDemoRequestAdminEmail(input);
  const confirmationCopy = buildDemoRequestConfirmationEmail(input);
  const [adminResult, confirmationResult] = await Promise.all([
    sendTransactionalEmail({ to: demoRequestAdminEmail(), ...adminCopy, replyTo: input.email, idempotencyKey: `organizer-demo/admin/${idempotencySuffix}` }),
    sendTransactionalEmail({ to: input.email, ...confirmationCopy, replyTo: supportEmail, idempotencyKey: `organizer-demo/confirmation/${idempotencySuffix}` }),
  ]);

  if (config && requestId) {
    await fetch(`${config.supabaseUrl}/rest/v1/organizer_demo_requests?id=eq.${requestId}`, {
      method: "PATCH",
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ admin_email_status: adminResult.status, confirmation_email_status: confirmationResult.status }),
      cache: "no-store",
    }).catch((error) => console.warn("Unable to record demo request e-mail status", error));
  }

  return { stored: Boolean(requestId), adminEmail: adminResult.status, confirmationEmail: confirmationResult.status };
}
