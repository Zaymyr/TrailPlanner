"use client";

import type { Route } from "next";
import Link from "next/link";

import { AdminOrganizerClaimsTab } from "../_components/AdminOrganizerClaimsTab";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";
import { AdminPageHeader } from "../_components/shell/AdminPageHeader";

/** Organisateurs: the former tab with its sub-views « Publier le livret » and « Accès » (`?vue=acces`). */
export default function AdminOrganizersPage() {
  const accessToken = useAdminAccessToken();
  return (
    <>
      <AdminPageHeader
        title="Organisateurs"
        description="Publication des livrets, éditions et packs, accès des organisateurs."
        actions={
          <Link href={"/admin/organizers/social-proofs" as Route} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
            Preuves sociales →
          </Link>
        }
      />
      <AdminOrganizerClaimsTab accessToken={accessToken} />
    </>
  );
}
