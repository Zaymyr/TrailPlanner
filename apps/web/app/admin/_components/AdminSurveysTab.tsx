"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { MetricCard } from "../../../components/ui/MetricCard";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { adminMessageBody, adminMessageTitle } from "./admin-message-template";

const audienceSchema = z.object({
  eventId: z.string(),
  eventName: z.string(),
  readers: z.number(),
  lastOpenedAt: z.string().nullable(),
});
const previewSchema = z.object({
  identifiedReaders: z.number(),
  recipients: z.number(),
  withPush: z.number(),
  withEmail: z.number(),
});
const responseItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().nullable(),
  foundUseful: z.boolean(),
  usefulText: z.string().nullable(),
  missingText: z.string().nullable(),
  appVersion: z.string().nullable(),
  platform: z.string().nullable(),
  createdAt: z.string(),
});
const campaignSchema = z.object({
  id: z.string(),
  title: z.string(),
  audienceLabel: z.string().nullable(),
  pushRequested: z.boolean(),
  emailRequested: z.boolean(),
  createdAt: z.string(),
  stats: z.object({
    recipients: z.number(),
    read: z.number(),
    pushSent: z.number(),
    responses: z.number(),
    useful: z.number(),
    notUseful: z.number(),
  }),
  responses: z.array(responseItemSchema),
});
type Campaign = z.infer<typeof campaignSchema>;

/** Prefilled survey message. The body also reads well in app versions that cannot show the form yet. */
export const surveyDefaultCopy = (eventName: string) => ({
  title: adminMessageTitle(`Ton avis sur le livret coureur ${eventName}`),
  body: adminMessageBody(
    `Tu as consulté le livret coureur ${eventName} dans Pace Yourself. On aimerait savoir ce que tu en as pensé : trois questions rapides, une minute à peine. Tu peux répondre directement depuis ce message.\n\nSi le questionnaire ne s’affiche pas, mets à jour l’application.`
  ),
});

