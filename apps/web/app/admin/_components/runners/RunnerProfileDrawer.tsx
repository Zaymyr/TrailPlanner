"use client";

import type { Route } from "next";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../../../components/ui/button";
import { Drawer } from "../../../../components/ui/Drawer";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  BILLING_METHOD_LABEL,
  BILLING_STATUS_CONFIG,
  formatBillingDate,
  writeBillingQuery,
} from "../../../../lib/admin-billing";
import { READ_STATE_LABEL, writeAdminMessagesQuery } from "../../../../lib/admin-messages";
import {
  PREMIUM_GRANT_REASON_LABEL,
  runnerProfileResponseSchema,
  SUBSCRIPTION_PROVIDER_LABEL,
  type RunnerGrant,
  type RunnerProfile,
} from "../../../../lib/admin-runner-profile";
import { adminFetch } from "../../publications/publications-api";
import { DetailList, DetailSection, DrawerTabs } from "../shell/DrawerTabs";
import type { RunnerProfileTab } from "./runner-url";

const parisDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
const formatDay = (iso: string | null | undefined) => (iso ? parisDay.format(new Date(iso)) : "—");
const formatDateTime = (iso: string | null | undefined) => (iso ? formatBillingDate(iso) : "—");
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

const linkClass = "font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const runnerProfileQueryKey = (accessToken: string | null, runnerId: string | null) => ["admin", "runner-profile", accessToken, runnerId] as const;

export function useRunnerProfile(accessToken: string | null, runnerId: string | null) {
  return useQuery({
    queryKey: runnerProfileQueryKey(accessToken, runnerId),
    enabled: Boolean(accessToken && runnerId),
    queryFn: () => adminFetch(accessToken ?? "", `/api/admin/users/${runnerId}`, runnerProfileResponseSchema, {}, "La fiche du coureur n’a pas pu être chargée."),
  });
}

const GRANT_STATE = { active: { label: "Active", tone: "success" }, scheduled: { label: "Programmée", tone: "info" }, ended: { label: "Terminée", tone: "neutral" } } as const;

export type RunnerListInsights = { favoriteProducts: string[]; activityWindowDays: number | null } | null | undefined;

