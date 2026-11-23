"use client";

import { useRef, useState, type ReactNode } from "react";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { useToast } from "../../../../components/ui/Toast";
import { CRON_RUN_KEYS, SCHEDULED_TASKS, type CronRunKey, type ScheduledTask } from "../../../../lib/admin-system-health";
import { formatRelativePast } from "../../../../lib/admin-overview";
import { adminFetch } from "../../publications/publications-api";
import { DashboardCard } from "../overview/OverviewCards";
import {
  addResendSyncBatch,
  backfillResponseSchema,
  BETRAIL_IMPORT_COMMANDS,
  cleanupMayHaveMore,
  cleanupResponseSchema,
  cronRunResponseSchema,
  emptyResendTotals,
  formatCronResult,
  nextResendSyncPage,
  resendSyncBody,
  resendSyncResponseSchema,
  type BackfillResponse,
  type CleanupResponse,
  type CronRunResponse,
  type ResendSyncTotals,
} from "./maintenance-plan";
import { errorMessage } from "./system-api";

/**
 * « Maintenance » (lot 3): buttons for the admin routes that had no screen. Each one explains what it
 * does, asks a confirmation proportionate to its effect and shows its result. The Betrail import
 * stays a local script (it reads a CSV): its command is shown, no button.
 */

const DISABLED = "disabled:cursor-not-allowed disabled:opacity-50";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ConfirmState = { title: string; description: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void } | null;

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-lg" aria-labelledby="maintenance-confirm-title">
        <DialogHeader>
          <DialogTitle id="maintenance-confirm-title">{state?.title}</DialogTitle>
          <DialogDescription>{state?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            type="button"
            className={state?.danger ? "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500" : undefined}
            onClick={() => {
              const action = state?.onConfirm;
              onClose();
              action?.();
            }}
          >
            {state?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <DashboardCard title={title} labelId={`maintenance-${id}`}>
      <div className="space-y-3 px-4 pb-4 text-sm">{children}</div>
    </DashboardCard>
  );
}

function ResultBox({ tone, children }: { tone: "ok" | "warning" | "error"; children: ReactNode }) {
  const classes = tone === "ok"
    ? "bg-[#eef3e6] text-[#24400f] dark:bg-emerald-950/60 dark:text-emerald-100"
    : tone === "warning"
      ? "bg-[#fef1e6] text-[#8a3f0b] dark:bg-orange-950/60 dark:text-orange-100"
      : "bg-[#fdecec] text-[#9b2c2c] dark:bg-red-950/60 dark:text-red-100";
  return <div role="status" aria-live="polite" className={`rounded-lg px-3 py-2.5 text-[13px] ${classes}`}>{children}</div>;
}

// ---------------------------------------------------------------------------------------------
// Resend sync

type SyncRun = { mode: "dryRun" | "real"; running: boolean; totals: ResendSyncTotals; nextPage: number | null; error: string | null; waitingMs: number };

