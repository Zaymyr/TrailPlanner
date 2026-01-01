"use client";

import type { RacePlannerTranslations } from "../../locales/types";
import type { SavedPlan } from "../../app/(coach)/race-planner/types";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SectionHeader } from "../ui/SectionHeader";

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
  isPremium: boolean;
  canSavePlan: boolean;
  showPlanLimitUpsell: boolean;
  premiumCopy: RacePlannerTranslations["account"]["premium"];
  onUpgrade: () => void;
  upgradeStatus: "idle" | "opening";
  upgradeError: string | null;
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
  isPremium,
  canSavePlan,
  showPlanLimitUpsell,
  premiumCopy,
  onUpgrade,
  upgradeStatus,
  upgradeError,
  onPlanNameChange,
  onSavePlan,
  onRefreshPlans,
  onLoadPlan,
  onDeletePlan,
}: PlanManagerProps) {
  const isSaving = planStatus === "saving";
  const showStatus = authStatus === "checking" ? copy.auth.status : null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <SectionHeader title={copy.title} description={copy.description} />
        <div className="rounded-md border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
          {sessionEmail ? (
            <p>{copy.auth.signedInAs.replace("{email}", sessionEmail)}</p>
          ) : (
            <p>{copy.auth.headerHint}</p>
          )}
          {showStatus ? <p className="text-xs text-slate-400">{showStatus}</p> : null}
        </div>
        {!isPremium ? (
          <div className="space-y-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-amber-100">{premiumCopy.title}</p>
              <span className="rounded-full border border-amber-300/60 bg-amber-300/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-50">
                {premiumCopy.badge}
              </span>
            </div>
            <p className="text-xs text-amber-100/90">{premiumCopy.description}</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-50/90">
              <li>{premiumCopy.limits.plans}</li>
              <li>{premiumCopy.limits.favorites}</li>
              <li>{premiumCopy.limits.customProducts}</li>
              <li>{premiumCopy.limits.export}</li>
              <li>{premiumCopy.limits.autoFill}</li>
            </ul>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="w-full"
                onClick={onUpgrade}
                disabled={upgradeStatus === "opening"}
              >
                {upgradeStatus === "opening" ? premiumCopy.opening : premiumCopy.cta}
              </Button>
              <span className="hidden text-xs text-amber-200 sm:inline">{premiumCopy.badge}</span>
            </div>
            {upgradeError ? <p className="text-xs text-red-200">{upgradeError}</p> : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {sessionEmail ? (
          <div className="space-y-3">
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
                disabled={isSaving || !canSavePlan}
              >
                {isSaving ? copy.plans.saving : copy.plans.save}
              </Button>
              {showPlanLimitUpsell && !isPremium ? (
                <p className="text-xs text-amber-200" role="status">
                  {premiumCopy.planLimitReached}
                </p>
              ) : null}
              {accountMessage ? (
                <p className="text-xs text-emerald-300" role="status">
                  {accountMessage}
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
