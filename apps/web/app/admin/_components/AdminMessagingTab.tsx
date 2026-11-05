"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { TabsList } from "../../../components/ui/tabs";
import { AdminFeedbackTab } from "./AdminFeedbackTab";
import { AdminRaceRequestsTab } from "./AdminRaceRequestsTab";

const countsSchema = z.object({ bug: z.number(), feedback: z.number(), raceRequests: z.number() });
type InboxTab = "bug" | "feedback" | "race-requests";

const withCount = (label: string, count: number | undefined) => (count ? `${label} (${count})` : label);

/** Admin inbox: bugs, feedback and race requests, each with its pending count. */
export function AdminMessagingTab({ accessToken }: { accessToken: string | null }) {
  const [tab, setTab] = useState<InboxTab>("bug");
  const counts = useQuery({
    queryKey: ["admin", "inbox-counts", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const response = await fetch("/api/admin/inbox-counts", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Impossible de compter les messages.");
      return countsSchema.parse(await response.json());
    },
  });
  const refreshCounts = () => void counts.refetch();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messagerie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TabsList
          tabs={[
            { id: "bug", label: withCount("Bugs", counts.data?.bug) },
            { id: "feedback", label: withCount("Feedback", counts.data?.feedback) },
            { id: "race-requests", label: withCount("Demandes de course", counts.data?.raceRequests) },
          ]}
          activeTab={tab}
          onTabChange={(next) => setTab(next as InboxTab)}
        />
        {tab === "bug" ? <AdminFeedbackTab key="bug" accessToken={accessToken} kind="bug" onChanged={refreshCounts} /> : null}
        {tab === "feedback" ? <AdminFeedbackTab key="feedback" accessToken={accessToken} kind="feedback" onChanged={refreshCounts} /> : null}
        {tab === "race-requests" ? <AdminRaceRequestsTab accessToken={accessToken} onChanged={refreshCounts} /> : null}
      </CardContent>
    </Card>
  );
}
