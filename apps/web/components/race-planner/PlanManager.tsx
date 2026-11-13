"use client";

import { useMemo, useState } from "react";
import type { RacePlannerTranslations } from "../../locales/types";
import type { Race, SavedPlan } from "../../app/(planner)/race-planner/types";
import { ChevronDownIcon, ChevronUpIcon } from "./TimelineIcons";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";

export type PlanManagerProps = {
  copy: RacePlannerTranslations["account"];
  planStatus: "idle" | "saving";
  accountMessage: string | null;
  accountError: string | null;
  savedPlans: SavedPlan[];
  races: Race[];
  userId?: string | null;
  deletingPlanId: string | null;
  sessionEmail?: string;
  showPlanLimitUpsell: boolean;
  premiumCopy: RacePlannerTranslations["account"]["premium"];
  onRefreshPlans: () => void;
  onLoadPlan: (plan: SavedPlan) => void;
  onRenamePlan: (plan: SavedPlan, name: string) => Promise<boolean>;
  onDeletePlan: (planId: string) => void;
  onNewPlanGlobal?: () => void;
  onEditRace?: (raceId: string) => void;
  onDeleteRace?: (raceId: string) => void;
};

type RaceGroup = { raceId: string | null; raceName: string; isAdmin: boolean; isOwned: boolean; plans: SavedPlan[] };

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
  </svg>
);

