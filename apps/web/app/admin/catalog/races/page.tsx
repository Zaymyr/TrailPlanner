"use client";

import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { TabsList } from "../../../../components/ui/tabs";
import { readRaceParam } from "../../admin-tabs";
import { useI18n } from "../../../i18n-provider";
import AdminRaceCatalogSection from "../../components/AdminRaceCatalogSection";
import { adminFetch, raceDataGapsResponseSchema } from "../../publications/publications-api";
import { isReelReachable, RaceDataGapsCard } from "../../publications/RaceDataGapsCard";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";
import { AdminPageHeader } from "../../_components/shell/AdminPageHeader";
import { withCount } from "../../_components/useInboxCounts";

type RacesView = "catalogue" | "qualite";

function RacesContent() {
  const accessToken = useAdminAccessToken();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const view: RacesView = params?.get("vue") === "qualite" ? "qualite" : "catalogue";
  const raceId = readRaceParam(params?.toString() ?? "");

  // Read once per visit: the catalog changes slowly (same key as the former « GPX à traiter » tab).
  const gapsQuery = useQuery({
    queryKey: ["admin", "race-data-gaps", accessToken],
    staleTime: 5 * 60_000,
    queryFn: () => adminFetch(accessToken, "/api/admin/race-data-gaps", raceDataGapsResponseSchema, {}, "La liste des données manquantes n’a pas pu être lue."),
  });
  const reachable = gapsQuery.data ? gapsQuery.data.gaps.filter(isReelReachable).length : undefined;

  return (
    <>
      <TabsList
        tabs={[
          { id: "catalogue", label: "Catalogue" },
          { id: "qualite", label: withCount("Qualité des données", reachable) },
        ]}
        activeTab={view}
        onTabChange={(next) => router.replace((next === "qualite" ? "/admin/catalog/races?vue=qualite" : "/admin/catalog/races") as Route, { scroll: false })}
      />
      <div className="mt-4">
        {view === "qualite" ? (
          <RaceDataGapsCard
            gaps={gapsQuery.data?.gaps ?? []}
            leadDays={gapsQuery.data?.leadDays ?? null}
            isLoading={gapsQuery.isLoading}
            error={gapsQuery.error instanceof Error ? gapsQuery.error.message : null}
          />
        ) : (
          <AdminRaceCatalogSection accessToken={accessToken} t={t.admin.raceCatalog} initialRaceId={raceId} />
        )}
      </div>
    </>
  );
}

/** Courses & événements: the catalog (`?course=<id>` opens the editor) and « Qualité des données » (`?vue=qualite`, former « GPX à traiter »). */
export default function AdminCatalogRacesPage() {
  return (
    <>
      <AdminPageHeader title="Courses & événements" description="Catalogue des courses, GPX, ravitaillements, images ; données manquantes à compléter." />
      <Suspense fallback={null}>
        <RacesContent />
      </Suspense>
    </>
  );
}
