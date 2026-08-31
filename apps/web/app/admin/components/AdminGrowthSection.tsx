"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { type AdminTranslations } from "../../../locales/types";
import { adminGrowthResponseSchema, type AdminGrowthResponse } from "../../api/admin/growth/schema";

type Props = { accessToken: string | null | undefined; t: AdminTranslations["growth"] };
type View = "web" | "app" | "organizers";

const Kpi = ({ label, value, hint }: { label: string; value: string | number | null; hint?: string }) => (
  <div className="rounded-lg border border-border bg-card p-4 dark:border-slate-800">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-foreground">{value === null ? "—" : value}</p>
    {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

function Funnel({ rows, labels }: { rows: AdminGrowthResponse["web"]["funnel"]; labels: { step: string; users: string; conversion: string } }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>{labels.step}</TableHead><TableHead>{labels.users}</TableHead><TableHead>{labels.conversion}</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((row) => (
        <TableRow key={row.step}>
          <TableCell className="font-medium">{row.step}</TableCell>
          <TableCell>{row.count ?? "—"}</TableCell>
          <TableCell>{row.conversionFromPrevious === null ? "—" : `${row.conversionFromPrevious}%`}</TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  );
}

export default function AdminGrowthSection({ accessToken, t }: Props) {
  const isFrench = t.title.toLowerCase().includes("croissance");
  const copy = isFrench ? {
    title: "Croissance & activation", description: "Comprendre qui découvre Pace Yourself, atteint la première valeur et revient l'utiliser.",
    today: "Aujourd'hui", yesterday: "Hier", last7: "7 jours", last30: "30 jours", custom: "Personnalisé",
    overview: "Vue d'ensemble", newAccounts: "Nouveaux comptes", activated: "Activés en 24 h", activePlanUsers: "Utilisateurs actifs sur un plan", newPlans: "Nouveaux plans", premium: "Premium actifs",
    actions: "À surveiller et actions", noActions: "Aucune alerte notable sur cette période.",
    web: "Web · Acquisition", app: "App · Activation & rétention", organizers: "Organisateurs",
    unavailable: "Les données de navigation et de rétention nécessitent la connexion de l'API de lecture PostHog.",
    error: "PostHog n'a pas pu être interrogé. Les chiffres Supabase restent disponibles.",
    visitors: "Visiteurs uniques", onboarding: "Onboarding commencé", generated: "Plans générés", signups: "Inscriptions email", downloads: "Clics vers l'App",
    funnel: "Parcours de conversion", step: "Étape", users: "Personnes", conversion: "Conversion depuis l'étape précédente",
    newAppUsers: "Nouveaux utilisateurs App", activeAppUsers: "Actifs App", completedOnboarding: "Onboarding terminé", planCreators: "Créateurs de plan", planSavers: "Plans sauvegardés", planSharers: "Plans partagés",
    retention: "Rétention par cohorte", period: "Retour", eligible: "Cohorte éligible", returned: "Revenus", rate: "Taux",
    landing: "Visiteurs landing", cta: "Clics CTA", dashboard: "Visiteurs dashboard", newOrganizers: "Nouveaux organisateurs", contentChanges: "Avec contenu modifié", returningOrganizers: "Revenus après 7 j", events: "Événements créés", editions: "Éditions créées", formats: "Formats créés", published: "RaceBooks publiés",
    followUps: "Organisateurs à relancer", organizer: "Organisateur", event: "Événement", inactivity: "Inactivité", status: "Situation", days: "j",
    noFormat: "Aucun format", incomplete: "Format incomplet", ready: "Prêt à publier", publishedStatus: "Publié",
    sources: "Supabase fournit les comptes et contenus. PostHog fournit les visites, parcours et cohortes.",
  } : {
    title: "Growth & activation", description: "Understand who discovers Pace Yourself, reaches first value, and comes back.",
    today: "Today", yesterday: "Yesterday", last7: "7 days", last30: "30 days", custom: "Custom",
    overview: "Overview", newAccounts: "New accounts", activated: "Activated in 24h", activePlanUsers: "Active plan users", newPlans: "New plans", premium: "Active Premium",
    actions: "Watchlist & actions", noActions: "No notable alert for this period.",
    web: "Web · Acquisition", app: "App · Activation & retention", organizers: "Organizers",
    unavailable: "Navigation and retention data require a configured PostHog read API.",
    error: "PostHog could not be queried. Supabase figures remain available.",
    visitors: "Unique visitors", onboarding: "Onboarding started", generated: "Plans generated", signups: "Email signups", downloads: "App download clicks",
    funnel: "Conversion journey", step: "Step", users: "People", conversion: "Conversion from previous step",
    newAppUsers: "New App users", activeAppUsers: "Active App users", completedOnboarding: "Onboarding completed", planCreators: "Plan creators", planSavers: "Plans saved", planSharers: "Plans shared",
    retention: "Cohort retention", period: "Return", eligible: "Eligible cohort", returned: "Returned", rate: "Rate",
    landing: "Landing visitors", cta: "CTA clicks", dashboard: "Dashboard visitors", newOrganizers: "New organizers", contentChanges: "With content changes", returningOrganizers: "Returned after 7d", events: "Events created", editions: "Editions created", formats: "Formats created", published: "RaceBooks published",
    followUps: "Organizers to follow up", organizer: "Organizer", event: "Event", inactivity: "Inactive", status: "Situation", days: "d",
    noFormat: "No format", incomplete: "Incomplete format", ready: "Ready to publish", publishedStatus: "Published",
    sources: "Supabase supplies accounts and content. PostHog supplies visits, journeys, and cohorts.",
  };
  const [range, setRange] = useState("last7");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [view, setView] = useState<View>("web");
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
  const status = view === "organizers" ? data?.organizers.analyticsStatus : data?.[view].status;
  const statusCopy = status === "not_configured" ? copy.unavailable : status === "error" ? copy.error : null;
  const statusLabels: Record<AdminGrowthResponse["organizers"]["followUps"][number]["status"], string> = {
    no_format: copy.noFormat, incomplete: copy.incomplete, ready_to_publish: copy.ready, published: copy.publishedStatus,
  };

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

        {growthQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
        {growthQuery.error ? <p className="text-sm text-red-600 dark:text-red-300">{growthQuery.error instanceof Error ? growthQuery.error.message : t.loadError}</p> : null}
        {data ? <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{copy.overview}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label={copy.newAccounts} value={data.overview.newAccounts} />
              <Kpi label={copy.activated} value={data.overview.activatedUsers} hint={isFrench ? "Premier plan dans les 24 h" : "First plan within 24h"} />
              <Kpi label={copy.activePlanUsers} value={data.overview.activePlanUsers} />
              <Kpi label={copy.newPlans} value={data.overview.newPlans} />
              <Kpi label={copy.premium} value={data.overview.activePremiumUsers} hint={isFrench ? "Total actuel" : "Current total"} />
            </div>
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

          <div className="flex flex-wrap gap-2 border-b border-border pb-3">
            {(["web", "app", "organizers"] as View[]).map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={`rounded-md px-3 py-2 text-sm font-medium ${view === item ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}>{copy[item]}</button>
            ))}
          </div>
          {statusCopy ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{statusCopy}</p> : null}

          {view === "web" ? <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label={copy.visitors} value={data.web.uniqueVisitors} />
              <Kpi label={copy.onboarding} value={data.web.onboardingStarted} />
              <Kpi label={copy.generated} value={data.web.plansGenerated} />
              <Kpi label={copy.signups} value={data.web.signupsCompleted} />
              <Kpi label={copy.downloads} value={data.web.appDownloadClicks} />
            </div>
            <div><h3 className="mb-2 text-sm font-semibold">{copy.funnel}</h3><Funnel rows={data.web.funnel} labels={{ step: copy.step, users: copy.users, conversion: copy.conversion }} /></div>
          </section> : null}

          {view === "app" ? <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi label={copy.newAppUsers} value={data.app.newUsers} />
              <Kpi label={copy.activeAppUsers} value={data.app.activeUsers} />
              <Kpi label={copy.completedOnboarding} value={data.app.onboardingCompleted} />
              <Kpi label={copy.planCreators} value={data.app.planCreatedUsers} />
              <Kpi label={copy.planSavers} value={data.app.planSavedUsers} />
              <Kpi label={copy.planSharers} value={data.app.planSharedUsers} />
            </div>
            <div><h3 className="mb-2 text-sm font-semibold">{copy.retention}</h3><Table>
              <TableHeader><TableRow><TableHead>{copy.period}</TableHead><TableHead>{copy.eligible}</TableHead><TableHead>{copy.returned}</TableHead><TableHead>{copy.rate}</TableHead></TableRow></TableHeader>
              <TableBody>{(["j1", "j7", "j30"] as const).map((key) => { const item = data.app.retention[key]; return <TableRow key={key}><TableCell className="font-medium">{key.toUpperCase()}</TableCell><TableCell>{item.eligible ?? "—"}</TableCell><TableCell>{item.returned ?? "—"}</TableCell><TableCell>{item.rate === null ? "—" : `${item.rate}%`}</TableCell></TableRow>; })}</TableBody>
            </Table></div>
          </section> : null}

          {view === "organizers" ? <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label={copy.landing} value={data.organizers.landingVisitors} />
              <Kpi label={copy.cta} value={data.organizers.ctaVisitors} />
              <Kpi label={copy.dashboard} value={data.organizers.dashboardVisitors} />
              <Kpi label={copy.newOrganizers} value={data.organizers.newOrganizers} />
              <Kpi label={copy.contentChanges} value={data.organizers.organizersWithContentChanges} />
              <Kpi label={copy.returningOrganizers} value={data.organizers.returningOrganizers} hint={isFrench ? "Proxy via modifications Supabase" : "Proxy from Supabase changes"} />
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
          </section> : null}

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">{copy.sources}</p>
        </> : null}
      </CardContent>
    </Card>
  );
}
