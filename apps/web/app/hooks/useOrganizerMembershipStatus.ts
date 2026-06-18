"use client";

import { useEffect, useState } from "react";

type OrganizerMembershipStatus = {
  hasManagedRaces: boolean;
  isLoading: boolean;
};

let cachedStatus: { accessToken: string; hasManagedRaces: boolean } | null = null;
let inFlightStatus: { accessToken: string; promise: Promise<boolean> } | null = null;

const fetchOrganizerMembershipStatus = async (accessToken: string) => {
  if (cachedStatus?.accessToken === accessToken) {
    return cachedStatus.hasManagedRaces;
  }

  if (inFlightStatus?.accessToken === accessToken) {
    return inFlightStatus.promise;
  }

  const promise = fetch("/api/organizer/claims", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return false;
      const payload = (await response.json().catch(() => null)) as { memberships?: unknown[] } | null;
      return (payload?.memberships?.length ?? 0) > 0;
    })
    .catch((error) => {
      console.error("Unable to load organizer membership status", error);
      return false;
    })
    .then((hasManagedRaces) => {
      cachedStatus = { accessToken, hasManagedRaces };
      if (inFlightStatus?.accessToken === accessToken) {
        inFlightStatus = null;
      }
      return hasManagedRaces;
    });

  inFlightStatus = { accessToken, promise };
  return promise;
};

export function useOrganizerMembershipStatus(accessToken?: string | null): OrganizerMembershipStatus {
  const [status, setStatus] = useState<OrganizerMembershipStatus>({
    hasManagedRaces: false,
    isLoading: Boolean(accessToken),
  });

  useEffect(() => {
    let isMounted = true;

    if (!accessToken) {
      setStatus({ hasManagedRaces: false, isLoading: false });
      return () => {
        isMounted = false;
      };
    }

    setStatus((current) => ({ ...current, isLoading: true }));
    void fetchOrganizerMembershipStatus(accessToken).then((hasManagedRaces) => {
      if (!isMounted) return;
      setStatus({ hasManagedRaces, isLoading: false });
    });

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  return status;
}
