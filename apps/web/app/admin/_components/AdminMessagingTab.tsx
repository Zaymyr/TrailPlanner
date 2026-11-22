"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { TabsList } from "../../../components/ui/tabs";
import { AdminFeedbackTab } from "./AdminFeedbackTab";
import { AdminDemoRequestsSection } from "./AdminDemoRequestsSection";
import { AdminRaceRequestsTab } from "./AdminRaceRequestsTab";
import { AdminSurveysTab } from "./AdminSurveysTab";
import { MESSAGING_VIEWS, readMessagingView, replaceLocationSearch, searchForView, type MessagingView } from "../admin-tabs";
import { useInboxCounts, withCount } from "./useInboxCounts";

type InboxTab = "bug" | "feedback" | "race-requests" | "demo-requests" | "surveys";

const VIEW_FOR_TAB: Record<InboxTab, MessagingView> = { bug: "bugs", feedback: "feedback", "race-requests": "demandes", "demo-requests": "demos", surveys: "questionnaires" };
const TAB_FOR_VIEW = Object.fromEntries(MESSAGING_VIEWS.map((view) => [view, (Object.keys(VIEW_FOR_TAB) as InboxTab[]).find((tab) => VIEW_FOR_TAB[tab] === view)])) as Record<MessagingView, InboxTab>;

/**
 * Admin inbox: bugs, feedback, race and demo requests, each with its pending count, plus feedback
 * surveys. `views` limits the sub-tabs (the console « À traiter » page leaves the surveys out: they
 * have their own page); `title` replaces the card title.
 */
export function AdminMessagingTab({ accessToken, views = MESSAGING_VIEWS, title = "Messagerie" }: { accessToken: string | null; views?: readonly MessagingView[]; title?: string }) {
  const allowedTabs = views.map((view) => TAB_FOR_VIEW[view]);
  const [tab, setTabState] = useState<InboxTab>(() => {
    const requested = TAB_FOR_VIEW[readMessagingView(typeof window === "undefined" ? "" : window.location.search)];
    return allowedTabs.includes(requested) ? requested : allowedTabs[0] ?? "bug";
  });
  const setTab = (next: InboxTab) => {
    setTabState(next);
    replaceLocationSearch(searchForView(window.location.search, VIEW_FOR_TAB[next], "bugs"));
  };
  const counts = useInboxCounts(accessToken);
  const refreshCounts = () => void counts.refetch();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TabsList
          tabs={[
            { id: "bug", label: withCount("Bugs", counts.data?.bug) },
            { id: "feedback", label: withCount("Feedback", counts.data?.feedback) },
            { id: "race-requests", label: withCount("Demandes de course", counts.data?.raceRequests) },
            { id: "demo-requests", label: withCount("Démos organisateurs", counts.data?.demoRequests) },
            { id: "surveys", label: "Questionnaires" },
          ].filter((entry) => allowedTabs.includes(entry.id as InboxTab))}
          activeTab={tab}
          onTabChange={(next) => setTab(next as InboxTab)}
        />
        {tab === "bug" ? <AdminFeedbackTab key="bug" accessToken={accessToken} kind="bug" onChanged={refreshCounts} /> : null}
        {tab === "feedback" ? <AdminFeedbackTab key="feedback" accessToken={accessToken} kind="feedback" onChanged={refreshCounts} /> : null}
        {tab === "race-requests" ? (
          <section aria-labelledby="admin-race-requests-heading" className="space-y-3">
            <h3 id="admin-race-requests-heading" className="text-base font-semibold text-foreground">Demandes de course des coureurs</h3>
            <AdminRaceRequestsTab accessToken={accessToken} onChanged={refreshCounts} />
          </section>
        ) : null}
        {tab === "demo-requests" ? <AdminDemoRequestsSection accessToken={accessToken} onChanged={refreshCounts} /> : null}
        {tab === "surveys" ? <AdminSurveysTab accessToken={accessToken} /> : null}
      </CardContent>
    </Card>
  );
}
