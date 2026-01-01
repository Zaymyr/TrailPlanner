"use client";

import type { RacePlannerTranslations } from "../../locales/types";
import type { SavedPlan } from "../../app/(coach)/race-planner/types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type PlanManagerProps = {
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
                <p className="text-sm font-semibold text-slate-100">{copy.plans.title}</p>
                <Button variant="ghost" className="h-9 px-3 text-xs" onClick={onRefreshPlans}>
                  {copy.plans.refresh}
                </Button>
              </div>
              {savedPlans.length === 0 ? (
                <p className="text-sm text-slate-400">{copy.plans.empty}</p>
              ) : (
                <div className="space-y-3">
                  {savedPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-50">{plan.name}</p>
                        <p className="text-xs text-slate-400">
                          {copy.plans.updatedAt.replace("{date}", new Date(plan.updatedAt).toLocaleString())}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="h-9 px-3 text-sm"
                          onClick={() => onLoadPlan(plan)}
                          disabled={deletingPlanId === plan.id}
                        >
                          {copy.plans.load}
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-9 px-3 text-sm text-red-300 hover:text-red-200"
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
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{copy.auth.headerHint}</p>
        )}

        {accountError ? <p className="text-xs text-red-400">{accountError}</p> : null}
      </CardContent>
    </Card>
  );
}