export const formatRate = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)} %` : "—";

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : value;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "La requête a échoué.");

async function adminFetch<T>(accessToken: string | null, url: string, schema: z.ZodType<T>, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : null;
    throw new Error(message || "La requête a échoué.");
  }
  return schema.parse(payload);
}

function SurveySendForm({ accessToken, onSent }: { accessToken: string | null; onSent: () => void }) {
  const [eventId, setEventId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendPush, setSendPush] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [campaignId, setCampaignId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const audiences = useQuery({
    queryKey: ["admin", "feedback-surveys", "audiences", accessToken],
    enabled: Boolean(accessToken),
    queryFn: () =>
      adminFetch(accessToken, "/api/admin/feedback-surveys/audiences", z.object({ audiences: z.array(audienceSchema) })),
  });
  const preview = useQuery({
    queryKey: ["admin", "feedback-surveys", "preview", eventId, accessToken],
    enabled: Boolean(accessToken && eventId),
    queryFn: () =>
      adminFetch(
        accessToken,
        `/api/admin/feedback-surveys/audiences?eventId=${encodeURIComponent(eventId)}`,
        z.object({ preview: previewSchema })
      ),
  });
  const selected = useMemo(
    () => audiences.data?.audiences.find((audience) => audience.eventId === eventId) ?? null,
    [audiences.data, eventId]
  );

  useEffect(() => {
    if (!selected) return;
    const copy = surveyDefaultCopy(selected.eventName);
    setTitle(copy.title);
    setBody(copy.body);
  }, [selected]);

  const recipients = preview.data?.preview.recipients ?? 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !title.trim() || !body.trim()) {
      setError("Choisis un livret, un titre et un message.");
      return;
    }
    if (!window.confirm(`Envoyer ce questionnaire à ${recipients} coureurs ?`)) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const sent = await adminFetch(
        accessToken,
        "/api/admin/feedback-surveys",
        z.object({
          audience: previewSchema,
          delivery: z.object({ delivered: z.number(), pushSent: z.number(), pushUnavailable: z.number(), failed: z.number() }),
        }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            eventId: selected.eventId,
            eventLabel: selected.eventName,
            title: title.trim(),
            body: body.trim(),
            sendPush,
            sendEmail,
          }),
        }
      );
      setResult(
        `Envoyé à ${sent.audience.recipients} coureurs — push reçu par ${sent.delivery.pushSent}` +
          (sent.delivery.failed ? `, ${sent.delivery.failed} échec(s)` : "") +
          "."
      );
      setCampaignId(crypto.randomUUID());
      setEventId("");
      onSent();
    } catch (caught) {
      // The campaign id is kept: sending again resumes the same campaign without duplicates.
      setError(caught instanceof Error ? caught.message : "Impossible d’envoyer le questionnaire.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4 rounded-lg border border-border p-4" onSubmit={handleSubmit}>
      <div>
        <h3 className="text-base font-semibold">Nouveau questionnaire</h3>
        <p className="text-sm text-muted-foreground">
          Trois questions (utile ? ce qui a servi, ce qui a manqué). Les coureurs répondent dans l’app ; s’ils
          trouvent l’app utile, elle leur propose ensuite de laisser un avis sur le Store.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="survey-audience">Coureurs ayant ouvert le livret de…</Label>
        <select
          id="survey-audience"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          disabled={submitting || audiences.isLoading}
        >
          <option value="">{audiences.isLoading ? "Chargement…" : "Choisir un événement"}</option>
          {audiences.data?.audiences.map((audience) => (
            <option key={audience.eventId} value={audience.eventId}>
              {audience.eventName} — {audience.readers} lecteurs
            </option>
          ))}
        </select>
        {audiences.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-300">{errorMessage(audiences.error)}</p>
        ) : null}
        {eventId ? (
          <p className="text-sm text-muted-foreground">
            {preview.isLoading
              ? "Calcul de l’audience…"
              : preview.data
                ? `${preview.data.preview.recipients} coureurs joignables (compte) · ${preview.data.preview.withPush} avec le push · ${preview.data.preview.withEmail} avec un e-mail. Les lecteurs sans compte ne peuvent pas être contactés.`
                : preview.error ? errorMessage(preview.error) : null}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="survey-title">Titre</Label>
        <Input id="survey-title" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} disabled={submitting} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="survey-body">Message</Label>
        <textarea
          id="survey-body"
          className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={submitting}
        />
      </div>
      <fieldset className="space-y-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-semibold">Canaux</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked disabled />
          Message dans l’application (obligatoire)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendPush} onChange={(event) => setSendPush(event.target.checked)} disabled={submitting} />
          Notification push
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} disabled={submitting} />
          E-mail via Resend
        </label>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      {result ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{result}</p> : null}
      <Button type="submit" disabled={submitting || !selected || recipients === 0}>
        {submitting ? "Envoi en cours…" : recipients ? `Envoyer à ${recipients} coureurs` : "Envoyer"}
      </Button>
    </form>
  );
}

function CampaignResults({ campaign }: { campaign: Campaign }) {
  const [filter, setFilter] = useState<"all" | "useful" | "not-useful">("all");
  const { stats } = campaign;
  const responses = campaign.responses.filter((response) =>
    filter === "all" ? true : filter === "useful" ? response.foundUseful : !response.foundUseful
  );

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-base font-semibold">{campaign.title}</h3>
        <p className="text-sm text-muted-foreground">
          {campaign.audienceLabel ?? "Audience"} · envoyé le {formatDate(campaign.createdAt)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="Destinataires" value={String(stats.recipients)} helper={`${stats.pushSent} push reçus`} />
        <MetricCard label="Lus" value={String(stats.read)} helper={formatRate(stats.read, stats.recipients)} />
        <MetricCard label="Réponses" value={String(stats.responses)} helper={`${formatRate(stats.responses, stats.recipients)} de réponse`} />
        <MetricCard label="Utile" value={formatRate(stats.useful, stats.responses)} helper={`${stats.useful} oui · ${stats.notUseful} non`} />
      </div>
      {campaign.responses.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            {(["all", "useful", "not-useful"] as const).map((value) => (
              <Button key={value} type="button" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>
                {value === "all" ? "Toutes" : value === "useful" ? "Utile" : "Pas utile"}
              </Button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Coureur</TableHead>
                  <TableHead>Utile</TableHead>
                  <TableHead>Ce qui a servi</TableHead>
                  <TableHead>Ce qui a manqué</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(response.createdAt)}</TableCell>
                    <TableCell className="text-xs">
                      {response.userName ?? response.userId.slice(0, 8)}
                      {response.platform ? <span className="block text-muted-foreground">{response.platform} {response.appVersion ?? ""}</span> : null}
                    </TableCell>
                    <TableCell>{response.foundUseful ? "Oui" : "Non"}</TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{response.usefulText ?? "—"}</TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{response.missingText ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune réponse pour l’instant.</p>
      )}
    </section>
  );
}

/** Admin feedback surveys: send a 3-question survey to a livret coureur's readers, then read the answers. */
export function AdminSurveysTab({ accessToken }: { accessToken: string | null }) {
  const campaigns = useQuery({
    queryKey: ["admin", "feedback-surveys", accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => adminFetch(accessToken, "/api/admin/feedback-surveys", z.object({ campaigns: z.array(campaignSchema) })),
  });

  return (
    <div className="space-y-4">
      <SurveySendForm accessToken={accessToken} onSent={() => void campaigns.refetch()} />
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Résultats</h3>
        <Button type="button" variant="outline" onClick={() => void campaigns.refetch()}>
          Rafraîchir
        </Button>
      </div>
      {campaigns.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {campaigns.error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{errorMessage(campaigns.error)}</p> : null}
      {campaigns.data?.campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun questionnaire envoyé.</p>
      ) : null}
      {campaigns.data?.campaigns.map((campaign) => <CampaignResults key={campaign.id} campaign={campaign} />)}
    </div>
  );
}
