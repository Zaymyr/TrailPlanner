"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { adminGrowthResponseSchema } from "../../api/admin/growth/schema";
import { type AdminTranslations } from "../../../locales/types";

type Props = { accessToken: string | null | undefined; t: AdminTranslations["growth"] };
const Kpi = ({ label, value }: { label: string; value: string | number }) => <div className="rounded border p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-semibold">{value}</p></div>;

export default function AdminGrowthSection({ accessToken, t }: Props) {
  const [range, setRange] = useState("last7");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const growthQuery = useQuery({
    queryKey: ["admin", "growth", accessToken, range, start, end],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const params = new URLSearchParams({ range });
      if (range === "custom" && start && end) { params.set("start", start); params.set("end", end); }
      const response = await fetch(`/api/admin/growth?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error((data as { message?: string }).message ?? t.loadError);
      const parsed = adminGrowthResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error(t.loadError);
      return parsed.data;
    },
  });
  const data = growthQuery.data;

  return <Card><CardHeader><CardTitle className="text-lg">{t.title}</CardTitle><p className="text-sm text-slate-600">{t.description}</p></CardHeader><CardContent className="space-y-4">
    <div className="flex flex-wrap gap-2 text-sm">
      {[["today","Today"],["yesterday","Yesterday"],["last7","Last 7 days"],["last30","Last 30 days"],["custom","Custom"]].map(([k,l])=><button key={k} onClick={()=>setRange(k)} className={`rounded border px-3 py-1 ${range===k?"bg-slate-900 text-white":""}`}>{l}</button>)}
      {range==="custom" && <><input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="rounded border px-2" /><input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="rounded border px-2" /></>}
    </div>
    {growthQuery.error ? <p className="text-sm text-red-600">{growthQuery.error instanceof Error ? growthQuery.error.message : t.loadError}</p> : null}
    {data ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="New anonymous users" value={data.kpis.newAnonymousUsers} />
        <Kpi label="New registered accounts" value={data.kpis.newRegisteredAccounts} />
        <Kpi label="New plans created" value={data.kpis.newPlansCreated} />
        <Kpi label="New saved/completed plans" value={data.kpis.newPlansCompletedOrSaved} />
        <Kpi label="Conversion anonymous → account" value={`${data.kpis.conversionAnonymousToAccount}%`} />
        <Kpi label="Conversion account → plan" value={`${data.kpis.conversionAccountToPlanCreated}%`} />
        <Kpi label="Conversion plan → saved/completed" value={`${data.kpis.conversionPlanCreatedToSavedOrCompleted}%`} />
        <Kpi label="Returning users J+1" value={data.kpis.returningUsersJ1 ?? "N/A"} />
        <Kpi label="Returning users J+7" value={data.kpis.returningUsersJ7 ?? "N/A"} />
        <Kpi label="Profiles with added data" value={data.kpis.profilesWithDetails} />
        <Kpi label="Users with favorite product" value={data.kpis.usersWithFavoriteProduct} />
      </div>
      <div><p className="mb-2 text-sm font-semibold">Funnel</p><Table><TableHeader><TableRow><TableHead>Step</TableHead><TableHead>Count</TableHead><TableHead>Conversion from previous</TableHead></TableRow></TableHeader><TableBody>{data.funnel.map((row)=><TableRow key={row.step}><TableCell>{row.step}</TableCell><TableCell>{row.count}</TableCell><TableCell>{row.conversionFromPrevious===null?"-":`${row.conversionFromPrevious}%`}</TableCell></TableRow>)}</TableBody></Table></div>
      <div><p className="mb-2 text-sm font-semibold">Source / Campaign</p><Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Campaign</TableHead><TableHead>Users</TableHead><TableHead>Accounts</TableHead><TableHead>Plans</TableHead></TableRow></TableHeader><TableBody>{data.bySource.map((r,i)=><TableRow key={`${r.source}-${i}`}><TableCell>{r.source}</TableCell><TableCell>{r.campaign}</TableCell><TableCell>{r.users}</TableCell><TableCell>{r.accounts}</TableCell><TableCell>{r.plansCreated}</TableCell></TableRow>)}</TableBody></Table></div>
      {data.todos.length>0 ? <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"><p className="font-semibold">TODO / Missing tracking data</p><ul className="list-disc pl-5">{data.todos.map((todo)=><li key={todo}>{todo}</li>)}</ul></div> : null}
    </> : null}
  </CardContent></Card>;
}
