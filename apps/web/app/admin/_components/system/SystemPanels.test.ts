import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Same as OverviewCards.test.ts: the JSX of the imported icons needs React in scope.
vi.hoisted(async () => {
  (globalThis as { React?: unknown }).React = await import("react");
});

import { IntegrationCards, ScheduledTasksCard } from "./SystemPanels";
import { buildIntegrationsFixture, buildSystemHealthFixture, SYSTEM_FIXTURE_NOW } from "./system-fixtures";

const render = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element);

describe("ScheduledTasksCard", () => {
  it("lists pg_cron tasks with schedule, last run, status, failures and what to do", () => {
    const html = render(createElement(ScheduledTasksCard, { health: buildSystemHealthFixture(), loading: false, error: null, onRetry: () => undefined, nowMs: SYSTEM_FIXTURE_NOW }));
    expect(html).toContain("Vidéos de survol");
    expect(html).toContain("Toutes les 10 minutes");
    expect(html).toContain("il y a 35 min");
    expect(html).toContain("Échec");
    expect(html).toContain("ERROR: canceling statement due to statement timeout");
    expect(html).toContain("Voir le message d’erreur");
    expect(html).toContain("Que faire ?");
    expect(html).not.toContain("Jamais appelée par Vercel");
    expect(html).toContain("Réconciliation RevenueCat");
    expect(html).toContain("pg_net ne garde ni l’URL ni la tâche");
    expect(html).toContain("<caption");
  });

  it("shows the loading and error states", () => {
    expect(render(createElement(ScheduledTasksCard, { health: undefined, loading: true, error: null, onRetry: () => undefined, nowMs: SYSTEM_FIXTURE_NOW }))).toContain("Chargement des tâches planifiées");
    expect(render(createElement(ScheduledTasksCard, { health: undefined, loading: false, error: "Lecture impossible", onRetry: () => undefined, nowMs: SYSTEM_FIXTURE_NOW }))).toContain("role=\"alert\"");
  });
});

describe("IntegrationCards", () => {
  it("shows each service with present or absent variables and its activity", () => {
    const html = render(createElement(IntegrationCards, { data: buildIntegrationsFixture(), loading: false, error: null, onRetry: () => undefined, nowMs: SYSTEM_FIXTURE_NOW }));
    expect(html).toContain("Stripe");
    expect(html).toContain("Clé secrète (STRIPE_SECRET_KEY)<span class=\"text-muted-foreground\"> : présent");
    expect(html).toContain("OPENAI_API_KEY<span class=\"text-muted-foreground\"> : absent");
    expect(html).toContain("co***@pace-yourself.com");
    expect(html).toContain("Too many requests");
    expect(html).toContain("Trail des Aiguilles · 42 km");
    expect(html).not.toContain("ssssssss");
  });
});
