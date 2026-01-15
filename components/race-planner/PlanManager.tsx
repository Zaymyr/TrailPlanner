"use client";

import type { RacePlannerTranslations } from "../../locales/types";
import { useMemo, useState } from "react";
import type { SavedPlan } from "../../app/(coach)/race-planner/types";
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
  deletingPlanId: string | null;
  sessionEmail?: string;
  authStatus: "idle" | "signingIn" | "signingUp" | "checking";
  canSavePlan: boolean;
  showPlanLimitUpsell: boolean;
  premiumCopy: RacePlannerTranslations["account"]["premium"];
  onPlanNameChange: (name: string) => void;
  onSavePlan: () => void;
  onRefreshPlans: () => void;
  onLoadPlan: (plan: SavedPlan) => void;
  onDeletePlan: (planId: string) => void;
};

export function PlanManager({
  copy,
  planName,
  planStatus,
  accountMessage,
  accountError,
  savedPlans,
  deletingPlanId,
  sessionEmail,
  authStatus,
  canSavePlan,
  showPlanLimitUpsell,
  premiumCopy,
  onPlanNameChange,
  onSavePlan,
  onRefreshPlans,
  onLoadPlan,
  onDeletePlan,
}: PlanManagerProps) {
  const isSaving = planStatus === "saving";
  const isAuthChecking = authStatus === "checking";
  const successMessage =
    accountMessage && accountMessage !== copy.messages.signedIn ? accountMessage : null;
  const [planSearch, setPlanSearch] = useState("");
  const normalizedSearch = planSearch.trim().toLowerCase();
  const filteredPlans = useMemo(() => {
    if (!normalizedSearch) return savedPlans;
    return savedPlans.filter((plan) => plan.name.toLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, savedPlans]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {sessionEmail ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">{copy.plans.nameLabel}</Label>
              <Input
                id="plan-name"
                value={planName}
                placeholder={copy.plans.defaultName}
                onChange={(event) => onPlanNameChange(event.target.value)}
              />
              <Button
                type="button"
                className="w-full"
                onClick={onSavePlan}
                disabled={isSaving || !canSavePlan || isAuthChecking}
              >
                {isSaving ? copy.plans.saving : copy.plans.save}
              </Button>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground dark:text-slate-100">{copy.plans.title}</p>
                <Button variant="ghost" className="h-9 px-3 text-xs sm:text-sm" onClick={onRefreshPlans}>
                  {copy.plans.refresh}
                </Button>
              </div>
              {savedPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground dark:text-slate-400">{copy.plans.empty}</p>
              ) : (
                <>
                  <Input
                    value={planSearch}
                    onChange={(event) => setPlanSearch(event.target.value)}
                    placeholder={copy.plans.searchPlaceholder}
                    aria-label={copy.plans.searchLabel}
                  />
                  {filteredPlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground dark:text-slate-400">{copy.plans.empty}</p>
                  ) : (
                    <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
                      {filteredPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="break-words text-sm font-semibold text-foreground dark:text-slate-50">
                              {plan.name}
                            </p>
                            <p className="text-xs text-muted-foreground dark:text-slate-400">
                              {copy.plans.updatedAt.replace("{date}", new Date(plan.updatedAt).toLocaleString())}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button
                              variant="outline"
                              className="h-9 w-full px-3 text-sm sm:w-auto"
                              onClick={() => onLoadPlan(plan)}
                              disabled={deletingPlanId === plan.id}
                            >
                              {copy.plans.load}
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-9 w-full px-3 text-sm text-red-300 hover:text-red-200 sm:w-auto"
                              onClick={() => onDeletePlan(plan.id)}
                              disabled={deletingPlanId === plan.id || isSaving}
                            >
                              {deletingPlanId === plan.id ? copy.plans.saving : copy.plans.delete}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
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
