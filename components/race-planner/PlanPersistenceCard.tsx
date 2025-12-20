"use client";

import type { RacePlannerTranslations } from "../../locales/types";
import type { SavedPlan } from "../../app/(coach)/race-planner/hooks/useRacePlanner";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SectionHeader } from "../ui/SectionHeader";

type PlanPersistenceCardProps = {
  copy: RacePlannerTranslations["account"];
  session: { accessToken: string; refreshToken?: string; email?: string } | null;
  planName: string;
  onPlanNameChange: (name: string) => void;
  onSavePlan: () => void;
  planStatus: "idle" | "saving";
  savedPlans: SavedPlan[];
  deletingPlanId: string | null;
  onLoadPlan: (plan: SavedPlan) => void;
  onDeletePlan: (id: string) => void;
  accountMessage: string | null;
  accountError: string | null;
  onSignOut: () => void;
};

export function PlanPersistenceCard({
  copy,
  session,
  planName,
  onPlanNameChange,
  onSavePlan,
  planStatus,
  savedPlans,
  deletingPlanId,
  onLoadPlan,
  onDeletePlan,
  accountMessage,
  accountError,
  onSignOut,
}: PlanPersistenceCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <SectionHeader title={copy.title} description={copy.description} action={null} />
        {session?.email ? (
          <p className="text-xs text-slate-400">{copy.messages.signedIn.replace("{email}", session.email)}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {session ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="plan-name">{copy.plans.nameLabel}</Label>
              <Input
                id="plan-name"
                value={planName}
                placeholder={copy.plans.defaultName}
                onChange={(event) => onPlanNameChange(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="flex-1" onClick={onSavePlan} disabled={planStatus === "saving"}>
                  {planStatus === "saving" ? copy.plans.saving : copy.plans.save}
                </Button>
                <Button type="button" variant="outline" onClick={onSignOut}>
                  {copy.auth.signOut}
                </Button>
              </div>
              {accountMessage ? (
                <p className="text-xs text-emerald-300" role="status">
                  {accountMessage}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-100">{copy.plans.savedTitle}</p>
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
                          disabled={deletingPlanId === plan.id || planStatus === "saving"}
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

        {accountError && session ? <p className="text-xs text-red-400">{accountError}</p> : null}
      </CardContent>
    </Card>
  );
}
