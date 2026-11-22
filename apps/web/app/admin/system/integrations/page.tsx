"use client";

import { useQuery } from "@tanstack/react-query";

import { InstagramIntegration } from "../../publications/PublicationViews";
import { adminFetch, instagramStatusSchema } from "../../publications/publications-api";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";

/** Intégrations (lot 1): the Instagram account card; Stripe, Resend, GCP and Mapbox come with lot 3. */
export default function AdminSystemIntegrationsPage() {
  const accessToken = useAdminAccessToken();
  const statusQuery = useQuery({
    queryKey: ["admin", "instagram-status", accessToken],
    queryFn: () => adminFetch(accessToken, "/api/admin/instagram", instagramStatusSchema, {}, "Le compte Instagram n’a pas pu être lu."),
  });
  return (
    <>
      <AdminPageHeader title="Intégrations" description="Compte Instagram, mode simulation et quota de publication. Les autres services (Stripe, Resend, rendus, Mapbox) arrivent au lot 3." />
      <InstagramIntegration workspace={{ statusQuery }} />
    </>
  );
}
