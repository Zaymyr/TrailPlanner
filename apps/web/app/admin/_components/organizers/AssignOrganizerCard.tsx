"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Label } from "../../../../components/ui/label";
import { AssignmentAutocomplete } from "./AssignmentAutocomplete";
import {
  normalizeSearchValue,
  type AssignmentAutocompleteOption,
  type AssignmentUserOption,
  type RaceEventOption,
} from "./organizer-admin-model";
import type { OrganizerAdminData } from "./useOrganizerAdminData";

type Assignment = { email: string; eventId: string; eventName: string };

/**
 * « Associer un organisateur »: give an e-mail the right to edit an event (PATCH
 * `/api/admin/organizer-claims` `assign`), with account autocomplete (`?emailSearch=`) and, when the
 * account does not exist, the « Compte Supabase introuvable » confirmation that creates and invites it.
 */
export function AssignOrganizerCard({ accessToken, data }: { accessToken: string | null; data: OrganizerAdminData }) {
  const { events, status, setStatus, setError, load } = data;
  const [assignmentEmail, setAssignmentEmail] = useState("");
  const [assignmentUsers, setAssignmentUsers] = useState<AssignmentUserOption[]>([]);
  const [assignmentUsersLoading, setAssignmentUsersLoading] = useState(false);
  const [assignmentUsersError, setAssignmentUsersError] = useState(false);
  const [assignmentEventId, setAssignmentEventId] = useState("");
  const [assignmentEventSearch, setAssignmentEventSearch] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [missingAccountAssignment, setMissingAccountAssignment] = useState<Assignment | null>(null);

  // Same default as before: the first event of the list, once loaded.
  useEffect(() => {
    if (!events.length) return;
    setAssignmentEventId((current) => current || events[0]?.id || "");
    setAssignmentEventSearch((current) => current || events[0]?.name || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => {
    const query = assignmentEmail.trim();
    if (!accessToken || query.length < 2) {
      setAssignmentUsers([]);
      setAssignmentUsersLoading(false);
      setAssignmentUsersError(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAssignmentUsersLoading(true);
      setAssignmentUsersError(false);
      try {
        const response = await fetch(`/api/admin/organizer-claims?emailSearch=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as { users?: AssignmentUserOption[] } | null;
        if (!response.ok) throw new Error("Unable to autocomplete organizer accounts.");
        setAssignmentUsers(payload?.users ?? []);
      } catch (caught) {
        if (controller.signal.aborted) return;
        console.error("Unable to autocomplete organizer accounts", caught);
        setAssignmentUsers([]);
        setAssignmentUsersError(true);
      } finally {
        if (!controller.signal.aborted) setAssignmentUsersLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [accessToken, assignmentEmail]);

  const assignmentEmailOptions = useMemo<AssignmentAutocompleteOption[]>(
    () => assignmentUsers.map((user) => ({ id: user.id, label: user.email })),
    [assignmentUsers]
  );
  const assignmentEventOptions = useMemo<AssignmentAutocompleteOption[]>(() => {
    const normalizedQuery = normalizeSearchValue(assignmentEventSearch.trim());
    return events
      .filter((event: RaceEventOption) => {
        if (!normalizedQuery || event.id === assignmentEventId) return true;
        return normalizeSearchValue([event.name, event.location, event.race_date?.slice(0, 10)].filter(Boolean).join(" ")).includes(normalizedQuery);
      })
      .slice(0, 12)
      .map((event) => ({
        id: event.id,
        label: event.name,
        description: [event.location, event.race_date?.slice(0, 10)].filter(Boolean).join(" · "),
      }));
  }, [assignmentEventId, assignmentEventSearch, events]);

  const assignOrganizer = async (
    createAccount = false,
    assignment: Assignment = {
      email: assignmentEmail.trim(),
      eventId: assignmentEventId,
      eventName: events.find((event) => event.id === assignmentEventId)?.name ?? "cet événement",
    }
  ) => {
    if (!accessToken || !assignment.eventId || !assignment.email) return;
    setStatus("saving");
    setError(null);
    setAssignmentSuccess(null);
    try {
      const response = await fetch("/api/admin/organizer-claims", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "assign",
          eventId: assignment.eventId,
          email: assignment.email,
          createAccount,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
        event?: RaceEventOption;
        user?: { email?: string | null };
        accountCreated?: boolean;
      } | null;
      if (!response.ok) {
        if (response.status === 404 && payload?.code === "auth_account_not_found") {
          setMissingAccountAssignment(assignment);
          return;
        }
        setError(payload?.message ?? "Impossible d’attribuer l’accès organisateur.");
        return;
      }
      setAssignmentSuccess(
        payload?.accountCreated
          ? `Le compte ${payload?.user?.email ?? assignment.email} a été créé et invité. Il peut maintenant éditer ${payload?.event?.name ?? assignment.eventName}.`
          : `${payload?.user?.email ?? assignment.email} peut maintenant éditer ${payload?.event?.name ?? assignment.eventName}.`
      );
      setMissingAccountAssignment(null);
      setAssignmentEmail("");
      await load();
    } catch (caught) {
      console.error("Unable to assign organizer access", caught);
      setError("Impossible d’attribuer l’accès organisateur.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <>
      <Card className="relative z-10 rounded-lg">
        <CardHeader>
          <CardTitle>Associer un organisateur</CardTitle>
          <CardDescription>
            Donnez à une adresse e-mail le droit d’éditer un événement et tous ses formats, sans modifier leur publication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="organizer-assignment-email">Adresse e-mail du compte</Label>
              <AssignmentAutocomplete
                id="organizer-assignment-email"
                inputType="email"
                value={assignmentEmail}
                placeholder="organisateur@exemple.fr"
                options={assignmentEmailOptions}
                loading={assignmentUsersLoading}
                emptyMessage={
                  assignmentUsersError
                    ? "Recherche temporairement indisponible. Vous pouvez saisir l’adresse manuellement."
                    : assignmentEmail.trim().length < 2
                      ? "Saisissez au moins 2 caractères pour rechercher un compte."
                      : "Aucun compte existant trouvé. Cette adresse pourra être invitée."
                }
                onChange={setAssignmentEmail}
                onSelect={(option) => setAssignmentEmail(option.label)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="organizer-assignment-event">Course</Label>
              <AssignmentAutocomplete
                id="organizer-assignment-event"
                value={assignmentEventSearch}
                placeholder="Rechercher une course, un lieu ou une date"
                selectOnFocus
                options={assignmentEventOptions}
                emptyMessage={events.length === 0 ? "Aucune course disponible." : "Aucune course ne correspond à cette recherche."}
                onChange={(value) => {
                  setAssignmentEventSearch(value);
                  setAssignmentEventId("");
                }}
                onSelect={(option) => {
                  setAssignmentEventId(option.id);
                  setAssignmentEventSearch(option.label);
                }}
              />
            </div>
            <Button
              type="button"
              disabled={status === "saving" || !assignmentEventId || !assignmentEmail.trim()}
              onClick={() => void assignOrganizer()}
            >
              Associer
            </Button>
          </div>
          {assignmentSuccess ? (
            <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
              {assignmentSuccess}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(missingAccountAssignment)}
        onOpenChange={(open) => {
          if (!open && status !== "saving") setMissingAccountAssignment(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compte Supabase introuvable</DialogTitle>
            <DialogDescription>
              L’adresse {missingAccountAssignment?.email} n’existe pas dans Supabase. Voulez-vous créer ce compte,
              lui envoyer une invitation et l’associer à {missingAccountAssignment?.eventName} ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={status === "saving"}
              onClick={() => setMissingAccountAssignment(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={status === "saving" || !missingAccountAssignment}
              onClick={() => {
                if (missingAccountAssignment) void assignOrganizer(true, missingAccountAssignment);
              }}
            >
              {status === "saving" ? "Création…" : "Créer le compte et associer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
