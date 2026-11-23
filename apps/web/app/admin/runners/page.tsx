"use client";

import { Suspense } from "react";

import { AdminUsersTab } from "../_components/AdminUsersTab";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";
import { AdminPageHeader } from "../_components/shell/AdminPageHeader";

function RunnersContent() {
  const accessToken = useAdminAccessToken();
  // The list reads and writes its own URL (`?recherche=` of the ⌘K palette, filters, `?coureur=`).
  return <AdminUsersTab accessToken={accessToken} />;
}

/** Coureurs: list of accounts and, on a row, the runner profile drawer (`?coureur=<userId>`, lot 5). */
export default function AdminRunnersPage() {
  return (
    <>
      <AdminPageHeader title="Coureurs" description="Comptes, rôles, Premium, messages et retours : cliquez sur une ligne pour ouvrir la fiche." />
      <Suspense fallback={null}>
        <RunnersContent />
      </Suspense>
    </>
  );
}
