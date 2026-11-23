"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import type { AdminTranslations } from "../../../locales/types";
import { AddRaceDialog } from "../_components/catalog/AddRaceDialog";
import { EditEventDialog } from "../_components/catalog/EditEventDialog";
import { EditRaceDialog } from "../_components/catalog/EditRaceDialog";
import { RaceCatalogList } from "../_components/catalog/RaceCatalogList";
import {
  filterRacesByName,
  groupRacesByEvent,
  raceEventSchema,
  racePatchBody,
  raceRowSchema,
  type RaceEventRow,
  type RaceRow,
} from "../_components/catalog/race-catalog-model";
import {
  TraceDeTrailCredentialsDialog,
  TraceDeTrailImportDialog,
  useTraceDeTrailCredentials,
} from "../_components/catalog/TraceDeTrailImportDialog";
import { UtmbImportDialog } from "../_components/catalog/UtmbImportDialog";

type Props = {
  /** `?course=<raceId>`: opens that race's « Modifier » dialog once the catalog is loaded and filters the list on it. */
  initialRaceId?: string | null;
  accessToken?: string;
  t: AdminTranslations["raceCatalog"];
};

/**
 * Catalogue › Courses & événements: the catalog grouped by event and its dialogs (manual creation,
 * UTMB and Trace de Trail imports, race and event edits). Since lot 5 the dialogs and the list are
 * components of `app/admin/_components/catalog/` (same requests, same messages); this section keeps
 * the catalog query, the list-level actions (online / draft, delete), the search and `?course=`.
 */
