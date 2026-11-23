"use client";

import { useEffect, useState } from "react";

import { TabsList } from "../../../components/ui/tabs";
import { readOrganizerView, replaceLocationSearch, searchForView } from "../admin-tabs";
import { useInboxCounts, withCount } from "./useInboxCounts";
import { ActiveAccessCard } from "./organizers/ActiveAccessCard";
import { AssignOrganizerCard } from "./organizers/AssignOrganizerCard";
import { EditionDrawer } from "./organizers/EditionDrawer";
import { EditionRightsCard } from "./organizers/EditionRightsCard";
import { FeatureCatalogCard } from "./organizers/FeatureCatalogCard";
import { readEditionDrawer, writeEditionDrawer, type EditionDrawerTab } from "./organizers/organizer-admin-model";
import { PendingRequestsCard } from "./organizers/PendingRequestsCard";
import { useOrganizerAdminData } from "./organizers/useOrganizerAdminData";

type Props = {
  accessToken: string | null;
};

/**
 * Organisateurs (`/admin/organizers`): sub-views « Publier le livret » (catalog of giftable modules,
 * pending publication and new-edition requests, rights per edition) and « Accès » (`?vue=acces`: claims,
 * associate an organizer, active accesses). Since lot 5 each domain is a component of `organizers/`
 * and an edition opens its drawer (`?edition=<id>&fiche=`); `?edition=` (links from Ventes & facturation
 * and /organizer, lot 4) also narrows the list to that edition until the filter is cleared.
 */
export function AdminOrganizerClaimsTab({ accessToken }: Props) {
  const [organizerAdminTab, setOrganizerAdminTabState] = useState<"publication" | "access">(() =>
    readOrganizerView(typeof window === "undefined" ? "" : window.location.search) === "acces" ? "access" : "publication"
  );
  const setOrganizerAdminTab = (tab: "publication" | "access") => {
    setOrganizerAdminTabState(tab);
    replaceLocationSearch(searchForView(window.location.search, tab === "access" ? "acces" : "publication", "publication"));
  };
  const inboxCounts = useInboxCounts(accessToken);
  const data = useOrganizerAdminData(accessToken);

  // `?edition=<id>` narrows the list to one edition and opens its drawer (`?fiche=` = tab).
  const [editionFilter, setEditionFilter] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ editionId: string | null; tab: EditionDrawerTab }>({ editionId: null, tab: "resume" });
  useEffect(() => {
    const initial = readEditionDrawer(window.location.search);
    setEditionFilter(new URLSearchParams(window.location.search).get("edition") ? initial.editionId : null);
    setDrawer(initial);
  }, []);
  const openDrawer = (editionId: string | null, tab: EditionDrawerTab = "resume") => {
    setDrawer({ editionId, tab });
    replaceLocationSearch(writeEditionDrawer(window.location.search, editionId, tab));
  };

  return (
    <div className="space-y-5">
      <TabsList
        tabs={[
          { id: "publication", label: withCount("Publier le Livret coureur", inboxCounts.data ? inboxCounts.data.publicationRequests + inboxCounts.data.editionRequests : undefined) },
          { id: "access", label: withCount("Accès organisateurs", inboxCounts.data?.organizerClaims) },
        ]}
        activeTab={organizerAdminTab}
        onTabChange={(tab) => setOrganizerAdminTab(tab as typeof organizerAdminTab)}
      />

      {data.error && !drawer.editionId ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{data.error}</p> : null}

      {organizerAdminTab === "publication" ? <FeatureCatalogCard data={data} /> : null}

      <PendingRequestsCard view={organizerAdminTab} data={data} />

      {organizerAdminTab === "publication" ? (
        <EditionRightsCard
          data={data}
          editionFilter={editionFilter}
          openEditionId={drawer.editionId}
          onClearFilter={() => setEditionFilter(null)}
          onOpen={(editionId, tab) => openDrawer(editionId, tab)}
        />
      ) : null}

      {organizerAdminTab === "access" ? <AssignOrganizerCard accessToken={accessToken} data={data} /> : null}

      {organizerAdminTab === "access" ? <ActiveAccessCard data={data} /> : null}

      <EditionDrawer
        accessToken={accessToken}
        editionId={drawer.editionId}
        tab={drawer.tab}
        data={data}
        onTabChange={(tab) => openDrawer(drawer.editionId, tab)}
        onClose={() => openDrawer(null)}
      />
    </div>
  );
}
