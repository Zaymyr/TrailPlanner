import type { InboxResponse } from "../../../../lib/admin-inbox";
import type { AdminOverviewResponse } from "../../../../lib/admin-overview";

/**
 * Simulated data of the « Vue d'ensemble » and of the « À traiter » queue (values of the ADR mock-up),
 * for the rendering tests. Never imported by a page.
 */

const at = (now: number, hours: number) => new Date(now - hours * 3_600_000).toISOString();
const day = (now: number, offset: number) => new Date(now + offset * 86_400_000).toISOString().slice(0, 10);

export const buildOverviewFixture = (now = Date.parse("2026-11-22T11:00:00.000Z")): AdminOverviewResponse => {
  const today = day(now, 0);
  const points = Array.from({ length: 30 }, (_, index) => ({
    date: day(now, index - 29),
    activePlanUsers: 120 + Math.round(index * 4 + 12 * Math.sin(index / 3)),
    newAccounts: 18 + Math.round(6 * Math.sin(index / 2) + index / 3),
    newPlans: 30 + Math.round(8 * Math.cos(index / 4)),
  }));
  return {
    generatedAt: new Date(now).toISOString(),
    range: { key: "7d", start: day(now, -6), end: today, days: 7, previousStart: day(now, -13), previousEnd: day(now, -7), today },
    kpis: {
      status: "ok",
      data: {
        activeRunners: { current: 1284, previous: 1142, series: points.slice(-7).map((point) => point.activePlanUsers) },
        newAccounts: { current: 186, previous: 172, series: points.slice(-7).map((point) => point.newAccounts) },
        newPlans: { current: 342, previous: 353, series: [52, 50, 54, 47, 48, 45, 46] },
        netRevenue: { current: 73_800, previous: 52_300, series: [], partial: false, currency: "eur" },
        activePremium: { current: 418, previous: 406, series: [] },
        publishedRacebooks: { current: 23, previous: 21, series: [] },
      },
    },
    activity: { status: "ok", data: { start: points[0].date, end: today, points } },
    funnel: {
      status: "ok",
      data: {
        runners: [
          { step: "Comptes créés", count: 186, conversionFromPrevious: null },
          { step: "Fenêtre de 24 h écoulée", count: 160, conversionFromPrevious: null },
          { step: "Premier plan en 24 h", count: 97, conversionFromPrevious: 60.6 },
        ],
        organizers: [
          { step: "Événements de la cohorte", count: 12, conversionFromPrevious: null },
          { step: "Avec une édition", count: 10, conversionFromPrevious: 83.3 },
          { step: "Avec un format complet", count: 7, conversionFromPrevious: 70 },
          { step: "Avec un Livret coureur publié", count: 3, conversionFromPrevious: 42.9 },
        ],
      },
    },
    revenue: {
      status: "ok",
      data: {
        currency: "eur",
        totalMinor: 73_800,
        previousTotalMinor: 52_300,
        sources: [
          { key: "organizers", label: "Organisateurs · livrets et packs", tracked: true, amountMinor: 49_800, previousAmountMinor: 40_000, count: 2, refundedMinor: 0, refundedCount: 0, error: null },
          { key: "runners", label: "Coureurs · plans et abonnements", tracked: false, amountMinor: null, previousAmountMinor: null, count: null, refundedMinor: null, refundedCount: null, error: null },
          { key: "flyovers", label: "Vidéos de survol", tracked: true, amountMinor: 24_000, previousAmountMinor: 12_300, count: 5, refundedMinor: 2_999, refundedCount: 1, error: null },
        ],
      },
    },
    agenda: {
      status: "ok",
      data: {
        days: [
          { date: day(now, 2), events: [
            { kind: "reel", scheduled: true, title: "Trail des Aiguilles", time: "18:00", note: "Reel programmé · simulation", href: "/admin/content/posts?post=a" },
            { kind: "carousel", scheduled: false, title: "Le plan chiffré · Ultra des Druides", time: "18:00", note: "Prévu par l’automatisation", href: "/admin/content/posts?onglet=carousels&element=b" },
          ] },
          { date: day(now, 4), events: [{ kind: "carousel", scheduled: false, title: "Le brief · Ultra des Druides", time: "18:00", note: "Prévu par l’automatisation", href: "/admin/content/posts?onglet=carousels&element=c" }] },
          { date: day(now, 6), events: [
            { kind: "race", scheduled: false, title: "Duo Trail Vert", time: null, note: "Course d’un organisateur", href: "/admin/organizers" },
            { kind: "reel", scheduled: false, title: "Trail TST", time: "18:00", note: "Prévu par l’automatisation", href: "/admin/content/posts?element=d" },
          ] },
        ],
        errors: [],
      },
    },
    health: {
      status: "ok",
      data: {
        instagramDryRun: true,
        systems: [
          { key: "instagram", label: "Publication Instagram", status: "warning", detail: "Mode simulation · quota 3 / 50 sur 24 h", lastAt: at(now, 0.05), meter: { value: 3, total: 50 }, href: "/admin/system/integrations" },
          { key: "automation", label: "Reels et carrousels automatiques", status: "ok", detail: "Reels : génération, publication après relecture · Carrousels : 2 séries sur 3 · prochain reel mar. 24 nov. 18:00", lastAt: at(now, 0.7), meter: null, href: "/admin/system/automation" },
          { key: "renders", label: "Rendus (reels et carrousels)", status: "warning", detail: "1 échec sur 7 rendus en 24 h", lastAt: at(now, 0.3), meter: null, href: "/admin/content/renders" },
          { key: "flyovers", label: "Vidéos de survol", status: "ok", detail: "0 en cours", lastAt: at(now, 0.1), meter: null, href: "/admin/content/flyovers" },
          { key: "crons", label: "Tâches planifiées (crons)", status: "ok", detail: "8 tâches actives · 2 crons Vercel jamais appelés", lastAt: at(now, 0.07), meter: null, href: "/admin/system/automation" },
          { key: "emails", label: "E-mails (Resend)", status: "warning", detail: "14 envoyés en 24 h · 1 échec", lastAt: at(now, 1.5), meter: null, href: "/admin/system/integrations" },
          { key: "payments", label: "Paiements Stripe (webhook)", status: "ok", detail: "Webhook reçu", lastAt: at(now, 0.2), meter: null, href: "/admin/system/integrations" },
        ],
      },
    },
    feed: {
      status: "ok",
      data: {
        errors: [],
        events: [
          { kind: "payment", title: "Essentiel payé", detail: "Trail des Aiguilles · 99 €", at: at(now, 0.2), href: "/admin/organizers" },
          { kind: "flyover_order", title: "Commande de survol", detail: "MP4 · Trail des Crêtes", at: at(now, 0.8), href: "/admin/content/flyovers" },
          { kind: "accounts", title: "14 nouveaux comptes", detail: "aujourd’hui", at: at(now, 1), href: "/admin/runners" },
          { kind: "render_failed", title: "Rendu échoué", detail: "Reel Marathon de l’Orchis", at: at(now, 2), href: "/admin/content/renders" },
          { kind: "post_published", title: "Reel publié", detail: "Ultra des Druides · simulation", at: at(now, 26), href: "/admin/content/posts?onglet=published" },
        ],
      },
    },
  };
};

