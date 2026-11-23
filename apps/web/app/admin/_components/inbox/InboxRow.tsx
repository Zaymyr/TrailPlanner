import type { Route } from "next";
import Link from "next/link";

import { cn } from "../../../../components/utils";
import { INBOX_TYPE_CONFIG, inboxItemAge, type InboxItem, type InboxTone, type InboxType } from "../../../../lib/admin-inbox";
import type { AdminNavIcon as AdminNavIconName } from "../../admin-routes";
import { AdminNavIcon } from "../shell/AdminNavIcon";

/** One row of « À traiter » (queue page and dashboard card): type, title, context, age, action. */

export const TONE_CLASSES: Record<InboxTone, string> = {
  red: "bg-[#fdecec] text-[#e05252] dark:bg-red-950/60 dark:text-red-200",
  orange: "bg-[#fef1e6] text-[#f0873a] dark:bg-orange-950/60 dark:text-orange-200",
  blue: "bg-[#eaf1fe] text-[#3b82f6] dark:bg-blue-950/60 dark:text-blue-200",
  green: "bg-[#eef3e6] text-[#2d5016] dark:bg-emerald-950/60 dark:text-emerald-200",
  lime: "bg-[#f6f8dc] text-[#7a8417] dark:bg-lime-950/60 dark:text-lime-200",
};

const TYPE_ICONS: Record<InboxType, AdminNavIconName> = {
  bug: "maintenance",
  feedback: "messages",
  race_request: "races",
  demo: "organizers",
  organizer_claim: "runners",
  publication_request: "organizers",
  edition_request: "calendar",
  flyover_failed: "flyovers",
  post_failed: "posts",
  post_draft: "posts",
  render_failed: "renders",
  system: "automation",
  race_data: "races",
};

export const actionLinkClass = (primary: boolean) =>
  cn(
    "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border px-2.5 text-[12.5px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    primary
      ? "border-brand bg-brand text-brand-foreground hover:bg-brand/90"
      : "border-[#d6d1c4] bg-card text-foreground hover:bg-muted dark:border-border",
  );

export function InboxTypeIcon({ type }: { type: InboxType }) {
  return (
    <span aria-hidden="true" className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]", TONE_CLASSES[INBOX_TYPE_CONFIG[type].tone])}>
      <AdminNavIcon name={TYPE_ICONS[type]} className="h-4 w-4" />
    </span>
  );
}

export function InboxRow({ item, nowMs, today, primary = false }: { item: InboxItem; nowMs: number; today: string; primary?: boolean }) {
  const config = INBOX_TYPE_CONFIG[item.type];
  const age = inboxItemAge(item, nowMs, today);
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-[#e6e2d8] px-4 py-[11px] last:border-b-0 dark:border-border sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
      <InboxTypeIcon type={item.type} />
      <div className="min-w-0">
        <p className="line-clamp-2 break-words font-semibold text-foreground sm:truncate" title={item.title}>{item.title}</p>
        <p className="truncate text-xs text-muted-foreground" title={item.context}>
          <span className="sr-only">{config.label} · </span>
          {item.context}
        </p>
      </div>
      <span
        title={age.title}
        className={cn("col-start-2 row-start-2 whitespace-nowrap text-xs sm:col-start-auto sm:row-start-auto", age.late ? "font-semibold text-[#c0392b] dark:text-red-300" : "text-muted-foreground")}
      >
        {age.label}
        {age.late ? <span className="sr-only"> (en retard)</span> : null}
      </span>
      <Link href={item.href as Route} className={cn(actionLinkClass(primary || age.late), "row-span-2 sm:row-span-1")}>
        {config.action}
        <span className="sr-only"> : {item.title}</span>
      </Link>
    </li>
  );
}
