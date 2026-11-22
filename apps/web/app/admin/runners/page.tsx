"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AdminUsersTab } from "../_components/AdminUsersTab";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";
import { AdminPageHeader } from "../_components/shell/AdminPageHeader";

function RunnersContent() {
  const accessToken = useAdminAccessToken();
  const search = useSearchParams()?.get("recherche")?.trim() ?? "";
  // A new `?recherche=` (⌘K palette) restarts the list with that search.
  return <AdminUsersTab key={search} accessToken={accessToken} initialSearch={search} />;
}

/** Coureurs: the former Utilisateurs tab (roles, Premium, details, message). `?recherche=` pre-fills the search. */
export default function AdminRunnersPage() {
  return (
    <>
      <AdminPageHeader title="Coureurs" description="Comptes, rôles, Premium, détails et messages." />
      <Suspense fallback={null}>
        <RunnersContent />
      </Suspense>
    </>
  );
}
