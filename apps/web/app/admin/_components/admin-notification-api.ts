import type { AdminNotificationFormValue } from "./AdminNotificationDialog";

/**
 * The one send call of `AdminNotificationDialog` used by Coureurs (table and profile) and
 * Communication › Messages: `POST /api/admin/user-notifications` (in-app message first, then the
 * optional e-mail and push). Throws the route message so the dialog shows it.
 */
export async function sendAdminUserNotification(accessToken: string | null, userId: string, value: AdminNotificationFormValue) {
  if (!accessToken) throw new Error("Session admin manquante.");
  const response = await fetch("/api/admin/user-notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      notificationId: value.notificationId,
      userId,
      title: value.title,
      body: value.body,
      sendEmail: value.sendEmail,
      sendPush: value.sendPush,
    }),
  });
  if (response.ok) return;
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  throw new Error(payload?.message ? `${payload.message} (HTTP ${response.status})` : `Impossible d’envoyer le message. (HTTP ${response.status})`);
}

export const NOTIFICATION_SENT_MESSAGE = "Le message a été enregistré et les canaux sélectionnés ont été traités.";
