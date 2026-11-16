"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { handledRowClassName } from "./admin-message-template";

const statusSchema = z.enum(["pending", "completed", "rejected"]);
type DemoStatus = z.infer<typeof statusSchema>;
const responseSchema = z.object({
  available: z.boolean(),
  requests: z.array(z.object({
    id: z.string().uuid(),
    createdAt: z.string(),
    email: z.string(),
    raceUrl: z.string(),
    phone: z.string().nullable(),
    source: z.string().nullable(),
    status: statusSchema,
    reviewedAt: z.string().nullable(),
    confirmationEmailStatus: z.string().nullable(),
  })),
});

const statusLabels: Record<DemoStatus, string> = { pending: "À traiter", completed: "Traitée", rejected: "Sans suite" };
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Organizer demo requests from /organisateurs, shown above runner race requests. */
export function AdminDemoRequestsSection({ accessToken, onChanged }: { accessToken: string | null; onChanged?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin", "organizer-demo-requests", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error("Session admin manquante.");
      const response = await fetch("/api/admin/organizer-demo-requests", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Impossible de charger les demandes de démo.");
      return responseSchema.parse(payload);
    },
  });

  const setStatus = async (id: string, status: DemoStatus) => {
    if (!accessToken) return;
    setError(null);
    const response = await fetch("/api/admin/organizer-demo-requests", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      setError("Impossible de mettre à jour la demande de démo.");
      return;
    }
    await query.refetch();
    onChanged?.();
  };

  const rows = query.data?.requests ?? [];

  return (
    <section aria-labelledby="admin-demo-requests-heading" className="space-y-3">
      <h3 id="admin-demo-requests-heading" className="text-base font-semibold text-foreground">Demandes de démo organisateur</h3>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {query.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {query.error ? <p role="alert" className="text-sm text-red-600">{query.error instanceof Error ? query.error.message : "Erreur"}</p> : null}
      {query.data && !query.data.available ? (
        <p className="text-sm text-muted-foreground">La table des demandes de démo n’est pas encore déployée : les demandes arrivent pour l’instant par e-mail.</p>
      ) : null}
      {query.data?.available && rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande de démo.</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Course</TableHead><TableHead>Contact</TableHead><TableHead>Reçue</TableHead><TableHead>Statut</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className={handledRowClassName(row.status)}>
                  <TableCell className="max-w-xs">
                    <a href={row.raceUrl} target="_blank" rel="noreferrer" className="break-all font-semibold text-brand hover:underline">{row.raceUrl}</a>
                    {row.source ? <div className="text-xs text-muted-foreground">Source : {row.source}</div> : null}
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${row.email}`} className="hover:underline">{row.email}</a>
                    {row.phone ? <div className="text-xs text-muted-foreground"><a href={`tel:${row.phone.replace(/\s/g, "")}`}>{row.phone}</a></div> : null}
                    {row.confirmationEmailStatus && row.confirmationEmailStatus !== "sent" ? (
                      <div className="text-xs text-amber-700">Accusé de réception non envoyé</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{dateFormatter.format(new Date(row.createdAt))}</TableCell>
                  <TableCell>{statusLabels[row.status]}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.status === "pending" ? (
                        <>
                          <Button type="button" className="h-8 px-2 text-xs" onClick={() => void setStatus(row.id, "completed")}>Traitée</Button>
                          <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => void setStatus(row.id, "rejected")}>Sans suite</Button>
                        </>
                      ) : (
                        <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => void setStatus(row.id, "pending")}>Rouvrir</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
