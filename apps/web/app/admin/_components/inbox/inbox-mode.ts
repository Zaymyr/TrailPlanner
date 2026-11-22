import { MESSAGING_VIEWS, type MessagingView } from "../../admin-tabs";

/**
 * Tabs of `/admin/inbox` (pure): « File » (the single queue, default) and « Traiter » (the former
 * Messagerie sub-tabs, where bugs, feedback, race and demo requests are answered). `?vue=bugs|feedback|
 * demandes|demos` opens « Traiter » on that sub-tab; the queue keeps `?filtre=` and `?recherche=`.
 */

export const INBOX_PAGE_VIEWS = MESSAGING_VIEWS.filter((view): view is Exclude<MessagingView, "questionnaires"> => view !== "questionnaires");

export type InboxMode = "file" | "traiter";

export const readInboxMode = (search: string): InboxMode => {
  const view = new URLSearchParams(search).get("vue");
  return INBOX_PAGE_VIEWS.some((candidate) => candidate === view) ? "traiter" : "file";
};

/** Search string of a tab: « Traiter » opens bugs unless a sub-tab is already set; « File » drops `?vue=`. */
export const searchForInboxMode = (search: string, mode: InboxMode): string => {
  const params = new URLSearchParams(search);
  if (mode === "file") params.delete("vue");
  else if (readInboxMode(search) !== "traiter") params.set("vue", "bugs");
  const next = params.toString();
  return next ? `?${next}` : "";
};