function ResendSyncCard({ accessToken, onConfirm }: { accessToken: string; onConfirm: (state: ConfirmState) => void }) {
  const [run, setRun] = useState<SyncRun | null>(null);
  const [dryRunDone, setDryRunDone] = useState<ResendSyncTotals | null>(null);
  const stopRef = useRef(false);

  const start = async (mode: "dryRun" | "real") => {
    stopRef.current = false;
    let totals = emptyResendTotals();
    let page: number | null = 1;
    setRun({ mode, running: true, totals, nextPage: page, error: null, waitingMs: 0 });
    while (page !== null && !stopRef.current) {
      const response = await fetch("/api/admin/resend/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(resendSyncBody(mode === "dryRun", page)),
        cache: "no-store",
      }).catch(() => null);
      if (response?.status === 429) {
        // The route allows 4 calls per minute: wait for the window and retry the same page.
        const payload = (await response.json().catch(() => null)) as { retryAfter?: number } | null;
        const waitMs = Math.min(65_000, Math.max(5_000, Number(payload?.retryAfter) || 15_000));
        setRun({ mode, running: true, totals, nextPage: page, error: null, waitingMs: waitMs });
        await sleep(waitMs);
        continue;
      }
      if (!response || !response.ok) {
        const payload = response ? ((await response.json().catch(() => null)) as { message?: string } | null) : null;
        setRun({ mode, running: false, totals, nextPage: page, error: payload?.message ?? "La synchronisation a échoué.", waitingMs: 0 });
        return;
      }
      const batch = resendSyncResponseSchema.parse(await response.json());
      totals = addResendSyncBatch(totals, batch);
      page = nextResendSyncPage(batch.summary);
      setRun({ mode, running: page !== null && !stopRef.current, totals, nextPage: page, error: null, waitingMs: 0 });
    }
    setRun((current) => (current ? { ...current, running: false } : current));
    if (mode === "dryRun" && page === null) setDryRunDone(totals);
  };

  const totals = run?.totals;
  return (
    <ActionCard id="resend" title="Synchroniser les contacts Resend">
      <p className="text-muted-foreground">
        Crée ou met à jour un contact Resend pour chaque compte Supabase ayant un e-mail (comptes anonymes exclus), par pages de 100.
        Les contacts sont envoyés <b className="font-semibold text-foreground">désabonnés</b> (aucun consentement marketing n’est connu) :
        les contacts existants passent aussi en désabonné. Commence par la simulation, qui ne contacte pas Resend.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={DISABLED} disabled={run?.running} onClick={() => void start("dryRun")}>Simuler la synchronisation</Button>
        <Button
          type="button"
          className={DISABLED}
          disabled={run?.running || !dryRunDone}
          title={dryRunDone ? undefined : "Lance d’abord la simulation"}
          onClick={() => onConfirm({
            title: "Synchroniser réellement les contacts ?",
            description: `La simulation prévoit ${dryRunDone?.prepared ?? 0} contact(s). Chaque contact est créé ou mis à jour dans Resend en désabonné ; l’opération prend environ une minute par centaine de contacts et ne peut pas être annulée dans Resend.`,
            confirmLabel: "Synchroniser",
            danger: true,
            onConfirm: () => void start("real"),
          })}
        >
          Synchroniser pour de vrai
        </Button>
        {run?.running ? <Button type="button" variant="ghost" onClick={() => { stopRef.current = true; }}>Arrêter après la page en cours</Button> : null}
      </div>
      {run && totals ? (
        <ResultBox tone={run.error ? "error" : totals.failed ? "warning" : "ok"}>
          <p className="font-semibold">
            {run.mode === "dryRun" ? "Simulation" : "Synchronisation"} {run.running ? "en cours" : run.error ? "interrompue" : stopRef.current && run.nextPage !== null ? "arrêtée" : "terminée"}
            {run.waitingMs ? ` · limite de débit, reprise dans ${Math.round(run.waitingMs / 1000)} s` : ""}
          </p>
          <p>
            {totals.pages} page(s), {totals.usersRead} compte(s) lus, {totals.prepared} contact(s) {run.mode === "dryRun" ? "à synchroniser" : "préparés"}, {totals.skipped} ignoré(s)
            {run.mode === "real" ? `, ${totals.created} créé(s), ${totals.updated} mis à jour, ${totals.failed} échec(s)` : ""}.
          </p>
          {run.error ? <p>{run.error}</p> : null}
          {totals.failures.length ? (
            <ul className="mt-1 list-disc pl-5">
              {totals.failures.slice(0, 5).map((failure) => <li key={failure.userId}>{failure.email ?? failure.userId} : {failure.statusCode ? `HTTP ${failure.statusCode} · ` : ""}{failure.message}</li>)}
            </ul>
          ) : null}
        </ResultBox>
      ) : null}
    </ActionCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Livrets: backfill and cleanup

function RacebookCards({ accessToken, onConfirm }: { accessToken: string; onConfirm: (state: ConfirmState) => void }) {
  const [backfill, setBackfill] = useState<{ running: boolean; result: BackfillResponse | null; error: string | null }>({ running: false, result: null, error: null });
  const [cleanup, setCleanup] = useState<{ running: boolean; result: CleanupResponse | null; total: number; error: string | null }>({ running: false, result: null, total: 0, error: null });

  const runBackfill = async () => {
    setBackfill({ running: true, result: null, error: null });
    try {
      const result = await adminFetch(accessToken, "/api/admin/racebook-publications/backfill", backfillResponseSchema, { method: "POST", body: {} }, "Le rattrapage a échoué.");
      setBackfill({ running: false, result, error: null });
    } catch (error) {
      setBackfill({ running: false, result: null, error: errorMessage(error, "Le rattrapage a échoué.") });
    }
  };
  const runCleanup = async () => {
    setCleanup((current) => ({ ...current, running: true, error: null }));
    try {
      const result = await adminFetch(accessToken, "/api/admin/racebook-publications/cleanup", cleanupResponseSchema, { method: "POST", body: {} }, "Le nettoyage a échoué.");
      setCleanup((current) => ({ running: false, result, total: current.total + result.processed, error: null }));
    } catch (error) {
      setCleanup((current) => ({ ...current, running: false, error: errorMessage(error, "Le nettoyage a échoué.") }));
    }
  };

  return (
    <>
      <ActionCard id="backfill" title="Rattraper les livrets publiés sans version">
        <p className="text-muted-foreground">
          Crée la première version figée des formats en ligne dont le livret est publié mais n’a encore aucune publication versionnée.
          Sans effet sur un livret qui a déjà une version (idempotent) ; les formats sont traités un par un.
        </p>
        <Button
          type="button"
          variant="outline"
          className={DISABLED}
          disabled={backfill.running}
          onClick={() => onConfirm({ title: "Lancer le rattrapage des livrets ?", description: "Chaque livret publié sans version reçoit sa première version, avec le contenu actuel du format. Les livrets déjà versionnés ne changent pas.", confirmLabel: "Lancer le rattrapage", onConfirm: () => void runBackfill() })}
        >
          {backfill.running ? "Rattrapage en cours…" : "Lancer le rattrapage"}
        </Button>
        {backfill.error ? <ResultBox tone="error">{backfill.error}</ResultBox> : null}
        {backfill.result ? (
          <ResultBox tone={backfill.result.failures.length ? "warning" : "ok"}>
            <p>{backfill.result.candidateCount ? `${backfill.result.publishedRaceIds.length} livret(s) versionné(s) sur ${backfill.result.candidateCount}.` : "Aucun livret à rattraper."}</p>
            {backfill.result.failures.length ? (
              <ul className="mt-1 list-disc pl-5">{backfill.result.failures.slice(0, 10).map((failure) => <li key={failure.raceId}><code className="font-mono">{failure.raceId}</code> : {failure.message}</li>)}</ul>
            ) : null}
          </ResultBox>
        ) : null}
      </ActionCard>
      <ActionCard id="cleanup" title="Nettoyer les fichiers des anciennes versions">
        <p className="text-muted-foreground">
          Traite jusqu’à 25 fichiers dus de la file de nettoyage : un fichier encore utilisé par une version est gardé, les autres sont supprimés du stockage ;
          un échec est retenté plus tard (délai croissant).
        </p>
        <Button type="button" variant="outline" className={DISABLED} disabled={cleanup.running} onClick={() => void runCleanup()}>
          {cleanup.running ? "Nettoyage en cours…" : cleanup.result && cleanupMayHaveMore(cleanup.result) ? "Continuer (25 suivants)" : "Lancer le nettoyage"}
        </Button>
        {cleanup.error ? <ResultBox tone="error">{cleanup.error}</ResultBox> : null}
        {cleanup.result ? (
          <ResultBox tone={cleanup.result.failed.length ? "warning" : "ok"}>
            {cleanup.result.processed
              ? `${cleanup.result.processed} fichier(s) traité(s) : ${cleanup.result.deleted.length} supprimé(s), ${cleanup.result.retained.length} gardé(s), ${cleanup.result.failed.length} en échec.`
              : "Aucun fichier dû dans la file."}
            {cleanupMayHaveMore(cleanup.result) ? " La file peut en contenir d’autres." : ""}
            {cleanup.total > cleanup.result.processed ? ` Total de la session : ${cleanup.total}.` : ""}
          </ResultBox>
        ) : null}
      </ActionCard>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Manual cron run

function CronRunCard({ accessToken, tasks, onConfirm, nowMs }: { accessToken: string; tasks: ScheduledTask[] | null; onConfirm: (state: ConfirmState) => void; nowMs: number }) {
  const toast = useToast();
  const [job, setJob] = useState<CronRunKey>("demo-race-refresh");
  const [state, setState] = useState<{ running: boolean; result: CronRunResponse | null; error: string | null }>({ running: false, result: null, error: null });
  const task = tasks?.find((item) => item.key === job) ?? null;

  const run = async (key: CronRunKey) => {
    setState({ running: true, result: null, error: null });
    try {
      const result = await adminFetch(accessToken, "/api/admin/system/cron-run", cronRunResponseSchema, { method: "POST", body: { job: key } }, "La tâche n’a pas pu être lancée.");
      setState({ running: false, result, error: null });
      toast.show({ message: result.ok ? `${SCHEDULED_TASKS[key].label} : passage terminé.` : `${SCHEDULED_TASKS[key].label} : la tâche a répondu ${result.status}.`, tone: result.ok ? "success" : "danger" });
    } catch (error) {
      setState({ running: false, result: null, error: errorMessage(error, "La tâche n’a pas pu être lancée.") });
    }
  };

  return (
    <ActionCard id="cron-run" title="Relancer une tâche planifiée">
      <p className="text-muted-foreground">
        Exécute tout de suite un passage d’une tâche pg_cron, comme le planificateur : la route est appelée côté serveur avec le secret des crons, qui ne quitte jamais le serveur.
        Le passage planifié suivant a lieu normalement. Les rappels push (Edge Function) et les crons Vercel ne sont pas relançables ici.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[240px] flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Tâche
          <select
            value={job}
            onChange={(event) => setJob(event.target.value as CronRunKey)}
            className="min-h-11 rounded-md border border-border bg-card px-3 text-sm font-normal text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {CRON_RUN_KEYS.map((key) => <option key={key} value={key}>{SCHEDULED_TASKS[key].label}</option>)}
          </select>
        </label>
        <Button
          type="button"
          className={DISABLED}
          disabled={state.running}
          onClick={() => onConfirm({
            title: `Lancer « ${SCHEDULED_TASKS[job].label} » maintenant ?`,
            description: `${SCHEDULED_TASKS[job].description} Si un passage planifié est en cours, attends sa fin : deux passages simultanés peuvent traiter le même élément.`,
            confirmLabel: "Lancer maintenant",
            onConfirm: () => void run(job),
          })}
        >
          {state.running ? "Passage en cours…" : "Lancer maintenant"}
        </Button>
      </div>
      {task ? (
        <p className="text-xs text-muted-foreground">
          <StatusBadge tone={task.status === "ok" ? "success" : task.status === "failed" || task.status === "late" ? "danger" : "neutral"}>{task.statusLabel}</StatusBadge>{" "}
          {task.lastStart ? `dernier passage ${formatRelativePast(task.lastStart, nowMs)}` : "aucun passage enregistré"} · {task.scheduleLabel}
        </p>
      ) : null}
      {state.error ? <ResultBox tone="error">{state.error}</ResultBox> : null}
      {state.result ? (
        <ResultBox tone={state.result.ok ? "ok" : "error"}>
          <p className="font-semibold">HTTP {state.result.status} · {Math.round(state.result.durationMs / 100) / 10} s</p>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px]">{formatCronResult(state.result.result)}</pre>
        </ResultBox>
      ) : null}
    </ActionCard>
  );
}

// ---------------------------------------------------------------------------------------------

function BetrailCard() {
  return (
    <ActionCard id="betrail" title="Importer des brouillons Betrail">
      <p className="text-muted-foreground">
        Reste un script local : il lit le CSV produit par le scraper Betrail et appelle <code className="font-mono">POST /api/admin/race-catalog/betrail-import</code> pour chaque course
        (brouillons à relire dans le catalogue). Simule d’abord avec <code className="font-mono">--dry-run</code>, qui n’appelle pas l’API.
      </p>
      <ol className="space-y-2">
        {BETRAIL_IMPORT_COMMANDS.map((command, index) => (
          <li key={command}>
            <span className="text-xs font-semibold text-muted-foreground">{index === 0 ? "1. Simulation" : "2. Import"}</span>
            <pre className="mt-1 whitespace-pre-wrap break-all rounded-md bg-muted px-3 py-2 font-mono text-[12px] text-foreground">{command}</pre>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">Détail : docs/05-integrations/betrail-organizer-email-scraping.md.</p>
    </ActionCard>
  );
}

export function MaintenancePanel({ accessToken, tasks, nowMs }: { accessToken: string; tasks: ScheduledTask[] | null; nowMs: number }) {
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CronRunCard accessToken={accessToken} tasks={tasks} onConfirm={setConfirm} nowMs={nowMs} />
      <ResendSyncCard accessToken={accessToken} onConfirm={setConfirm} />
      <RacebookCards accessToken={accessToken} onConfirm={setConfirm} />
      <BetrailCard />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
