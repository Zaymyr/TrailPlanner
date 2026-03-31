"use client";

import type { RacePlannerTranslations } from "../../locales/types";
import { useMemo, useState } from "react";
import type { Race, SavedPlan } from "../../app/(coach)/race-planner/types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export type PlanManagerProps = {
  copy: RacePlannerTranslations["account"];
  planName: string;
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
  planOwnerSelector?: {
    label: string;
    helper?: string;
    options: { value: string; label: string }[];
    value: string;
    isLoading?: boolean;
    errorMessage?: string | null;
    onChange: (value: string) => void;
  };
  onPlanNameChange: (name: string) => void;
  onRefreshPlans: () => void;
  onLoadPlan: (plan: SavedPlan) => void;
  onDeletePlan: (planId: string) => void;
  onNewPlanForRace?: (raceId: string) => void;
  onNewPlanGlobal?: () => void;
  onEditRace?: (raceId: string) => void;
  onDeleteRace?: (raceId: string) => void;
};

type RaceGroup = {
  raceId: string | null;
  raceName: string;
  isAdmin: boolean;
  isOwned: boolean;
  plans: SavedPlan[];
};

export function PlanManager({
  copy,
  planName,
  planStatus,
  accountMessage,
  accountError,
  savedPlans,
  races,
  userId,
  deletingPlanId,
  sessionEmail,
  showPlanLimitUpsell,
  premiumCopy,
  planOwnerSelector,
  onPlanNameChange,
  onRefreshPlans,
  onLoadPlan,
  onDeletePlan,
  onNewPlanForRace,
  onNewPlanGlobal,
  onEditRace,
  onDeleteRace,
}: PlanManagerProps) {
  const isSaving = planStatus === "saving";
  const successMessage =
    accountMessage && accountMessage !== copy.messages.signedIn ? accountMessage : null;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [confirmDeleteRaceId, setConfirmDeleteRaceId] = useState<string | null>(null);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build race groups from savedPlans + races list
  const groups = useMemo<RaceGroup[]>(() => {
    const raceMap = new Map<string, Race>(races.map((r) => [r.id, r]));

    // Group plans by catalogRaceId
    const plansByRace = savedPlans.reduce(
      (acc, plan) => {
        const key = plan.catalogRaceId ?? "__orphan__";
        if (!acc[key]) acc[key] = [];
        acc[key].push(plan);
        return acc;
      },
      {} as Record<string, SavedPlan[]>
    );

    const result: RaceGroup[] = [];

    // Add groups only for races that have at least one plan
    for (const race of races) {
      const plans = plansByRace[race.id] ?? [];
      if (plans.length > 0) {
        result.push({
          raceId: race.id,
          raceName: race.name,
          isAdmin: race.isPublic && race.createdBy == null,
          isOwned: !race.isPublic && race.createdBy === userId,
          plans,
        });
      }
      delete plansByRace[race.id];
    }

    // Add plans that reference a race not in the races list (race deleted or not fetched)
    for (const [raceId, plans] of Object.entries(plansByRace)) {
      if (raceId === "__orphan__") continue;
      const raceName = plans[0]?.raceName ?? "Course inconnue";
      result.push({
        raceId,
        raceName,
        isAdmin: false,
        isOwned: false,
        plans,
      });
    }

    // Sort: owned races first, then public
    result.sort((a, b) => {
      if (a.isOwned && !b.isOwned) return -1;
      if (!a.isOwned && b.isOwned) return 1;
      return a.raceName.localeCompare(b.raceName);
    });

    // Orphan plans group
    const orphans = plansByRace["__orphan__"] ?? [];
    if (orphans.length > 0) {
      result.push({
        raceId: null,
        raceName: "Sans course",
        isAdmin: false,
        isOwned: false,
        plans: orphans,
      });
    }

    return result;
  }, [races, savedPlans, userId]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {sessionEmail ? (
          <div className="space-y-4">
            {/* Save section */}
            <div className="space-y-2">
              {planOwnerSelector ? (
                <div className="space-y-2">
                  <Label htmlFor="plan-owner">{planOwnerSelector.label}</Label>
                  <select
                    id="plan-owner"
                    value={planOwnerSelector.value}
                    onChange={(event) => planOwnerSelector.onChange(event.target.value)}
                    disabled={planOwnerSelector.isLoading}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {planOwnerSelector.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {planOwnerSelector.helper ? (
                    <p className="text-xs text-muted-foreground dark:text-slate-400">{planOwnerSelector.helper}</p>
                  ) : null}
                  {planOwnerSelector.errorMessage ? (
                    <p className="text-xs text-red-400">{planOwnerSelector.errorMessage}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="plan-name">{copy.plans.nameLabel}</Label>
              </div>
              <Input
                id="plan-name"
                value={planName}
                placeholder={copy.plans.defaultName}
                onChange={(event) => onPlanNameChange(event.target.value)}
              />
              {showPlanLimitUpsell ? (
                <p className="text-xs text-amber-200" role="status">
                  {premiumCopy.planLimitReached}
                </p>
              ) : null}
              {successMessage ? (
                <p className="text-xs text-emerald-300" role="status">
                  {successMessage}
                </p>
              ) : null}
            </div>

            {/* Tree view */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground dark:text-slate-100">{copy.plans.title}</p>
                <Button variant="ghost" className="h-9 px-3 text-xs sm:text-sm" onClick={onRefreshPlans}>
                  {copy.plans.refresh}
                </Button>
              </div>

              {groups.length === 0 && savedPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground dark:text-slate-400">{copy.plans.empty}</p>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {groups.map((group) => {
                    const key = group.raceId ?? "__orphan__";
                    const isCollapsed = collapsedGroups.has(key);
                    return (
                      <div key={key} className="rounded-lg border border-border dark:border-slate-800">
                        {/* Race header */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(key)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-muted/40"
                        >
                          <span className="text-base leading-none text-muted-foreground">
                            {isCollapsed ? "▶" : "▼"}
                          </span>
                          <span className="flex-1 truncate text-sm font-semibold text-foreground dark:text-slate-100">
                            📍 {group.raceName}
                          </span>
                          {group.raceId === null && (
                            <span className="text-xs text-amber-400">⚠️</span>
                          )}
                          {group.isAdmin && (
                            <span className="text-xs text-muted-foreground dark:text-slate-500" title="Course admin — lecture seule">
                              🔒
                            </span>
                          )}
                        </button>

                        {/* Expanded content */}
                        {!isCollapsed && (
                          <div className="border-t border-border px-3 py-2 dark:border-slate-800">
                            {group.raceId === null && (
                              <p className="mb-2 text-xs text-amber-400/80">
                                Ce plan n'est pas associé à une course.
                              </p>
                            )}

                            {/* Plans */}
                            <div className="space-y-2">
                              {group.plans.map((plan) => (
                                <div
                                  key={plan.id}
                                  className="rounded-md bg-muted/30 px-2 py-1.5 dark:bg-slate-900/40"
                                >
                                  <p className="break-words text-xs font-medium text-foreground dark:text-slate-50">
                                    🗓 {plan.name}
                                  </p>
                                  <p className="mb-1.5 text-[10px] text-muted-foreground dark:text-slate-500">
                                    {new Date(plan.updatedAt).toLocaleDateString()}
                                  </p>
                                  <div className="flex gap-1.5">
                                    <Button
                                      variant="outline"
                                      className="h-6 flex-1 px-2 text-[11px]"
                                      onClick={() => onLoadPlan(plan)}
                                      disabled={deletingPlanId === plan.id}
                                    >
                                      {copy.plans.load}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="h-6 flex-1 px-2 text-[11px] text-red-300 hover:text-red-200"
                                      onClick={() => onDeletePlan(plan.id)}
                                      disabled={deletingPlanId === plan.id || isSaving}
                                    >
                                      {deletingPlanId === plan.id ? copy.plans.saving : copy.plans.delete}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* + New plan for this race */}
                            {group.raceId !== null && onNewPlanForRace && (
                              <button
                                type="button"
                                onClick={() => onNewPlanForRace(group.raceId!)}
                                className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground dark:text-slate-500 dark:hover:text-slate-300"
                              >
                                + Nouveau plan
                              </button>
                            )}

                            {/* Edit / Delete race buttons (owned races only) */}
                            {group.isOwned && group.raceId && (
                              <div className="mt-2 flex gap-1.5 border-t border-border pt-2 dark:border-slate-800">
                                {onEditRace && (
                                  <button
                                    type="button"
                                    onClick={() => onEditRace(group.raceId!)}
                                    className="flex-1 rounded-md px-2 py-1 text-center text-[11px] text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                                  >
                                    ✏️ Modifier la course
                                  </button>
                                )}
                                {onDeleteRace && (
                                  <>
                                    {confirmDeleteRaceId === group.raceId ? (
                                      <div className="flex flex-1 gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onDeleteRace(group.raceId!);
                                            setConfirmDeleteRaceId(null);
                                          }}
                                          className="flex-1 rounded-md bg-red-900/40 px-2 py-1 text-center text-[11px] text-red-300 hover:bg-red-900/60"
                                        >
                                          Confirmer
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteRaceId(null)}
                                          className="flex-1 rounded-md px-2 py-1 text-center text-[11px] text-muted-foreground hover:bg-muted/50"
                                        >
                                          Annuler
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteRaceId(group.raceId)}
                                        className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted/50 hover:text-red-400"
                                      >
                                        🗑
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Global new plan button */}
              {onNewPlanGlobal && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={onNewPlanGlobal}
                >
                  + Nouveau plan pour une nouvelle course
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground dark:text-slate-400">{copy.auth.headerHint}</p>
        )}

        {accountError ? <p className="text-xs text-red-400">{accountError}</p> : null}
      </CardContent>
    </Card>
  );
}
