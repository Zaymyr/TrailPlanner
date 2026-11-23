import { redirect } from "next/navigation";

import { resolveLegacyAdminUrl, toSearchParams, type SearchParamsRecord } from "./admin-redirects";
import { AdminOverviewPage } from "./_components/pages/AdminOverviewPage";

/** Console home (« Vue d’ensemble »). Old `/admin?onglet=…` links are redirected to their new page. */
export default function AdminHomePage({ searchParams }: { searchParams?: SearchParamsRecord }) {
  const target = resolveLegacyAdminUrl("/admin", toSearchParams(searchParams));
  if (target) redirect(target);
  return <AdminOverviewPage />;
}
