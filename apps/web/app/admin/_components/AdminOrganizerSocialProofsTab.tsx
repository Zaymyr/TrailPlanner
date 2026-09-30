"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { cn } from "../../../components/utils";
import {
  organizerSocialProofAdminResponseSchema,
  organizerSocialProofSchema,
  type OrganizerSocialProof,
  type OrganizerSocialProofEdition,
} from "../../../lib/organizer-social-proof";

type Draft = {
  displayOrder: number;
  quoteText: string;
  quoteAuthorName: string;
  quoteAuthorRole: string;
  consentConfirmed: boolean;
};

const emptyDraft: Draft = {
  displayOrder: 0,
  quoteText: "",
  quoteAuthorName: "",
  quoteAuthorRole: "",
  consentConfirmed: false,
};

const toDraft = (proof: OrganizerSocialProof | undefined): Draft => proof
  ? {
      displayOrder: proof.displayOrder,
      quoteText: proof.quoteText ?? "",
      quoteAuthorName: proof.quoteAuthorName ?? "",
      quoteAuthorRole: proof.quoteAuthorRole ?? "",
      consentConfirmed: Boolean(proof.consentConfirmedAt),
    }
  : emptyDraft;

const normalizeEditionSearch = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr")
  .trim();

const formatEditionLabel = (edition: OrganizerSocialProofEdition) =>
  `${edition.eventName} · ${edition.editionYear}${edition.location ? ` · ${edition.location}` : ""}`;

export function filterOrganizerSocialProofEditions(
  editions: OrganizerSocialProofEdition[],
  query: string,
) {
  const terms = normalizeEditionSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return editions;

  return editions.filter((edition) => {
    const searchableValue = normalizeEditionSearch(formatEditionLabel(edition));
    return terms.every((term) => searchableValue.includes(term));
  });
}

