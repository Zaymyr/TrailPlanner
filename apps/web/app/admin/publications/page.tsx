import { redirect } from "next/navigation";

import { resolveLegacyAdminUrl, toSearchParams, type SearchParamsRecord } from "../admin-redirects";

/** Former Publications page: each tab now has its console route (`admin-redirects.ts`). */
export default function LegacyPublicationsPage({ searchParams }: { searchParams?: SearchParamsRecord }) {
  redirect(resolveLegacyAdminUrl("/admin/publications", toSearchParams(searchParams)) ?? "/admin/content");
}
