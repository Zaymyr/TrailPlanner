/** Every prefilled admin message opens with a greeting and is signed by Faustin. */
export const ADMIN_MESSAGE_GREETING = "Bonjour,";
export const ADMIN_MESSAGE_SIGNATURE = "Faustin de Pace Yourself";

export const adminMessageBody = (core = "") =>
  [ADMIN_MESSAGE_GREETING, core.trim(), ADMIN_MESSAGE_SIGNATURE].join("\n\n");

/** Notification titles are limited to 160 characters (user_notifications_title_check). */
export const adminMessageTitle = (title: string) =>
  title.length <= 160 ? title : `${title.slice(0, 159).trimEnd()}…`;

/** Inbox items that are handled (completed or rejected) sink below and are slightly greyed. */
export const handledRowClassName = (status: string) => (status === "pending" ? "" : "opacity-60");
