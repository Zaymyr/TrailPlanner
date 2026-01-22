import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { CoachDashboard } from "../../lib/coach-dashboard";
import type { ProfileTranslations, Translations } from "../../locales/types";

const formatTierName = (
  tierName: string | null,
  labels: ProfileTranslations["subscription"]["coachTiers"]["labels"]
) => {
  if (!tierName) return null;
  return labels[tierName as keyof typeof labels] ?? tierName.toUpperCase();
};

type TierCardProps = {
  dashboard?: CoachDashboard;
  isLoading: boolean;
  error?: Error | null;
  labels: ProfileTranslations["subscription"]["coachTiers"]["labels"];
  copy: Translations["coachDashboard"]["tier"];
};

export function TierCard({ dashboard, isLoading, error, labels, copy }: TierCardProps) {
  const tierLabel = formatTierName(dashboard?.tier?.name ?? null, labels) ?? copy.noActivePlan;
  const inviteLimit = dashboard?.tier?.inviteLimit ?? null;
  const invitesUsed = dashboard?.invitesUsed ?? 0;
  const seatsRemaining = dashboard?.seatsRemaining ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        {copy.description ? <p className="text-sm text-slate-500">{copy.description}</p> : null}
        {isLoading ? <p>{copy.loading}</p> : null}
        {error ? <p className="text-red-600">{copy.error}</p> : null}
        {!isLoading && !error ? (
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.planLabel}</p>
              <p className="text-base font-semibold text-slate-900">{tierLabel}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{copy.inviteLimitLabel}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {inviteLimit !== null ? inviteLimit : "-"}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{copy.invitesUsedLabel}</p>
                <p className="text-lg font-semibold text-slate-900">{invitesUsed}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{copy.seatsRemainingLabel}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {seatsRemaining !== null ? seatsRemaining : "-"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
