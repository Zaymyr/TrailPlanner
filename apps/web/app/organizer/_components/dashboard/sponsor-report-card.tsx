"use client";

import React, { useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";

type Props = {
  editionId: string;
  authHeaders: Record<string, string>;
  /** Display hint only; the server route enforces the Signature / sponsors gate. */
  allowed: boolean;
  onOpenPricing: () => void;
};

type DownloadFormat = "pdf" | "csv";

const fileNameFrom = (disposition: string | null, fallback: string) =>
  disposition?.match(/filename="([^"]+)"/)?.[1] ?? fallback;

export function SponsorReportCard({ editionId, authHeaders, allowed, onOpenPricing }: Props) {
  const [pending, setPending] = useState<DownloadFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!allowed) {
    return (
      <Card className="border-brand/30 bg-brand/5">
        <CardHeader>
          <CardTitle>Rapport partenaires</CardTitle>
          <CardDescription>
            Inclus dans l’offre Signature : un bilan PDF et CSV à remettre à vos partenaires après la course (lecteurs du Livret coureur, impressions et clics par partenaire).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={onOpenPricing}>Découvrir l’offre Signature</Button>
        </CardContent>
      </Card>
    );
  }

  const download = async (format: DownloadFormat) => {
    setPending(format);
    setError(null);
    try {
      const response = await fetch(`/api/organizer/editions/${editionId}/sponsor-report?format=${format}`, {
        headers: authHeaders,
        cache: "no-store",
      });
      if (response.status === 403) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        setError(payload?.message ?? "Le rapport partenaires est inclus dans l’offre Signature.");
        return;
      }
      if (!response.ok) throw new Error("sponsor_report_unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFrom(response.headers.get("content-disposition"), `rapport-partenaires.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Rapport temporairement indisponible. Réessayez dans quelques minutes.");
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapport partenaires</CardTitle>
        <CardDescription>
          Bilan agrégé et anonyme de l’édition : lecteurs du Livret coureur, impressions, clics et meilleurs placements de chaque partenaire.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending !== null} onClick={() => void download("pdf")}>
            {pending === "pdf" ? "Préparation…" : "Télécharger le PDF"}
          </Button>
          <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void download("csv")}>
            {pending === "csv" ? "Préparation…" : "Exporter en CSV"}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
