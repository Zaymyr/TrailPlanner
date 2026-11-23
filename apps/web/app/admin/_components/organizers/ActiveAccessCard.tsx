"use client";

import { useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { OrganizerAdminData } from "./useOrganizerAdminData";

/** « Accès actifs »: revoke an organizer access (PATCH `/api/admin/organizer-claims` `revoke`) without touching the public race. */
export function ActiveAccessCard({ data }: { data: OrganizerAdminData }) {
  const { memberships, status, runAction } = data;
  const [revokeReasonByMembership, setRevokeReasonByMembership] = useState<Record<string, string>>({});

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Acces actifs</CardTitle>
        <CardDescription>Revoquer un acces organisateur sans supprimer la course publique.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun acces actif.</p>
        ) : (
          memberships.map((membership) => (
            <div key={membership.id} className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{membership.race_events?.name ?? membership.event_id}</p>
                  <p className="break-all text-sm text-muted-foreground">
                    {membership.user?.label ?? membership.user_id} · role {membership.role}
                  </p>
                </div>
                <span className="self-start rounded-full border border-emerald-300 px-2 py-1 text-xs text-emerald-700">actif</span>
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
                    Revoquer
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
