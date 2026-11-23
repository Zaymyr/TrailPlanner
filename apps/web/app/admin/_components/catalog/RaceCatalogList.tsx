"use client";

import Image from "next/image";

import { ChevronDownIcon, ChevronUpIcon } from "../../../../components/race-planner/TimelineIcons";
import { Button } from "../../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import type { AdminTranslations } from "../../../../locales/types";
import { basePillClass, type RaceEventRow, type RaceGroup, type RaceRow } from "./race-catalog-model";

type CatalogT = AdminTranslations["raceCatalog"];

function RaceCatalogRow({ race, t, liveTogglePending, deleting, onEdit, onToggleLive, onDelete }: {
  race: RaceRow;
  t: CatalogT;
  liveTogglePending: boolean;
  deleting: boolean;
  onEdit: (race: RaceRow) => void;
  onToggleLive: (race: RaceRow) => void;
  onDelete: (raceId: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="align-middle font-semibold text-slate-900 dark:text-slate-50">
        <div className="flex items-center gap-2">
          {race.thumbnail_url ? (
            <Image
              src={race.thumbnail_url}
              alt={race.name}
              width={32}
              height={32}
              className="h-8 w-8 rounded object-cover"
              unoptimized
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate">{race.name}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="align-middle text-slate-700 dark:text-slate-200">
        {race.location_text ?? race.location ?? "-"}
      </TableCell>
      <TableCell className="hidden text-slate-700 dark:text-slate-200">
        {race.race_events?.location ?? race.location_text ?? race.location ?? "-"}
      </TableCell>
      <TableCell className="align-middle text-slate-700 dark:text-slate-200">
        <div className="space-y-1">
          <p>{race.distance_km.toFixed(1)} km</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">D+ {race.elevation_gain_m === null ? "—" : `${Math.round(race.elevation_gain_m)} m`}</p>
        </div>
      </TableCell>
      <TableCell className="hidden text-slate-700 dark:text-slate-200">{race.elevation_gain_m === null ? "—" : `${Math.round(race.elevation_gain_m)} m`}</TableCell>
      <TableCell className="align-middle">
        {race.is_live ? (
          <span
            className={`${basePillClass} bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200`}
          >
            {t.status.live}
          </span>
        ) : (
          <span className={`${basePillClass} bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200`}>
            {t.status.draft}
          </span>
        )}
      </TableCell>
      <TableCell className="align-middle">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => onEdit(race)}>
            {t.actions.edit}
          </Button>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            disabled={liveTogglePending}
            onClick={() => onToggleLive(race)}
          >
            {race.is_live ? t.actions.setDraft : t.actions.setLive}
          </Button>
          <Button
            variant="ghost"
            className="h-8 px-3 text-xs text-red-600 hover:text-red-600"
            disabled={deleting}
            onClick={() => onDelete(race.id)}
          >
            {t.actions.delete}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Catalog list grouped by event (collapsible, « Modifier l’événement » on the group header), each
 * race with Modifier / En ligne–Brouillon / Supprimer. Presentational: the parent owns the data and
 * the mutations.
 */
export function RaceCatalogList({ groups, t, collapsedGroups, liveTogglePending, deletingId, onToggleGroup, onEditEvent, onEdit, onToggleLive, onDelete }: {
  groups: RaceGroup[];
  t: CatalogT;
  collapsedGroups: Record<string, boolean>;
  liveTogglePending: boolean;
  deletingId: string | null;
  onToggleGroup: (key: string) => void;
  onEditEvent: (event: RaceEventRow) => void;
  onEdit: (race: RaceRow) => void;
  onToggleLive: (race: RaceRow) => void;
  onDelete: (raceId: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isCollapsed = Boolean(collapsedGroups[group.key]);
        return (
          <div key={group.key} className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-4 py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-expanded={!isCollapsed}
                onClick={() => onToggleGroup(group.key)}
              >
                {group.thumbnailUrl ? (
                  <Image
                    src={group.thumbnailUrl}
                    alt={group.title}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded object-cover"
                    unoptimized
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{group.title}</p>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {t.groupRaceCount.replace("{count}", String(group.races.length))}
                    </span>
                  </div>
                  {group.meta ? (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{group.meta}</p>
                  ) : null}
                </div>
                {isCollapsed ? (
                  <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                ) : (
                  <ChevronUpIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                )}
              </button>

              {group.event ? (
                <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => onEditEvent(group.event!)}>
                  {t.actions.editEvent}
                </Button>
              ) : null}
            </div>

            {!isCollapsed ? (
              <Table className="table-fixed" containerClassName="overflow-x-hidden rounded-none border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[33%] text-slate-600 dark:text-slate-300">{t.table.name}</TableHead>
                    <TableHead className="w-[22%] text-slate-600 dark:text-slate-300">{t.table.location}</TableHead>
                    <TableHead className="hidden">{t.table.event}</TableHead>
                    <TableHead className="w-[13%] text-slate-600 dark:text-slate-300">{t.table.distance}</TableHead>
                    <TableHead className="hidden">{t.table.elevation}</TableHead>
                    <TableHead className="w-[10%] text-slate-600 dark:text-slate-300">{t.table.status}</TableHead>
                    <TableHead className="w-[22%] text-right text-slate-600 dark:text-slate-300">{t.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.races.map((race) => (
                    <RaceCatalogRow
                      key={race.id}
                      race={race}
                      t={t}
                      liveTogglePending={liveTogglePending}
                      deleting={deletingId === race.id}
                      onEdit={onEdit}
                      onToggleLive={onToggleLive}
                      onDelete={onDelete}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