export const buildInboxFixture = (now = Date.parse("2026-11-22T11:00:00.000Z")): InboxResponse => ({
  generatedAt: new Date(now).toISOString(),
  today: day(now, 0),
  sources: [],
  items: [
    { id: "publication_request:1", type: "publication_request", title: "Demande de publication · Trail des Aiguilles 2027", context: "Organisateur · livret de l’édition", since: at(now, 72), dueDate: null, href: "/admin/organizers" },
    { id: "organizer_claim:2", type: "organizer_claim", title: "Demande d’accès · Ultra des Druides", context: "Organisateur · Club des Druides · contact@ultradruides.fr", since: at(now, 50), dueDate: null, href: "/admin/organizers?vue=acces" },
    { id: "bug:3", type: "bug", title: "« Le PDF du plan ne s’ouvre pas sur iPhone »", context: "Bug · ios · plan", since: at(now, 9), dueDate: null, href: "/admin/inbox?vue=bugs" },
    { id: "feedback:4", type: "feedback", title: "« Super outil, merci »", context: "Feedback · web", since: at(now, 6), dueDate: null, href: "/admin/inbox?vue=feedback" },
    { id: "flyover_failed:5", type: "flyover_failed", title: "Survol « SaintéLyon » en échec", context: "Vidéo de survol · MP4 à télécharger · arrêtée à la main (test)", since: at(now, 2), dueDate: null, href: "/admin/content/flyovers" },
    { id: "post_draft:6", type: "post_draft", title: "Brouillon à relire · Reel · Marathon de l’Orchis", context: "Instagram · brouillon automatique", since: at(now, 1.5), dueDate: null, href: "/admin/content/posts?post=6" },
    { id: "race_data:7", type: "race_data", title: "GPX manquant · Trail du Ventoux · 42 km", context: "Données de course · reel possible le 4 déc. · course le 11 déc.", since: null, dueDate: day(now, 9), href: "/admin/catalog/races?course=7" },
  ],
});