export function PlanManager({ copy, planStatus, accountMessage, accountError, savedPlans, races, userId,
  deletingPlanId, sessionEmail, showPlanLimitUpsell, premiumCopy, onRefreshPlans, onLoadPlan,
  onRenamePlan, onDeletePlan, onNewPlanGlobal, onEditRace, onDeleteRace }: PlanManagerProps) {
  const isSaving = planStatus === "saving";
  const successMessage = accountMessage && accountMessage !== copy.messages.signedIn ? accountMessage : null;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [openMenuPlanId, setOpenMenuPlanId] = useState<string | null>(null);
  const [renamePlanId, setRenamePlanId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState<string | null>(null);
  const [confirmDeleteRaceId, setConfirmDeleteRaceId] = useState<string | null>(null);

  const groups = useMemo<RaceGroup[]>(() => {
    const plansByRace = savedPlans.reduce<Record<string, SavedPlan[]>>((acc, plan) => {
      (acc[plan.catalogRaceId ?? "__orphan__"] ??= []).push(plan);
      return acc;
    }, {});
    const result: RaceGroup[] = [];
    for (const race of races) {
      const plans = plansByRace[race.id] ?? [];
      if (plans.length) result.push({ raceId: race.id, raceName: race.name, isAdmin: race.isPublic && race.createdBy == null,
        isOwned: !race.isPublic && race.createdBy === userId, plans });
      delete plansByRace[race.id];
    }
    for (const [raceId, plans] of Object.entries(plansByRace)) {
      if (raceId !== "__orphan__") result.push({ raceId, raceName: plans[0]?.raceName ?? copy.plans.unknownRace, isAdmin: false, isOwned: false, plans });
    }
    result.sort((a, b) => Number(b.isOwned) - Number(a.isOwned) || a.raceName.localeCompare(b.raceName));
    const orphans = plansByRace.__orphan__ ?? [];
    if (orphans.length) result.push({ raceId: null, raceName: copy.plans.noRace, isAdmin: false, isOwned: false, plans: orphans });
    return result;
  }, [copy.plans.noRace, copy.plans.unknownRace, races, savedPlans, userId]);

  const toggleGroup = (key: string) => setCollapsedGroups((previous) => {
    const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  if (!sessionEmail) return <p className="text-sm text-muted-foreground">{copy.auth.headerHint}</p>;

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="space-y-4 p-0">
        <div className="flex justify-end"><Button variant="ghost" className="h-9 px-3 text-xs" onClick={onRefreshPlans}>{copy.plans.refresh}</Button></div>
        {groups.length === 0 ? <p className="text-sm text-muted-foreground">{copy.plans.empty}</p> : (
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {groups.map((group) => {
              const key = group.raceId ?? "__orphan__";
              const collapsed = collapsedGroups.has(key);
              return <div key={key} className="overflow-hidden rounded-lg border border-border">
                <button type="button" onClick={() => toggleGroup(key)} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40">
                  {collapsed ? <ChevronDownIcon className="h-4 w-4" aria-hidden /> : <ChevronUpIcon className="h-4 w-4" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{group.raceName}</span>
                  {group.isAdmin ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-label={copy.plans.freePreview}><LockIcon />{copy.plans.freePreview}</span> : null}
                </button>
                {!collapsed ? <div className="space-y-2 border-t border-border p-2">
                  {group.raceId === null ? <p className="px-1 text-xs text-amber-600">{copy.plans.orphanDescription}</p> : null}
                  {group.plans.map((plan) => {
                    const menuOpen = openMenuPlanId === plan.id;
                    const renaming = renamePlanId === plan.id;
                    return <div key={plan.id} className="relative rounded-md bg-muted/30">
                      <button type="button" className="flex min-h-14 w-full items-center px-3 py-2 pr-12 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onLoadPlan(plan)} disabled={deletingPlanId === plan.id}>
                        <span className="min-w-0"><span className="block truncate text-sm font-medium">{plan.name}</span>
                          <span className="block text-xs text-muted-foreground">{copy.plans.updatedAt.replace("{date}", new Date(plan.updatedAt).toLocaleDateString())}</span></span>
                      </button>
                      <button type="button" className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={copy.plans.actions.replace("{name}", plan.name)} aria-expanded={menuOpen}
                        onClick={() => { setOpenMenuPlanId(menuOpen ? null : plan.id); setConfirmDeletePlanId(null); }} disabled={deletingPlanId === plan.id || isSaving}><MoreIcon /></button>
                      {menuOpen ? <div className="border-t border-border p-2">
                        {renaming ? <form className="flex flex-wrap gap-2" onSubmit={async (event) => {
                          event.preventDefault(); if (await onRenamePlan(plan, renameValue)) { setRenamePlanId(null); setOpenMenuPlanId(null); }
                        }}>
                          <Input autoFocus className="h-10 min-w-0 flex-1" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} aria-label={copy.plans.renamePlaceholder} />
                          <Button type="submit" className="h-10 px-3 text-xs" disabled={!renameValue.trim() || isSaving}>{copy.plans.confirm}</Button>
                          <Button type="button" variant="ghost" className="h-10 px-3 text-xs" onClick={() => setRenamePlanId(null)}>{copy.plans.cancel}</Button>
                        </form> : confirmDeletePlanId === plan.id ? <div className="flex gap-2" role="group" aria-label={copy.plans.deleteConfirm.replace("{name}", plan.name)}>
                          <Button variant="ghost" className="h-10 text-xs text-red-600" onClick={() => { onDeletePlan(plan.id); setOpenMenuPlanId(null); }}>{copy.plans.confirm}</Button>
                          <Button variant="ghost" className="h-10 text-xs" onClick={() => setConfirmDeletePlanId(null)}>{copy.plans.cancel}</Button>
                        </div> : <div className="flex gap-2">
                          <Button variant="ghost" className="h-10 text-xs" onClick={() => { setRenamePlanId(plan.id); setRenameValue(plan.name); }}>{copy.plans.rename}</Button>
                          <Button variant="ghost" className="h-10 text-xs text-red-600" onClick={() => setConfirmDeletePlanId(plan.id)}>{copy.plans.delete}</Button>
                        </div>}
                      </div> : null}
                    </div>;
                  })}
                  {group.isOwned && group.raceId && (onEditRace || onDeleteRace) ? <div className="flex gap-2 border-t border-border pt-2">
                    {onEditRace ? <Button variant="ghost" className="h-10 flex-1 text-xs" onClick={() => onEditRace(group.raceId!)}>{copy.plans.editRace}</Button> : null}
                    {onDeleteRace ? confirmDeleteRaceId === group.raceId ? <>
                      <Button variant="ghost" className="h-10 text-xs text-red-600" onClick={() => { onDeleteRace(group.raceId!); setConfirmDeleteRaceId(null); }}>{copy.plans.confirm}</Button>
                      <Button variant="ghost" className="h-10 text-xs" onClick={() => setConfirmDeleteRaceId(null)}>{copy.plans.cancel}</Button>
                    </> : <Button variant="ghost" className="h-10 text-xs text-red-600" onClick={() => setConfirmDeleteRaceId(group.raceId)}>{copy.plans.deleteRace}</Button> : null}
                  </div> : null}
                </div> : null}
              </div>;
            })}
          </div>
        )}
        {onNewPlanGlobal ? <Button type="button" variant="outline" className="w-full text-xs" onClick={onNewPlanGlobal}>{copy.plans.newRace}</Button> : null}
        {showPlanLimitUpsell ? <p className="text-xs text-amber-600" role="status">{premiumCopy.planLimitReached}</p> : null}
        {successMessage ? <p className="text-xs text-emerald-600" role="status">{successMessage}</p> : null}
        {accountError ? <p className="text-xs text-red-600">{accountError}</p> : null}
      </CardContent>
    </Card>
  );
}
