"use client";

import { useQuery } from "@tanstack/react-query";

import { InstagramIntegration } from "../../publications/PublicationViews";
import { adminFetch, instagramStatusSchema } from "../../publications/publications-api";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";
import { IntegrationCards } from "../../_components/system/SystemPanels";
import { errorMessage, useIntegrations } from "../../_components/system/system-api";

/** Intégrations: the Instagram account card, then (lot 3) Stripe, Resend, Google Cloud, Mapbox, ElevenLabs, Anthropic, OpenAI. */
export default function AdminSystemIntegrationsPage() {
  const accessToken = useAdminAccessToken();
  const statusQuery = useQuery({
    queryKey: ["admin", "instagram-status", accessToken],
    queryFn: () => adminFetch(accessToken, "/api/admin/instagram", instagramStatusSchema, {}, "Le compte Instagram n’a pas pu être lu."),
  });
  const integrations = useIntegrations(accessToken);
  const nowMs = integrations.data ? Date.parse(integrations.data.generatedAt) : Date.now();
  return (
    <>
      <AdminPageHeader
        title="Intégrations"
        description="Compte Instagram et services tiers : configuration présente ou absente (jamais la valeur d’une clé) et dernière activité connue."
      />
      <div className="space-y-6">
        <InstagramIntegration workspace={{ statusQuery }} />
        <IntegrationCards
          data={integrations.data}
          loading={integrations.isLoading}
          error={integrations.isError ? errorMessage(integrations.error, "Les intégrations n’ont pas pu être lues.") : null}
          onRetry={integrations.refetch}
          nowMs={nowMs}
        />
      </div>
    </>
  );
}
