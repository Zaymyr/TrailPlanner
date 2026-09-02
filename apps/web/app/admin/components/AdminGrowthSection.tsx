"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { type AdminTranslations } from "../../../locales/types";
import { adminGrowthResponseSchema, type AdminGrowthResponse } from "../../api/admin/growth/schema";
import AdminTrendChart from "./AdminTrendChart";

type Props = { accessToken: string | null | undefined; t: AdminTranslations["growth"] };

const Kpi = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="rounded-lg border border-border bg-card p-4 dark:border-slate-800">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

function Funnel({ rows, labels }: {
  rows: AdminGrowthResponse["organizers"]["funnel"];
  labels: { step: string; users: string; conversion: string };
}) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>{labels.step}</TableHead><TableHead>{labels.users}</TableHead><TableHead>{labels.conversion}</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((row) => (
        <TableRow key={row.step}>
          <TableCell className="font-medium">{row.step}</TableCell>
          <TableCell>{row.count}</TableCell>
          <TableCell>{row.conversionFromPrevious === null ? "—" : `${row.conversionFromPrevious}%`}</TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  );
}

export default function AdminGrowthSection({ accessToken, t }: Props) {
  const isFrench = t.title.toLowerCase().includes("croissance");
  const copy = isFrench ? {
    title: "Croissance & activation",
    description: "Suivre les comptes, l’activation et les contenus à partir des données Supabase.",
    today: "Aujourd’hui", yesterday: "Hier", last7: "7 jours", last30: "30 jours", custom: "Personnalisé",
    overview: "Trajectoire", trajectoryDescription: "Les volumes quotidiens permettent de distinguer une tendance d’un pic isolé.", productTrend: "Usage et création", newAccounts: "Nouveaux comptes", activated: "Activés en 24 h", activePlanUsers: "Utilisateurs actifs sur un plan", newPlans: "Nouveaux plans", premium: "Premium actifs",
    actions: "À surveiller et actions", noActions: "Aucune alerte notable sur cette période.",
    organizers: "Organisateurs", funnel: "Parcours de conversion", step: "Étape", users: "Personnes", conversion: "Conversion depuis l’étape précédente",
    newOrganizers: "Nouveaux organisateurs", activeOrganizers: "Organisateurs connectés", returningOrganizers: "Revenus après 7 j", events: "Événements créés", editions: "Éditions créées", formats: "Formats créés", published: "RaceBooks publiés",
    activatedRacebooks: "Accès RaceBook actifs", giftedRacebooks: "Accès offerts", paidRacebooks: "Accès payés",
    followUps: "Organisateurs à relancer", organizer: "Organisateur", event: "Événement", inactivity: "Inactivité", status: "Situation", days: "j",
    noFormat: "Aucun format", incomplete: "Format incomplet", ready: "Prêt à publier", publishedStatus: "Publié",
    projection: "Au rythme de la période : {value} sur 30 j", activationRate: "{value}% des nouveaux comptes", racebookStock: "Stock actuel par édition, hors comptes admin", sources: "Tous les chiffres de ce dashboard proviennent de Supabase et excluent les comptes admin. L’activité organisateur repose sur les connexions réelles, pas sur updated_at. Les parcours Web et App s’analysent directement dans PostHog.",
  } : {
    title: "Growth & activation",
    description: "Track accounts, activation, and content from Supabase data.",
    today: "Today", yesterday: "Yesterday", last7: "7 days", last30: "30 days", custom: "Custom",
    overview: "Trajectory", trajectoryDescription: "Daily volumes make sustained trends distinguishable from isolated spikes.", productTrend: "Usage and creation", newAccounts: "New accounts", activated: "Activated in 24h", activePlanUsers: "Active plan users", newPlans: "New plans", premium: "Active Premium",
    actions: "Watchlist & actions", noActions: "No notable alert for this period.",
    organizers: "Organizers", funnel: "Conversion journey", step: "Step", users: "People", conversion: "Conversion from previous step",
    newOrganizers: "New organizers", activeOrganizers: "Signed-in organizers", returningOrganizers: "Returned after 7d", events: "Events created", editions: "Editions created", formats: "Formats created", published: "RaceBooks published",
    activatedRacebooks: "Active RaceBook access", giftedRacebooks: "Complimentary access", paidRacebooks: "Paid access",
    followUps: "Organizers to follow up", organizer: "Organizer", event: "Event", inactivity: "Inactive", status: "Situation", days: "d",
    noFormat: "No format", incomplete: "Incomplete format", ready: "Ready to publish", publishedStatus: "Published",
    projection: "At this period’s pace: {value} over 30d", activationRate: "{value}% of new accounts", racebookStock: "Current stock by edition, excluding admin accounts", sources: "Every metric in this dashboard comes from Supabase and excludes admin accounts. Organizer activity uses actual sign-ins, not updated_at. Web and App journeys are analyzed directly in PostHog.",
  };
  const [range, setRange] = useState("last7");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const growthQuery = useQuery({
    queryKey: ["admin", "growth", accessToken, range, start, end],
    enabled: Boolean(accessToken) && (range !== "custom" || Boolean(start && end)),
    queryFn: async () => {
      const params = new URLSearchParams({ range });
      if (range === "custom" && start && end) { params.set("start", start); params.set("end", end); }
      const response = await fetch(`/api/admin/growth?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error((data as { message?: string }).message ?? t.loadError);
      const parsed = adminGrowthResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error(t.loadError);
      return parsed.data;
    },
  });
  const data = growthQuery.data;
  const statusLabels: Record<AdminGrowthResponse["organizers"]["followUps"][number]["status"], string> = {
    no_format: copy.noFormat, incomplete: copy.incomplete, ready_to_publish: copy.ready, published: copy.publishedStatus,
  };
  const periodDays = Math.max(1, data?.trend.length ?? 1);
  const projectionHint = (value: number) => copy.projection.replace("{value}", String(Math.round((value / periodDays) * 30)));
  const activationRate = data && data.overview.newAccounts > 0
    ? Math.round((data.overview.activatedUsers / data.overview.newAccounts) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2 text-sm">
          {[["today", copy.today], ["yesterday", copy.yesterday], ["last7", copy.last7], ["last30", copy.last30], ["custom", copy.custom]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setRange(key)} className={`rounded-md border px-3 py-1.5 ${range === key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground"}`}>{label}</button>
          ))}
          {range === "custom" ? <>
            <input aria-label="Start date" type="date" value={start} onChange={(event) => setStart(event.target.value)} className="rounded-md border border-border bg-card px-2 text-foreground" />
            <input aria-label="End date" type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="rounded-md border border-border bg-card px-2 text-foreground" />
          </> : null}
        </div>

        {growthQuery.isLoading ? <p className="text-sm text-muted-foreground">{isFrench ? "Chargement…" : "Loading…"}</p> : null}
        {growthQuery.error ? <p className="text-sm text-red-600 dark:text-red-300">{growthQuery.error instanceof Error ? growthQuery.error.message : t.loadError}</p> : null}
        {data ? <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{copy.overview}</h3>
            <p className="text-sm text-muted-foreground">{copy.trajectoryDescription}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label={copy.newAccounts} value={data.overview.newAccounts} hint={projectionHint(data.overview.newAccounts)} />
              <Kpi label={copy.activated} value={data.overview.activatedUsers} hint={copy.activationRate.replace("{value}", String(activationRate))} />
              <Kpi label={copy.activePlanUsers} value={data.overview.activePlanUsers} hint={isFrench ? "Personnes ayant modifié un plan" : "People who updated a plan"} />
              <Kpi label={copy.newPlans} value={data.overview.newPlans} hint={projectionHint(data.overview.newPlans)} />
              <Kpi label={copy.premium} value={data.overview.activePremiumUsers} />
            </div>
            <AdminTrendChart
              title={copy.productTrend}
              description={isFrench ? "Comptes, activation et plans par jour" : "Accounts, activation, and plans per day"}
              points={data.trend}
              locale={isFrench ? "fr-FR" : "en-US"}
              series={[
                { key: "newAccounts", label: copy.newAccounts, color: "#2563eb" },
                { key: "activatedUsers", label: copy.activated, color: "#16a34a" },
                { key: "activePlanUsers", label: copy.activePlanUsers, color: "#7c3aed" },
                { key: "newPlans", label: copy.newPlans, color: "#f59e0b" },
              ]}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{copy.actions}</h3>
            {data.actions.length === 0 ? <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{copy.noActions}</p> : (
              <div className="grid gap-3 lg:grid-cols-2">{data.actions.map((action) => (
                <div key={action.id} className={`rounded-lg border p-4 ${action.severity === "critical" ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : action.severity === "warning" ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"}`}>
                  <p className="font-semibold text-foreground">{action.title}</p><p className="mt-1 text-sm text-muted-foreground">{action.detail}</p>
                </div>
              ))}</div>
            )}
          </section>

          <section className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground">{copy.organizers}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label={copy.activatedRacebooks} value={data.organizers.activatedRacebooks} hint={copy.racebookStock} />
              <Kpi label={copy.giftedRacebooks} value={data.organizers.giftedRacebooks} hint={isFrench ? "Source admin ou historique" : "Admin or legacy source"} />
              <Kpi label={copy.paidRacebooks} value={data.organizers.paidRacebooks} hint={isFrench ? "Source Stripe active" : "Active Stripe source"} />
              <Kpi label={copy.newOrganizers} value={data.organizers.newOrganizers} />
              <Kpi label={copy.activeOrganizers} value={data.organizers.activeOrganizers} />
              <Kpi label={copy.returningOrganizers} value={data.organizers.returningOrganizers} hint={isFrench ? "Selon la dernière connexion" : "Based on last sign-in"} />
              <Kpi label={copy.events} value={data.organizers.eventsCreated} />
              <Kpi label={copy.editions} value={data.organizers.editionsCreated} />
              <Kpi label={copy.formats} value={data.organizers.formatsCreated} />
              <Kpi label={copy.published} value={data.organizers.publishedRacebooks} />
            </div>
            <div><h3 className="mb-2 text-sm font-semibold">{copy.funnel}</h3><Funnel rows={data.organizers.funnel} labels={{ step: copy.step, users: copy.users, conversion: copy.conversion }} /></div>
            <div><h3 className="mb-2 text-sm font-semibold">{copy.followUps}</h3>{data.organizers.followUps.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noActions}</p> : <Table>
              <TableHeader><TableRow><TableHead>{copy.event}</TableHead><TableHead>{copy.organizer}</TableHead><TableHead>{copy.status}</TableHead><TableHead>{copy.inactivity}</TableHead></TableRow></TableHeader>
              <TableBody>{data.organizers.followUps.map((item) => <TableRow key={item.eventId}>
                <TableCell className="font-medium"><a className="text-brand underline-offset-4 hover:underline" href={`/organizer?eventId=${encodeURIComponent(item.eventId)}`}>{item.eventName}</a></TableCell>
                <TableCell><a className="underline-offset-4 hover:underline" href={`mailto:${item.organizerEmail}`}>{item.organizerEmail}</a></TableCell>
                <TableCell>{statusLabels[item.status]}</TableCell><TableCell>{item.daysInactive} {copy.days}</TableCell>
              </TableRow>)}</TableBody>
            </Table>}</div>
          </section>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">{copy.sources}</p>
        </> : null}
      </CardContent>
    </Card>
  );
}