function SummaryTab({ profile, listInsights }: { profile: RunnerProfile; listInsights: RunnerListInsights }) {
  return (
    <div className="space-y-5">
      <DetailSection title="Identité">
        <DetailList items={[
          { label: "Nom", value: profile.fullName ?? "—" },
          { label: "E-mail", value: profile.email ?? "—" },
          { label: "Rôles", value: <span className="flex flex-wrap gap-1">{profile.roles.map((role) => <StatusBadge key={role} tone={role === "admin" ? "info" : "neutral"} dot={false}>{role === "admin" ? "Admin" : "Coureur"}</StatusBadge>)}</span> },
          { label: "Identifiant", value: <span className="font-mono text-xs">{profile.id}</span> },
        ]} />
      </DetailSection>
      <DetailSection title="Activité">
        <DetailList items={[
          { label: "Compte créé", value: formatDateTime(profile.createdAt) },
          { label: "Dernière activité", value: formatDateTime(profile.lastSignInAt) },
          { label: "Connexions", value: profile.signInCount ?? "—" },
          ...(listInsights?.activityWindowDays != null ? [{ label: "Période d’activité", value: plural(listInsights.activityWindowDays, "jour") }] : []),
          ...(listInsights ? [{ label: "Produits favoris", value: listInsights.favoriteProducts.join(", ") || "—" }] : []),
          {
            label: "Onboarding",
            value: profile.onboarding.completed
              ? <StatusBadge tone="success">{profile.onboarding.completedAt ? `Terminé le ${formatDay(profile.onboarding.completedAt)}` : "Terminé"}</StatusBadge>
              : <StatusBadge tone="warning">Non terminé</StatusBadge>,
          },
        ]} />
      </DetailSection>
      <DetailSection title={`Plans (${profile.plans.total})`}>
        {profile.plans.recent.length ? (
          <ul className="space-y-1.5 text-sm">
            {profile.plans.recent.map((plan) => (
              <li key={plan.id} className="flex items-baseline justify-between gap-3 rounded-md border border-border px-3 py-2">
                <span className="min-w-0 truncate font-medium text-foreground">{plan.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">modifié le {formatDay(plan.updatedAt ?? plan.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucun plan enregistré.</p>}
        {profile.plans.total > profile.plans.recent.length ? <p className="text-xs text-muted-foreground">Les {profile.plans.recent.length} derniers modifiés sont affichés.</p> : null}
      </DetailSection>
    </div>
  );
}

function AccessTab({ profile, revokingGrantId, onGrant, onEditGrant, onRevokeGrant }: {
  profile: RunnerProfile;
  revokingGrantId: string | null;
  onGrant: () => void;
  onEditGrant: (grant: RunnerGrant) => void;
  onRevokeGrant: (grant: RunnerGrant) => void;
}) {
  const { access } = profile;
  const purchasesHref = `/admin/billing?${writeBillingQuery({ period: "tout", sources: ["runner"], search: profile.email ?? "" }).toString()}`;
  return (
    <div className="space-y-5">
      <DetailSection title="Statut">
        <div className="flex flex-wrap items-center gap-2">
          {access.isPremium ? <StatusBadge tone="success">Premium</StatusBadge> : <StatusBadge tone="neutral">Gratuit</StatusBadge>}
          <span className="text-sm text-muted-foreground">{access.isPremium ? `par ${access.activeSources.join(", ")}` : "Aucun abonnement, essai ni attribution en cours."}</span>
        </div>
        <p className="text-xs text-muted-foreground">Ordre de résolution : abonnement, essai historique, attribution. Un achat à la course débloque un seul plan, jamais Premium.</p>
      </DetailSection>

      <DetailSection title="Abonnement">
        {access.subscription ? (
          <DetailList items={[
            { label: "Statut", value: <StatusBadge tone={access.subscription.active ? "success" : "neutral"}>{access.subscription.status}</StatusBadge> },
            { label: "Fournisseur", value: access.subscription.provider ? SUBSCRIPTION_PROVIDER_LABEL[access.subscription.provider] ?? access.subscription.provider : "—" },
            { label: "Fin de période", value: formatDay(access.subscription.currentPeriodEnd) },
          ]} />
        ) : <p className="text-sm text-muted-foreground">Aucun abonnement.</p>}
      </DetailSection>

      <DetailSection title="Essai">
        {access.trial ? (
          <p className="text-sm text-foreground">
            {access.trial.active ? `En cours jusqu’au ${formatDay(access.trial.endsAt)} (${plural(access.trial.remainingDays, "jour")})` : `Terminé le ${formatDay(access.trial.endsAt)}`}
          </p>
        ) : <p className="text-sm text-muted-foreground">Aucun essai (les nouveaux comptes n’en reçoivent plus).</p>}
      </DetailSection>

      <DetailSection title="Attributions Premium" action={<Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={onGrant}>Accorder Premium</Button>}>
        {access.grants.length ? (
          <ul className="space-y-2">
            {access.grants.map((grant) => {
              const state = GRANT_STATE[grant.state];
              return (
                <li key={grant.id} className="space-y-1 rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{PREMIUM_GRANT_REASON_LABEL[grant.reason] ?? grant.reason}</span>
                    <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Du {formatDay(grant.startsAt)} au {formatDay(grant.endsAt)} · {plural(grant.initialDurationDays, "jour")}
                    {grant.state !== "ended" ? ` · reste ${plural(grant.remainingDurationDays, "jour")}` : ""}
                  </p>
                  {grant.state !== "ended" ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => onEditGrant(grant)}>Modifier</Button>
                      <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-red-600 hover:text-red-600" disabled={revokingGrantId === grant.id} onClick={() => onRevokeGrant(grant)}>
                        {revokingGrantId === grant.id ? "Révocation…" : "Révoquer"}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucune attribution.</p>}
      </DetailSection>

      <DetailSection title="Achats" action={profile.email ? <Link href={purchasesHref as Route} className={`text-xs ${linkClass}`}>Dans Ventes & facturation →</Link> : null}>
        {profile.purchases.length ? (
          <ul className="space-y-2">
            {profile.purchases.map((entry) => {
              const status = BILLING_STATUS_CONFIG[entry.status];
              return (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{entry.object}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(entry.date)} · {entry.methodDetail ?? BILLING_METHOD_LABEL[entry.method]} · montant non suivi
                      {entry.statusNote ? ` · ${entry.statusNote}` : ""}
                    </p>
                    {entry.stripeUrl ? <a href={entry.stripeUrl} target="_blank" rel="noreferrer" className={`text-xs ${linkClass}`}>Ouvrir dans Stripe ↗</a> : null}
                  </div>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucun achat (plan à la course, abonnement, soutien).</p>}
      </DetailSection>
    </div>
  );
}

function MessagesTab({ profile, onMessage }: { profile: RunnerProfile; onMessage: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" className="h-9 px-3 text-sm" onClick={onMessage}>Envoyer un message</Button>
        <Link href={`/admin/messaging?${writeAdminMessagesQuery({ userId: profile.id }).toString()}` as Route} className={`text-xs ${linkClass}`}>Dans l’historique des messages →</Link>
      </div>
      {profile.messages.length ? (
        <ul className="space-y-2">
          {profile.messages.map((message) => (
            <li key={message.id} className="space-y-1 rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{message.title}</span>
                <StatusBadge tone={message.readState === "read" ? "success" : message.readState === "deleted" ? "neutral" : "info"}>{READ_STATE_LABEL[message.readState]}</StatusBadge>
              </div>
              <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">{message.body}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(message.createdAt)} · {message.kindLabel}{message.context ? ` · ${message.context}` : ""}
              </p>
              <div className="flex flex-wrap gap-1">
                {message.channels.map((channel) => <StatusBadge key={channel.channel} tone={channel.tone} dot={false}>{channel.label}</StatusBadge>)}
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="Aucun message envoyé" description="Les messages de l’admin, réponses aux demandes et questionnaires apparaissent ici." />}
    </div>
  );
}

function FeedbackTab({ profile }: { profile: RunnerProfile }) {
  return profile.feedback.length ? (
    <ul className="space-y-2">
      {profile.feedback.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border p-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.typeLabel} · {formatDateTime(item.createdAt)}{item.detail ? ` · ${item.detail}` : ""}</p>
            <Link href={item.href as Route} className={`text-xs ${linkClass}`}>Ouvrir dans la file →</Link>
          </div>
          <StatusBadge tone={item.status === "pending" ? "warning" : item.status === "completed" ? "success" : "neutral"}>{item.statusLabel}</StatusBadge>
        </li>
      ))}
    </ul>
  ) : <EmptyState title="Aucun retour" description="Bugs, retours et demandes de course envoyés par ce coureur." />;
}

/**
 * Runner profile (lot 5), opened from a row of `/admin/runners` (`?coureur=<userId>&fiche=`): Résumé,
 * Accès (Premium, attributions, achats), Messages and Retours, from `GET /api/admin/users/[id]`. The
 * action dialogs (Premium, message) are owned by the page and opened from here.
 */
export function RunnerProfileDrawer({ accessToken, runnerId, listInsights, tab, revokingGrantId, onTabChange, onClose, onGrant, onEditGrant, onRevokeGrant, onMessage }: {
  accessToken: string | null;
  runnerId: string | null;
  /** Favourites and activity window of the list row (`GET /api/admin/users`), when the row is on the page. */
  listInsights?: RunnerListInsights;
  tab: RunnerProfileTab;
  revokingGrantId: string | null;
  onTabChange: (tab: RunnerProfileTab) => void;
  onClose: () => void;
  onGrant: (profile: RunnerProfile) => void;
  onEditGrant: (profile: RunnerProfile, grant: RunnerGrant) => void;
  onRevokeGrant: (profile: RunnerProfile, grant: RunnerGrant) => void;
  onMessage: (profile: RunnerProfile) => void;
}) {
  const query = useRunnerProfile(accessToken, runnerId);
  const profile = query.data?.profile ?? null;
  const unavailable = query.data?.unavailable ?? [];
  const title = profile ? profile.fullName ?? profile.email ?? "Coureur" : "Fiche coureur";

  return (
    <Drawer
      open={Boolean(runnerId)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={title}
      description={profile?.fullName && profile.email ? profile.email : profile ? (profile.access.isPremium ? "Premium" : "Gratuit") : undefined}
      widthClassName="w-full max-w-xl"
      actions={profile ? <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => onMessage(profile)}>Envoyer un message</Button> : null}
    >
      {query.isLoading && !profile ? <p role="status" className="px-5 py-4 text-sm text-muted-foreground">Chargement de la fiche…</p> : null}
      {query.error && !profile ? (
        <div className="space-y-2 px-5 py-4">
          <p role="alert" className="text-sm text-red-700">{query.error instanceof Error ? query.error.message : "La fiche du coureur n’a pas pu être chargée."}</p>
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => query.refetch()}>Réessayer</Button>
        </div>
      ) : null}
      {profile ? (
        <>
          {unavailable.length ? <p role="status" className="mx-5 mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">Lecture impossible pour le moment : {unavailable.join(", ")}.</p> : null}
          <DrawerTabs<RunnerProfileTab>
            label="Sections de la fiche coureur"
            active={tab}
            onChange={onTabChange}
            tabs={[
              { id: "resume", label: "Résumé" },
              { id: "acces", label: "Accès" },
              { id: "messages", label: "Messages", count: profile.messages.length },
              { id: "retours", label: "Retours", count: profile.feedback.filter((item) => item.status === "pending").length },
            ]}
          >
            {tab === "resume" ? <SummaryTab profile={profile} listInsights={listInsights} /> : null}
            {tab === "acces" ? (
              <AccessTab
                profile={profile}
                revokingGrantId={revokingGrantId}
                onGrant={() => onGrant(profile)}
                onEditGrant={(grant) => onEditGrant(profile, grant)}
                onRevokeGrant={(grant) => onRevokeGrant(profile, grant)}
              />
            ) : null}
            {tab === "messages" ? <MessagesTab profile={profile} onMessage={() => onMessage(profile)} /> : null}
            {tab === "retours" ? <FeedbackTab profile={profile} /> : null}
          </DrawerTabs>
        </>
      ) : null}
    </Drawer>
  );
}
