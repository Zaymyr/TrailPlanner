"use client";

import type { Route } from "next";
import Link from "next/link";

import { MESSAGING_VIEWS } from "../admin-tabs";
import { AdminMessagingTab } from "../_components/AdminMessagingTab";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";
import { AdminPageHeader } from "../_components/shell/AdminPageHeader";
import { useInboxCounts } from "../_components/useInboxCounts";

const INBOX_VIEWS = MESSAGING_VIEWS.filter((view) => view !== "questionnaires");

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full bg-[#fdecec] px-2.5 py-1 text-xs font-semibold text-[#9b2c2c] hover:bg-[#fbd9d9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-red-950/60 dark:text-red-100";

/** « À traiter » (lot 1): the Messagerie sub-tabs plus links to the pending organizer requests. Lot 2 turns it into one queue. */
export default function AdminInboxPage() {
  const accessToken = useAdminAccessToken();
  const counts = useInboxCounts(accessToken).data;
  const organizerLinks = counts
    ? [
        { href: "/admin/organizers", label: "Demandes de publication", count: counts.publicationRequests },
        { href: "/admin/organizers", label: "Nouvelles éditions", count: counts.editionRequests },
        { href: "/admin/organizers?vue=acces", label: "Demandes d’accès organisateur", count: counts.organizerClaims },
      ].filter((link) => link.count > 0)
    : [];
  return (
    <>
      <AdminPageHeader title="À traiter" description="Bugs, feedback, demandes de course et de démo. Les demandes des organisateurs se traitent dans Organisateurs." />
      {organizerLinks.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Demandes des organisateurs">
          <span className="text-sm text-muted-foreground">Organisateurs :</span>
          {organizerLinks.map((link) => (
            <Link key={link.label} href={link.href as Route} className={chipClass}>
              {link.label} <b className="font-mono">{link.count}</b>
            </Link>
          ))}
        </div>
      ) : null}
      <AdminMessagingTab accessToken={accessToken} views={INBOX_VIEWS} title="Messages et demandes" />
    </>
  );
}
