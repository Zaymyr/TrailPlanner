"use client";

import { StatusBadge, type StatusTone } from "../../../../components/ui/StatusBadge";
import { cn } from "../../../../components/utils";
import type { IntegrationService, IntegrationsResponse, IntegrationStatus } from "../../../../lib/admin-integrations";
import { formatRelativePast } from "../../../../lib/admin-overview";
import {
  formatDuration,
  TASK_STATUS_TONES,
  type EmailActivity,
  type PaymentActivity,
  type PgNetSummary,
  type ScheduledTask,
  type SystemHealthResponse,
} from "../../../../lib/admin-system-health";
import { CardError, DashboardCard, Loading } from "../overview/OverviewCards";
import { formatAbsolute } from "./system-api";

/**
 * Panels of the « Système » pages (lot 3): scheduled tasks table (Automatisations), service cards
 * (Intégrations). Pure rendering from the API responses, so they are testable with simulated data.
 */

const numberFormat = new Intl.NumberFormat("fr-FR");

function WhenCell({ iso, nowMs }: { iso: string | null; nowMs: number }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col">
      <span className="text-foreground">{formatRelativePast(iso, nowMs)}</span>
      <time dateTime={iso} className="text-xs text-muted-foreground">{formatAbsolute(iso)}</time>
    </span>
  );
}