export default function AdminRaceCatalogSection({ accessToken, t, initialRaceId }: Props) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addUtmbOpen, setAddUtmbOpen] = useState(false);
  const [addTraceDeTrailOpen, setAddTraceDeTrailOpen] = useState(false);
  const [editRace, setEditRace] = useState<RaceRow | null>(null);
  const [editEvent, setEditEvent] = useState<RaceEventRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsedRaceGroups, setCollapsedRaceGroups] = useState<Record<string, boolean>>({});
  const traceDeTrailCredentials = useTraceDeTrailCredentials();

  const invalidateCatalog = () => queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });

  const racesQuery = useQuery({
    queryKey: ["admin", "race-catalog", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const response = await fetch("/api/admin/race-catalog", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.loadError);
      }
      const parsed = z.object({ races: z.array(raceRowSchema), events: z.array(raceEventSchema) }).safeParse(data);
      if (!parsed.success) throw new Error(t.loadError);
      return parsed.data;
    },
  });

  /** « En ligne » / « Brouillon » of a row (PATCH `/api/race-catalog/[id]` `is_live`). */
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; is_live: boolean }) => {
      const { id, ...fields } = payload;
      const response = await fetch(`/api/race-catalog/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(racePatchBody(fields)),
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.errors.updateFailed);
      }
    },
    onSuccess: () => {
      setMessage(t.messages.updated);
      setError(null);
      setEditRace(null);
      void invalidateCatalog();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t.errors.updateFailed);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/race-catalog/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.errors.deleteFailed);
      }
    },
    onSuccess: () => {
      setMessage(t.messages.deleted);
      setError(null);
      setDeletingId(null);
      void invalidateCatalog();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t.errors.deleteFailed);
      setMessage(null);
      setDeletingId(null);
    },
  });

  const handleOpenEdit = (race: RaceRow) => {
    setEditRace(race);
    setMessage(null);
    setError(null);
  };

  const [openedInitialRaceId, setOpenedInitialRaceId] = useState<string | null>(null);
  useEffect(() => {
    if (!initialRaceId || openedInitialRaceId === initialRaceId || !racesQuery.data) return;
    setOpenedInitialRaceId(initialRaceId);
    const race = racesQuery.data.races.find((row) => row.id === initialRaceId);
    if (!race) return;
    setSearch(race.name);
    handleOpenEdit(race);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRaceId, openedInitialRaceId, racesQuery.data]);

  const handleOpenEditEvent = (event: RaceEventRow) => {
    setEditEvent(event);
    setMessage(null);
    setError(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t.errors.confirmDelete)) return;
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  /** Dialog feedback goes to the section (shown above the list, as before). */
  const showDialogError = (nextError: string | null, clearMessage = false) => {
    setError(nextError);
    if (clearMessage) setMessage(null);
  };
  const afterDialogSave = (nextMessage: string, close: () => void) => {
    setMessage(nextMessage);
    setError(null);
    close();
    void invalidateCatalog();
  };

  const raceRows = useMemo(() => racesQuery.data?.races ?? [], [racesQuery.data]);
  const eventRows = useMemo(() => racesQuery.data?.events ?? [], [racesQuery.data]);
  const groupedRaces = useMemo(
    () => groupRacesByEvent(filterRacesByName(raceRows, search), eventRows, t.noEventGroupTitle),
    [eventRows, raceRows, search, t.noEventGroupTitle],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.title}</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-9 px-4 text-sm"
              onClick={() => {
                setAddTraceDeTrailOpen(true);
                setMessage(null);
                setError(null);
              }}
            >
              {t.actions.addTraceDeTrail}
            </Button>
            <Button
              variant="outline"
              className="h-9 px-4 text-sm"
              onClick={() => {
                setAddUtmbOpen(true);
                setMessage(null);
                setError(null);
              }}
            >
              {t.actions.addUtmb}
            </Button>
            <Button
              className="h-9 px-4 text-sm"
              onClick={() => {
                setAddOpen(true);
                setMessage(null);
                setError(null);
              }}
            >
              {t.actions.add}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <p className="text-sm text-emerald-700 dark:text-emerald-200">{message}</p> : null}
        {error || racesQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-300">
            {error ?? (racesQuery.error instanceof Error ? racesQuery.error.message : t.loadError)}
          </p>
        ) : null}

        {racesQuery.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
        ) : null}

        {!racesQuery.isLoading && raceRows.length > 0 ? (
          <Input
            className="h-9 max-w-xs text-sm"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        ) : null}

        {!racesQuery.isLoading && raceRows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
        ) : null}

        <RaceCatalogList
          groups={groupedRaces}
          t={t}
          collapsedGroups={collapsedRaceGroups}
          liveTogglePending={updateMutation.isPending}
          deletingId={deleteMutation.isPending ? deletingId : null}
          onToggleGroup={(key) => setCollapsedRaceGroups((current) => ({ ...current, [key]: !current[key] }))}
          onEditEvent={handleOpenEditEvent}
          onEdit={handleOpenEdit}
          onToggleLive={(race) => updateMutation.mutate({ id: race.id, is_live: !race.is_live })}
          onDelete={handleDelete}
        />
      </CardContent>

      <TraceDeTrailImportDialog
        accessToken={accessToken}
        t={t}
        open={addTraceDeTrailOpen}
        credentials={traceDeTrailCredentials}
        onOpenChange={setAddTraceDeTrailOpen}
        onImported={() => afterDialogSave(t.messages.imported, () => setAddTraceDeTrailOpen(false))}
      />

      <TraceDeTrailCredentialsDialog t={t} credentials={traceDeTrailCredentials} />

      <UtmbImportDialog
        accessToken={accessToken}
        t={t}
        open={addUtmbOpen}
        onOpenChange={setAddUtmbOpen}
        onImported={() => afterDialogSave(t.messages.imported, () => setAddUtmbOpen(false))}
      />

      <AddRaceDialog
        accessToken={accessToken}
        t={t}
        open={addOpen}
        eventRows={eventRows}
        onOpenChange={setAddOpen}
        onError={(nextError) => showDialogError(nextError)}
        onCreated={() => afterDialogSave(t.messages.created, () => setAddOpen(false))}
      />

      <EditRaceDialog
        accessToken={accessToken}
        t={t}
        race={editRace}
        eventRows={eventRows}
        credentials={traceDeTrailCredentials}
        onClose={() => setEditRace(null)}
        onMessage={setMessage}
        onError={showDialogError}
        onSaved={(nextMessage) => afterDialogSave(nextMessage, () => setEditRace(null))}
      />

      <EditEventDialog
        accessToken={accessToken}
        t={t}
        event={editEvent}
        onClose={() => setEditEvent(null)}
        onMessage={setMessage}
        onError={showDialogError}
        onSaved={(nextMessage) => afterDialogSave(nextMessage, () => setEditEvent(null))}
      />
    </Card>
  );
}
