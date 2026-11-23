"use client";

import { useEffect, useState } from "react";

import type {
  FeatureCatalogItem,
  OrganizerClaim,
  OrganizerEditionRequest,
  OrganizerMembership,
  OrganizerPublicationRequest,
  RaceEventOption,
  RacebookPublicationEvent,
} from "./organizer-admin-model";

export type OrganizerAdminStatus = "idle" | "loading" | "saving" | "previewing";

/**
 * Data of Organisateurs (moved out of `AdminOrganizerClaimsTab`, lot 5, same requests): claims,
 * new-edition requests, memberships and events (`/api/admin/organizer-claims`), publication requests
 * and editions with their rights (`/api/admin/event-publication-requests`), the giftable module catalog
 * (`/api/admin/organizer-feature-catalog`), and the review actions on them. Review notes are kept here
 * so the list and the edition drawer share the same drafts.
 */
export function useOrganizerAdminData(accessToken: string | null) {
  const [claims, setClaims] = useState<OrganizerClaim[]>([]);
  const [editionRequests, setEditionRequests] = useState<OrganizerEditionRequest[]>([]);
  const [publicationRequests, setPublicationRequests] = useState<OrganizerPublicationRequest[]>([]);
  const [memberships, setMemberships] = useState<OrganizerMembership[]>([]);
  const [events, setEvents] = useState<RaceEventOption[]>([]);
  const [publicationEvents, setPublicationEvents] = useState<RacebookPublicationEvent[]>([]);
  const [featureCatalog, setFeatureCatalog] = useState<FeatureCatalogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notesByClaim, setNotesByClaim] = useState<Record<string, string>>({});
  const [notesByEditionRequest, setNotesByEditionRequest] = useState<Record<string, string>>({});
  const [notesByPublicationRequest, setNotesByPublicationRequest] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<OrganizerAdminStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const [response, publicationResponse, catalogResponse] = await Promise.all([
        fetch("/api/admin/organizer-claims", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }),
        fetch("/api/admin/event-publication-requests", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }),
        fetch("/api/admin/organizer-feature-catalog", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }),
      ]);
      const data = (await response.json().catch(() => null)) as {
        claims?: OrganizerClaim[];
        editionRequests?: OrganizerEditionRequest[];
        memberships?: OrganizerMembership[];
        events?: RaceEventOption[];
        message?: string;
      } | null;
      const publicationData = (await publicationResponse.json().catch(() => null)) as {
        publicationRequests?: OrganizerPublicationRequest[];
        events?: RacebookPublicationEvent[];
        message?: string;
      } | null;
      const catalogData = await catalogResponse.json().catch(() => null) as { features?: FeatureCatalogItem[]; message?: string } | null;
      if (!response.ok || !publicationResponse.ok || !catalogResponse.ok) {
        setError(data?.message ?? publicationData?.message ?? "Unable to load organizer requests.");
        return;
      }
      setClaims(data?.claims ?? []);
      setEditionRequests(data?.editionRequests ?? []);
      setMemberships(data?.memberships ?? []);
      setEvents(data?.events ?? []);
      setPublicationRequests(publicationData?.publicationRequests ?? []);
      setPublicationEvents(publicationData?.events ?? []);
      setFeatureCatalog(catalogData?.features ?? []);
      setLoaded(true);
    } catch (caught) {
      console.error("Unable to load organizer claims", caught);
      setError("Unable to load organizer claims.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const saveFeatureAvailability = async (feature: FeatureCatalogItem) => {
    if (!accessToken) return;
    setFeatureCatalog((current) => current.map((item) => item.feature_key === feature.feature_key ? feature : item));
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/admin/organizer-feature-catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ featureKey: feature.feature_key, isActive: feature.is_active }),
      });
      if (!response.ok) setError((await response.json().catch(() => null) as { message?: string } | null)?.message ?? "Impossible de modifier cette fonctionnalité.");
    } finally { setStatus("idle"); }
  };

  /** PATCH `/api/admin/organizer-claims` (approve / reject a claim or a new edition, revoke an access). */
  const runAction = async (payload: Record<string, unknown>) => {
    if (!accessToken) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/admin/organizer-claims", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Unable to update organizer claim.");
        return;
      }
      await load();
    } catch (caught) {
      console.error("Unable to update organizer claim", caught);
      setError("Unable to update organizer claim.");
    } finally {
      setStatus("idle");
    }
  };

  const reviewPublication = async (requestId: string, reviewStatus: "approved" | "rejected") => {
    if (!accessToken) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/admin/event-publication-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          requestId,
          status: reviewStatus,
          reviewerNotes: notesByPublicationRequest[requestId] ?? "",
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Unable to review publication request.");
        return;
      }
      await load();
    } finally {
      setStatus("idle");
    }
  };

  return {
    claims,
    editionRequests,
    publicationRequests,
    memberships,
    events,
    publicationEvents,
    featureCatalog,
    loaded,
    status,
    setStatus,
    error,
    setError,
    load,
    runAction,
    reviewPublication,
    saveFeatureAvailability,
    notes: {
      claims: notesByClaim,
      editionRequests: notesByEditionRequest,
      publicationRequests: notesByPublicationRequest,
      setClaim: (id: string, value: string) => setNotesByClaim((current) => ({ ...current, [id]: value })),
      setEditionRequest: (id: string, value: string) => setNotesByEditionRequest((current) => ({ ...current, [id]: value })),
      setPublicationRequest: (id: string, value: string) => setNotesByPublicationRequest((current) => ({ ...current, [id]: value })),
    },
  };
}

export type OrganizerAdminData = ReturnType<typeof useOrganizerAdminData>;
