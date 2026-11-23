"use client";

import { AuditLog } from "../../_components/audit/AuditLog";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";

/** Système › Journal (lot 7): the admin action log, `?du&au&action&statut&acteur&cible&recherche&page&entree`. */
export default function AdminSystemAuditPage() {
  const accessToken = useAdminAccessToken();
  return <AuditLog accessToken={accessToken} />;
}