function TaskMessage({ task }: { task: ScheduledTask }) {
  const message = task.lastMessage?.trim();
  const showMessage = Boolean(message) && task.status === "failed";
  return (
    <details className="group mt-1 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none rounded font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {showMessage ? "Voir le message d’erreur" : "Détails"}
      </summary>
      <div className="mt-1.5 space-y-1">
        <p>{task.detail}</p>
        <p>
          Appel : <code className="font-mono">{task.target}</code> · <code className="font-mono">{task.schedule}</code> (UTC)
        </p>
        {message ? <p className="font-semibold text-foreground">Message du dernier passage :</p> : null}
        {message ? (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted px-2 py-1.5 font-mono text-[11.5px] text-foreground">{message}</pre>
        ) : null}
        {task.docHref ? (
          <a href={task.docHref} target="_blank" rel="noreferrer" className="font-semibold text-brand underline-offset-2 hover:underline">
            Documentation <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </details>
  );
}

function FailuresCell({ task }: { task: ScheduledTask }) {
  if (task.failures24h === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("font-mono", task.failures24h > 0 ? "font-semibold text-red-700 dark:text-red-300" : "text-muted-foreground")}>
      {numberFormat.format(task.failures24h)}
      <span className="text-muted-foreground"> / {numberFormat.format(task.runs24h ?? 0)}</span>
    </span>
  );
}

function PgNetNote({ pgNet, nowMs }: { pgNet: PgNetSummary | null; nowMs: number }) {
  if (!pgNet) return <p className="px-4 pb-4 text-xs text-muted-foreground">Réponses HTTP de pg_net : lecture impossible.</p>;
  if (!pgNet.available) return <p className="px-4 pb-4 text-xs text-muted-foreground">Réponses HTTP de pg_net : non disponibles dans cette base.</p>;
  return (
    <p className="px-4 pb-4 text-xs text-muted-foreground">
      <b className="font-semibold text-foreground">Réponses HTTP (pg_net, toutes tâches) :</b>{" "}
      {numberFormat.format(pgNet.errors)} en erreur sur {numberFormat.format(pgNet.responses)}
      {pgNet.oldest_at ? ` depuis ${formatRelativePast(pgNet.oldest_at, nowMs).replace("il y a ", "")}` : ""}
      {pgNet.last_error_at ? ` · dernière erreur ${formatRelativePast(pgNet.last_error_at, nowMs)}${pgNet.last_error_status ? ` (HTTP ${pgNet.last_error_status})` : ""}${pgNet.last_error_message ? ` : ${pgNet.last_error_message}` : ""}` : ""}.{" "}
      pg_net ne garde ni l’URL ni la tâche d’une réponse : un code HTTP ne peut pas être rattaché à une tâche précise. « OK » dans le tableau veut dire que l’appel est parti.
    </p>
  );
}

/** Table of the scheduled tasks (pg_cron jobs, then the Vercel crons never called). Cards under `md`. */
export function ScheduledTasksCard({ health, loading, error, onRetry, nowMs }: {
  health: SystemHealthResponse | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  nowMs: number;
}) {
  const tasks = health ? [...(health.tasks ?? []), ...health.vercelTasks] : [];
  return (
    <DashboardCard title="Tâches planifiées" labelId="system-scheduled-tasks" link={{ href: "/admin/system/maintenance", label: "Relancer une tâche" }}>
      {loading && !health ? (
        <Loading label="Chargement des tâches planifiées" lines={6} />
      ) : error && !health ? (
        <CardError message={error} onRetry={onRetry} />
      ) : health ? (
        <>
          {health.tasks === null ? <CardError message="Les tâches pg_cron n’ont pas pu être lues (fonction admin_cron_job_status absente ?)." onRetry={onRetry} /> : null}
          <div className="hidden md:block">
            <table className="w-full table-fixed border-t border-[#e6e2d8] text-left text-sm dark:border-border">
              <caption className="sr-only">Tâches planifiées, dernier passage et échecs sur 24 h</caption>
              <thead className="text-xs uppercase tracking-[0.04em] text-muted-foreground">
                <tr>
                  <th scope="col" className="w-[30%] px-4 py-2 font-semibold">Tâche</th>
                  <th scope="col" className="w-[18%] px-3 py-2 font-semibold">Planification</th>
                  <th scope="col" className="w-[16%] px-3 py-2 font-semibold">Dernier passage</th>
                  <th scope="col" className="w-[8%] px-3 py-2 font-semibold">Durée</th>
                  <th scope="col" className="w-[18%] px-3 py-2 font-semibold">Statut</th>
                  <th scope="col" className="w-[10%] px-3 py-2 font-semibold">Échecs 24 h</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={`${task.runner}:${task.key}`} className="border-t border-[#e6e2d8] align-top dark:border-border">
                    <th scope="row" className="px-4 py-3 font-normal">
                      <span className="block font-semibold text-foreground">{task.label}</span>
                      <span className="block text-xs text-muted-foreground">{task.description}</span>
                      <TaskMessage task={task} />
                    </th>
                    <td className="px-3 py-3 text-foreground">
                      {task.scheduleLabel}
                      <span className="block text-xs text-muted-foreground">{task.runner === "vercel" ? "Vercel Cron" : "pg_cron"}</span>
                    </td>
                    <td className="px-3 py-3"><WhenCell iso={task.lastStart} nowMs={nowMs} /></td>
                    <td className="px-3 py-3 font-mono text-[13px] text-foreground">{formatDuration(task.durationMs)}</td>
                    <td className="px-3 py-3"><StatusBadge tone={TASK_STATUS_TONES[task.status]} pulse={task.status === "running"}>{task.statusLabel}</StatusBadge></td>
                    <td className="px-3 py-3"><FailuresCell task={task} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="border-t border-[#e6e2d8] md:hidden dark:border-border">
            {tasks.map((task) => (
              <li key={`${task.runner}:${task.key}`} className="border-b border-[#e6e2d8] px-4 py-3 last:border-b-0 dark:border-border">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-semibold text-foreground">{task.label}</p>
                  <StatusBadge tone={TASK_STATUS_TONES[task.status]} pulse={task.status === "running"}>{task.statusLabel}</StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">{task.scheduleLabel} · {task.runner === "vercel" ? "Vercel Cron" : "pg_cron"}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted-foreground">Dernier passage</dt><dd><WhenCell iso={task.lastStart} nowMs={nowMs} /></dd></div>
                  <div><dt className="text-muted-foreground">Durée</dt><dd className="font-mono text-foreground">{formatDuration(task.durationMs)}</dd></div>
                  <div><dt className="text-muted-foreground">Échecs 24 h</dt><dd><FailuresCell task={task} /></dd></div>
                </dl>
                <TaskMessage task={task} />
              </li>
            ))}
          </ul>
          <PgNetNote pgNet={health.pgNet} nowMs={nowMs} />
        </>
      ) : null}
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Intégrations

const INTEGRATION_TONES: Record<IntegrationStatus, StatusTone> = { ok: "success", warning: "warning", error: "danger", off: "neutral" };

function Checks({ checks }: { checks: IntegrationService["checks"] }) {
  return (
    <ul className="mt-2 space-y-1 text-[13px]">
      {checks.map((check) => (
        <li key={check.label} className="flex items-start gap-2">
          <span aria-hidden="true" className={cn("mt-0.5 font-bold", check.present ? "text-emerald-700 dark:text-emerald-300" : "text-stone-400")}>{check.present ? "✓" : "–"}</span>
          <span className="min-w-0 break-words text-foreground">
            {check.label}
            <span className="text-muted-foreground"> : {check.present ? "présent" : "absent"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmailActivityList({ emails, nowMs }: { emails: EmailActivity; nowMs: number }) {
  if (!emails.journalAvailable) return <p className="mt-2 text-xs text-muted-foreground">Le journal des e-mails n’est pas encore déployé (migration du lot 3).</p>;
  if (!emails.recent.length) return <p className="mt-2 text-xs text-muted-foreground">Aucun e-mail journalisé pour le moment.</p>;
  return (
    <ul className="mt-2 divide-y divide-[#eeebe3] text-xs dark:divide-border">
      {emails.recent.slice(0, 5).map((row) => (
        <li key={row.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
          <StatusBadge tone={row.status === "sent" ? "success" : row.status === "failed" ? "danger" : "neutral"}>{row.status === "sent" ? "Envoyé" : row.status === "failed" ? "Échec" : "Non envoyé"}</StatusBadge>
          <span className="font-mono text-foreground">{row.category}</span>
          {row.recipient_masked ? <span className="text-muted-foreground">{row.recipient_masked}</span> : null}
          <time dateTime={row.created_at} title={formatAbsolute(row.created_at)} className="ml-auto text-muted-foreground">{formatRelativePast(row.created_at, nowMs)}</time>
          {row.status !== "sent" && row.message ? <span className="w-full break-words text-muted-foreground">{row.status_code ? `HTTP ${row.status_code} · ` : ""}{row.message}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function PaymentActivityList({ payments, nowMs }: { payments: PaymentActivity; nowMs: number }) {
  const rows = [
    { label: "Dernier événement Stripe", at: payments.lastEventAt, extra: payments.lastEventSource },
    { label: "Achat coureur (journal)", at: payments.lastRunnerEventAt, extra: null },
    { label: "Paiement organisateur", at: payments.lastOrganizerPaymentAt, extra: null },
    { label: "Commande de survol payée", at: payments.lastFlyoverPaidAt, extra: null },
  ];
  return (
    <>
      <dl className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-foreground">{row.at ? <time dateTime={row.at} title={formatAbsolute(row.at)}>{formatRelativePast(row.at, nowMs)}{row.extra ? ` · ${row.extra}` : ""}</time> : "—"}</dd>
          </div>
        ))}
      </dl>
      {payments.unprocessed.length ? (
        <ul className="mt-2 space-y-1 rounded-md bg-[#fdecec] px-2.5 py-2 text-xs text-[#9b2c2c] dark:bg-red-950/60 dark:text-red-100">
          {payments.unprocessed.slice(0, 5).map((event) => (
            <li key={`${event.eventType}:${event.receivedAt}`}>
              <span className="font-mono">{event.eventType}</span> reçu {formatRelativePast(event.receivedAt, nowMs)}, non traité{event.error ? ` : ${event.error}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {payments.failedOrganizerPayments ? <p className="mt-2 text-xs text-orange-800 dark:text-orange-200">{payments.failedOrganizerPayments} paiement(s) organisateur en échec ou contesté(s) sur 7 jours.</p> : null}
    </>
  );
}

function RenderList({ renders, nowMs }: { renders: NonNullable<IntegrationsResponse["renders"]>; nowMs: number }) {
  if (!renders.length) return <p className="mt-2 text-xs text-muted-foreground">Aucun rendu récent.</p>;
  return (
    <ul className="mt-2 divide-y divide-[#eeebe3] text-xs dark:divide-border">
      {renders.map((render) => (
        <li key={`${render.kind}:${render.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
          <StatusBadge tone={render.status === "done" ? "success" : render.status === "failed" ? "danger" : "info"} pulse={render.status === "active"}>{render.status === "done" ? "Terminé" : render.status === "failed" ? "Échec" : "En cours"}</StatusBadge>
          <span className="min-w-0 truncate text-foreground">{render.title}</span>
          <time dateTime={render.createdAt} title={formatAbsolute(render.createdAt)} className="ml-auto text-muted-foreground">{formatRelativePast(render.finishedAt ?? render.createdAt, nowMs)}</time>
        </li>
      ))}
    </ul>
  );
}

/** One card per service (Stripe, Resend, Google Cloud, Mapbox, ElevenLabs, Anthropic, OpenAI). */
export function IntegrationCards({ data, loading, error, onRetry, nowMs }: {
  data: IntegrationsResponse | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  nowMs: number;
}) {
  if (loading && !data) return <DashboardCard title="Services" labelId="integrations-loading"><Loading label="Chargement des intégrations" lines={6} /></DashboardCard>;
  if (error && !data) return <DashboardCard title="Services" labelId="integrations-error"><CardError message={error} onRetry={onRetry} /></DashboardCard>;
  if (!data) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.services.map((item) => (
        <DashboardCard
          key={item.key}
          title={item.label}
          labelId={`integration-${item.key}`}
          titleExtra={<StatusBadge tone={INTEGRATION_TONES[item.status]}>{item.statusLabel}</StatusBadge>}
        >
          <div className="px-4 pb-4">
            <p className="text-[13px] text-muted-foreground">{item.role}</p>
            <Checks checks={item.checks} />
            {item.detail ? <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p> : null}
            {item.key === "resend" && data.emails ? <EmailActivityList emails={data.emails} nowMs={nowMs} /> : null}
            {item.key === "stripe" && data.payments ? <PaymentActivityList payments={data.payments} nowMs={nowMs} /> : null}
            {item.key === "gcp" ? (data.renders ? <RenderList renders={data.renders} nowMs={nowMs} /> : <p className="mt-2 text-xs text-muted-foreground">Derniers rendus : lecture impossible.</p>) : null}
          </div>
        </DashboardCard>
      ))}
    </div>
  );
}
