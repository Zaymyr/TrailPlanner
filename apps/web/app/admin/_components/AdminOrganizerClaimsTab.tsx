"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

type OrganizerClaim = {
  id: string;
  created_at: string;
  user_id: string;
  event_id: string;
  organization_name: string;
  role_title: string;
  contact_email: string;
  official_site_url?: string | null;
  message?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: {
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

type OrganizerMembership = {
  id: string;
  created_at: string;
  user_id: string;
  event_id: string;
  role: string;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  race_events?: {
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

type Props = {
  accessToken: string | null;
};

export function AdminOrganizerClaimsTab({ accessToken }: Props) {
  const [claims, setClaims] = useState<OrganizerClaim[]>([]);
  const [memberships, setMemberships] = useState<OrganizerMembership[]>([]);
  const [notesByClaim, setNotesByClaim] = useState<Record<string, string>>({});
  const [revokeReasonByMembership, setRevokeReasonByMembership] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const claimStatusLabel: Record<OrganizerClaim["status"], string> = {
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Refusé",
  };

  const load = async () => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/admin/organizer-claims", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        claims?: OrganizerClaim[];
        memberships?: OrganizerMembership[];
        message?: string;
      } | null;
      if (!response.ok) {
        setError(data?.message ?? "Unable to load organizer claims.");
        return;
      }
      setClaims(data?.claims ?? []);
      setMemberships(data?.memberships ?? []);
    } catch (caught) {
      console.error("Unable to load organizer claims", caught);
      setError("Unable to load organizer claims.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    void load();
  }, [accessToken]);

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

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Demandes en cours</CardTitle>
          <CardDescription>Approuver ou refuser les demandes de claim en attente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "loading" ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}
          {claims.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
          ) : (
            claims.map((claim) => (
              <div key={claim.id} className="rounded-md border border-border bg-background p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{claim.race_events?.name ?? claim.event_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {claim.organization_name} · {claim.role_title} · {claim.contact_email}
                    </p>
                    {claim.official_site_url ? (
                      <a className="text-sm text-brand underline-offset-4 hover:underline" href={claim.official_site_url} target="_blank" rel="noreferrer">
                        {claim.official_site_url}
                      </a>
                    ) : null}
                    {claim.message ? <p className="mt-2 text-sm text-foreground">{claim.message}</p> : null}
                  </div>
                  <span className="rounded-full border border-border px-2 py-1 text-xs uppercase text-muted-foreground">
                    {claimStatusLabel[claim.status]}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={notesByClaim[claim.id] ?? ""}
                    onChange={(event) => setNotesByClaim((current) => ({ ...current, [claim.id]: event.target.value }))}
                    placeholder="Note de revue"
                  />
                  <Button
                    type="button"
                    disabled={status === "saving" || claim.status === "approved"}
                    onClick={() => runAction({ action: "approve", claimId: claim.id, reviewerNotes: notesByClaim[claim.id] ?? "" })}
                  >
                    Approuver
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={status === "saving" || claim.status === "rejected"}
                    onClick={() => runAction({ action: "reject", claimId: claim.id, reviewerNotes: notesByClaim[claim.id] ?? "" })}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Accès actifs</CardTitle>
          <CardDescription>Révoquer un accès organisateur sans supprimer la course publique.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun accès actif.</p>
          ) : (
            memberships.map((membership) => (
              <div key={membership.id} className="rounded-md border border-border bg-background p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{membership.race_events?.name ?? membership.event_id}</p>
                    <p className="text-sm text-muted-foreground">
                      Utilisateur {membership.user_id} · rôle {membership.role}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-300 px-2 py-1 text-xs text-emerald-700">
                    actif
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor={`revoke-${membership.id}`}>Raison</Label>
                    <Input
                      id={`revoke-${membership.id}`}
                      value={revokeReasonByMembership[membership.id] ?? ""}
                      onChange={(event) =>
                        setRevokeReasonByMembership((current) => ({
                          ...current,
                          [membership.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={status === "saving"}
                      onClick={() =>
                        runAction({
                          action: "revoke",
                          membershipId: membership.id,
                          revokeReason: revokeReasonByMembership[membership.id] ?? "",
                        })
                      }
                    >
                      Révoquer
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
