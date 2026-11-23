import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The components rely on the automatic JSX runtime of Next; the test transform needs React in scope
// before they are imported (the sidebar icons are JSX at module level).
vi.hoisted(async () => {
  (globalThis as { React?: unknown }).React = await import("react");
});

import { buildInboxFixture, buildOverviewFixture } from "./overview-fixtures";
import { ActivityCard, AgendaCard, FeedCard, FunnelCard, HealthCard, InboxCard, KpiRow, RevenueCard } from "./OverviewCards";


const overview = buildOverviewFixture();
const nowMs = Date.parse(overview.generatedAt);
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("overview cards", () => {
  it("renders the six KPI tiles with their change", () => {
    const html = render(createElement(KpiRow, { block: overview.kpis, loading: false }));
    ["Coureurs actifs", "Nouveaux comptes", "Plans créés", "Revenus nets", "Premium actifs", "Livrets publiés"].forEach((label) => expect(html).toContain(label));
    expect(html).toMatch(/en hausse de 12,4\s%/);
    expect(html).toContain("▲ 2");
  });

  it("shows skeletons while loading and the error of a block", () => {
    expect(render(createElement(KpiRow, { block: undefined, loading: true }))).toContain("animate-pulse");
    expect(render(createElement(RevenueCard, { block: { status: "error", message: "Les revenus n’ont pas pu être lus." }, periodLabel: "7 jours" }))).toContain("Les revenus n’ont pas pu être lus.");
  });

  it("lists the 5 oldest items with chips, ages and actions", () => {
    const html = render(createElement(InboxCard, { inbox: buildInboxFixture(), loading: false, error: null, onRetry: () => undefined }));
    expect(html).toContain("Demandes de publication <b");
    expect(html).toContain("href=\"/admin/inbox?filtre=survols\"");
    expect(html).toContain("depuis 3 j");
    expect(html).toContain("Examiner");
    // Six counted items: race data is listed but left out of the total.
    expect(html).toMatch(/font-mono text-xs font-semibold[^>]*>6</);
    expect((html.match(/<li /g) ?? []).length).toBe(5);
  });

  it("lists the scheduled tasks, e-mails and payments lines and the simulation mode", () => {
    const html = render(createElement(HealthCard, { block: overview.health, nowMs }));
    expect(html).toContain("Tâches planifiées (crons)");
    expect(html).toContain("14 envoyés en 24 h · 1 échec");
    expect(html).not.toContain("lot 3");
    expect(html).toContain("Instagram en simulation");
    expect(html).toContain("aria-valuenow=\"3\"");
  });

  it("says « non suivi » for runner revenue and renders the agenda, funnel, feed and chart", () => {
    expect(render(createElement(RevenueCard, { block: overview.revenue, periodLabel: "7 jours" }))).toContain("non suivi");
    expect(render(createElement(AgendaCard, { block: overview.agenda }))).toContain("Duo Trail Vert");
    expect(render(createElement(FunnelCard, { block: overview.funnel, periodLabel: "7 jours" }))).toContain("Premier plan en 24 h");
    expect(render(createElement(FeedCard, { block: overview.feed, nowMs }))).toContain("il y a 12 min");
    expect(render(createElement(ActivityCard, { block: overview.activity }))).toContain("Coureurs actifs");
  });
});