export function AdminOrganizerSocialProofsTab({ accessToken }: { accessToken: string | null }) {
  const editionListboxId = useId();
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [editionQuery, setEditionQuery] = useState("");
  const [isEditionListOpen, setIsEditionListOpen] = useState(false);
  const [highlightedEditionIndex, setHighlightedEditionIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dataQuery = useQuery({
    queryKey: ["admin", "organizer-social-proofs", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error("Session administrateur manquante.");
      const response = await fetch("/api/admin/organizer-social-proofs", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Impossible de charger les preuves sociales.");
      return organizerSocialProofAdminResponseSchema.parse(payload);
    },
  });

  const selectedProof = useMemo(
    () => dataQuery.data?.proofs.find((proof) => proof.editionId === selectedEditionId),
    [dataQuery.data?.proofs, selectedEditionId],
  );
  const selectedEdition = useMemo(
    () => dataQuery.data?.editions.find((edition) => edition.id === selectedEditionId),
    [dataQuery.data?.editions, selectedEditionId],
  );
  const filteredEditions = useMemo(
    () => filterOrganizerSocialProofEditions(dataQuery.data?.editions ?? [], editionQuery),
    [dataQuery.data?.editions, editionQuery],
  );

  useEffect(() => {
    if (!selectedEditionId && dataQuery.data?.editions[0]) {
      setSelectedEditionId(dataQuery.data.editions[0].id);
    }
  }, [dataQuery.data?.editions, selectedEditionId]);

  useEffect(() => {
    setDraft(toDraft(selectedProof));
    setMessage(null);
    setError(null);
  }, [selectedEditionId, selectedProof]);

  useEffect(() => {
    if (!isEditionListOpen) {
      setEditionQuery(selectedEdition ? formatEditionLabel(selectedEdition) : "");
    }
  }, [isEditionListOpen, selectedEdition]);

  const openEditionList = () => {
    if (isEditionListOpen) return;
    setEditionQuery("");
    setHighlightedEditionIndex(0);
    setIsEditionListOpen(true);
  };

  const closeEditionList = () => {
    setIsEditionListOpen(false);
    setEditionQuery(selectedEdition ? formatEditionLabel(selectedEdition) : "");
  };

  const selectEdition = (edition: OrganizerSocialProofEdition) => {
    setSelectedEditionId(edition.id);
    setEditionQuery(formatEditionLabel(edition));
    setHighlightedEditionIndex(0);
    setIsEditionListOpen(false);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ status, refreshStats }: { status: "draft" | "published"; refreshStats: boolean }) => {
      if (!accessToken || !selectedEditionId) throw new Error("Sélectionnez une édition.");
      const response = await fetch("/api/admin/organizer-social-proofs", {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: selectedEditionId,
          status,
          displayOrder: draft.displayOrder,
          quoteText: draft.quoteText || null,
          quoteAuthorName: draft.quoteAuthorName || null,
          quoteAuthorRole: draft.quoteAuthorRole || null,
          consentConfirmed: draft.consentConfirmed,
          refreshStats,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Impossible d’enregistrer la preuve sociale.");
      return organizerSocialProofSchema.parse(payload?.proof);
    },
    onSuccess: async (proof) => {
      setError(null);
      setMessage(proof.status === "published" ? "La preuve est publiée sur la page Organisateurs." : "Le brouillon est enregistré.");
      await dataQuery.refetch();
    },
    onError: (caught) => {
      setMessage(null);
      setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer la preuve sociale.");
    },
  });

  const save = (status: "draft" | "published", refreshStats: boolean) => {
    setMessage(null);
    setError(null);
    saveMutation.mutate({ status, refreshStats });
  };

  if (dataQuery.isLoading) return <p className="text-sm text-muted-foreground">Chargement des preuves sociales…</p>;
  if (dataQuery.isError) {
    return <p className="text-sm text-red-600 dark:text-red-300">{dataQuery.error instanceof Error ? dataQuery.error.message : "Chargement impossible."}</p>;
  }
  if (!dataQuery.data?.editions.length) {
    return <p className="text-sm text-muted-foreground">Aucune édition organisateur n’est disponible.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Preuves sociales organisateurs</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Sélectionnez une édition réellement utilisée, récupérez ses statistiques RaceBook puis publiez-la automatiquement sur la page Organisateurs.
        </p>
      </div>

      <div className={cn("relative z-20 max-w-2xl space-y-2", isEditionListOpen && "z-50")}>
        <Label htmlFor="social-proof-edition">Trail / édition</Label>
        <div className="relative">
          <Input
            id="social-proof-edition"
            type="search"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={isEditionListOpen}
            aria-controls={editionListboxId}
            aria-activedescendant={isEditionListOpen && filteredEditions[highlightedEditionIndex]
              ? `${editionListboxId}-${filteredEditions[highlightedEditionIndex].id}`
              : undefined}
            value={editionQuery}
            placeholder="Rechercher un trail, une année ou un lieu…"
            className="pr-10"
            onFocus={openEditionList}
            onClick={openEditionList}
            onBlur={closeEditionList}
            onChange={(event) => {
              setEditionQuery(event.target.value);
              setHighlightedEditionIndex(0);
              setIsEditionListOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeEditionList();
                event.currentTarget.blur();
                return;
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (!isEditionListOpen) {
                  openEditionList();
                  return;
                }
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setHighlightedEditionIndex((current) => filteredEditions.length === 0
                  ? 0
                  : (current + direction + filteredEditions.length) % filteredEditions.length);
                return;
              }
              if (event.key === "Enter" && isEditionListOpen && filteredEditions[highlightedEditionIndex]) {
                event.preventDefault();
                selectEdition(filteredEditions[highlightedEditionIndex]);
              }
            }}
          />
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition",
              isEditionListOpen && "rotate-180",
            )}
          >
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {isEditionListOpen ? (
          <div
            id={editionListboxId}
            role="listbox"
            aria-label="Trails et éditions"
            className="absolute left-0 right-0 top-[calc(100%+0.35rem)] max-h-72 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl"
          >
            {filteredEditions.length > 0 ? filteredEditions.map((edition, index) => (
              <button
                key={edition.id}
                id={`${editionListboxId}-${edition.id}`}
                type="button"
                role="option"
                aria-selected={edition.id === selectedEditionId}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedEditionIndex(index)}
                onClick={() => selectEdition(edition)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-4 rounded px-3 py-2 text-left text-sm text-foreground",
                  index === highlightedEditionIndex ? "bg-brand-surface" : "hover:bg-muted/50",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{edition.eventName} · {edition.editionYear}</span>
                  {edition.location ? <span className="block truncate text-xs text-muted-foreground">{edition.location}</span> : null}
                </span>
                {edition.id === selectedEditionId ? <span className="shrink-0 text-xs font-semibold text-brand">Sélectionné</span> : null}
              </button>
            )) : (
              <p className="px-3 py-3 text-sm text-muted-foreground">Aucun trail trouvé.</p>
            )}
          </div>
        ) : null}
      </div>

      {selectedEdition ? (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Contenu public</CardTitle>
              <p className="text-sm text-muted-foreground">Le témoignage est facultatif. Les statistiques sont toujours calculées par le serveur.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="social-proof-quote">Témoignage de l’organisateur</Label>
                <textarea
                  id="social-proof-quote"
                  className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  maxLength={1000}
                  placeholder="Le Livret nous a permis de…"
                  value={draft.quoteText}
                  onChange={(event) => setDraft((current) => ({ ...current, quoteText: event.target.value }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="social-proof-author">Nom de la personne</Label>
                  <Input
                    id="social-proof-author"
                    maxLength={160}
                    value={draft.quoteAuthorName}
                    onChange={(event) => setDraft((current) => ({ ...current, quoteAuthorName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social-proof-role">Fonction</Label>
                  <Input
                    id="social-proof-role"
                    maxLength={160}
                    placeholder="Directrice de course"
                    value={draft.quoteAuthorRole}
                    onChange={(event) => setDraft((current) => ({ ...current, quoteAuthorRole: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-proof-order">Ordre d’affichage</Label>
                <Input
                  id="social-proof-order"
                  className="max-w-32"
                  type="number"
                  min={0}
                  max={999}
                  value={draft.displayOrder}
                  onChange={(event) => setDraft((current) => ({ ...current, displayOrder: Number(event.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">La valeur la plus basse est affichée en premier sous le hero.</p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
                <input
                  className="mt-1 h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={draft.consentConfirmed}
                  onChange={(event) => setDraft((current) => ({ ...current, consentConfirmed: event.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">Autorisation de publication obtenue</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">Confirme l’accord pour afficher le nom de la course, ses statistiques et le témoignage éventuel.</span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aperçu et statistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{selectedEdition.eventName} · {selectedEdition.editionYear}</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{(selectedProof?.uniqueReaders ?? 0).toLocaleString("fr-FR")}</p>
                <p className="text-sm text-muted-foreground">lecteurs uniques estimés</p>
                <p className="mt-3 text-sm text-foreground">{(selectedProof?.totalOpens ?? 0).toLocaleString("fr-FR")} ouvertures du Livret</p>
                {draft.quoteText ? <blockquote className="mt-5 border-l-2 border-brand pl-4 text-sm italic leading-6 text-foreground">« {draft.quoteText} »</blockquote> : null}
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Statut</dt><dd className="font-medium text-foreground">{selectedProof?.status === "published" ? "Publié" : "Brouillon"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Dernière mesure</dt><dd className="text-right font-medium text-foreground">{selectedProof?.analyticsCapturedAt ? new Date(selectedProof.analyticsCapturedAt).toLocaleString("fr-FR") : "Jamais"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Période</dt><dd className="text-right font-medium text-foreground">{selectedProof?.analyticsFrom && selectedProof.analyticsTo ? `${selectedProof.analyticsFrom} → ${selectedProof.analyticsTo}` : "Non mesurée"}</dd></div>
              </dl>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => save("draft", false)}>
          Enregistrer en brouillon
        </Button>
        <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => save(selectedProof?.status ?? "draft", true)}>
          Actualiser les statistiques
        </Button>
        <Button type="button" disabled={saveMutation.isPending || !draft.consentConfirmed} onClick={() => save("published", true)}>
          {saveMutation.isPending ? "Enregistrement…" : "Publier sur la page Organisateurs"}
        </Button>
        {selectedProof?.status === "published" ? (
          <Button type="button" variant="outline" className="text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:text-red-300" disabled={saveMutation.isPending} onClick={() => save("draft", false)}>
            Dépublier
          </Button>
        ) : null}
      </div>
    </div>
  );
}
