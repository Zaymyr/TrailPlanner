"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../../../components/ui/button";
import { Drawer } from "../../../../components/ui/Drawer";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { useToast } from "../../../../components/ui/Toast";
import { formatBillingAmount, formatBillingDate } from "../../../../lib/admin-billing";
import { organizerSocialProofAdminResponseSchema } from "../../../../lib/organizer-social-proof";
import { adminFetch } from "../../publications/publications-api";
import { BankTransferDialog } from "../billing/BankTransferDialog";
import { useBillingEditions } from "../billing/billing-api";
import { EditionBillingSummary, editionBillingHref } from "../billing/EditionBillingSummary";
import { OrganizerInvoiceDialog, type OrganizerInvoiceTarget } from "../billing/OrganizerInvoiceDialog";
import { DetailList, DetailSection, DrawerTabs } from "../shell/DrawerTabs";
import { EditionPackForm } from "./EditionPackForm";
import {
  activeTier,
  editionLinks,
  editionPendingRequests,
  editionRacebookCounts,
  eventMembers,
  organizerTierLabel,
  publicationOriginLabel,
  type EditionDrawerTab,
  type RacebookPublicationEvent,
} from "./organizer-admin-model";
import { ClaimItem, EditionRequestItem, PublicationRequestItem } from "./OrganizerRequestItems";
import type { OrganizerAdminData } from "./useOrganizerAdminData";

const linkClass = "font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const parisDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
const formatDay = (value: string | null | undefined) => (value ? parisDay.format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "—");

function SummaryTab({ event, data }: { event: RacebookPublicationEvent; data: OrganizerAdminData }) {
  const counts = editionRacebookCounts(event);
  const members = eventMembers(event.id, data.memberships);
  const links = editionLinks(event);
  const tier = activeTier(event);
  return (
    <div className="space-y-5">
      <DetailSection title="Événement et édition">
        <DetailList items={[
          { label: "Événement", value: event.name },
          { label: "Édition", value: <span className="flex flex-wrap items-center gap-2">{event.editionYear ?? "—"}{event.isCurrentEdition ? <StatusBadge tone="info" dot={false}>Édition actuelle</StatusBadge> : null}</span> },
          { label: "Lieu", value: event.location ?? "—" },
          { label: "Date", value: formatDay(event.race_date) },
          { label: "Pack", value: <span>{organizerTierLabel[tier]}{event.entitlement?.source ? ` · ${publicationOriginLabel[event.entitlement.source]}` : ""}</span> },
        ]} />
        <div className="flex flex-wrap gap-3 pt-1 text-sm">
          <Link href={links.organizerHref as Route} className={linkClass}>Espace organisateur →</Link>
          {links.publicHref ? <Link href={links.publicHref as Route} className={linkClass} target="_blank">Page publique ↗</Link> : <span className="text-muted-foreground">Page publique : adresse inconnue</span>}
        </div>
      </DetailSection>

      <DetailSection title={`Organisateurs membres (${members.length})`}>
        {members.length ? (
          <ul className="space-y-1.5 text-sm">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="min-w-0 break-all font-medium text-foreground">{member.user?.label ?? member.user_id}</span>
                <span className="text-xs text-muted-foreground">rôle {member.role}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucun organisateur associé à cet événement.</p>}
      </DetailSection>

      <DetailSection title="Livret coureur">
        <div className="flex flex-wrap items-center gap-2">
          {counts.published > 0
            ? <StatusBadge tone="success">{counts.published} livret{counts.published > 1 ? "s" : ""} publié{counts.published > 1 ? "s" : ""}</StatusBadge>
            : <StatusBadge tone="neutral">Aucun livret publié</StatusBadge>}
          <span className="text-xs text-muted-foreground">{counts.formats} format(s) · {counts.complete}/{counts.formats} complet(s) · {counts.approved} autorisé(s)</span>
        </div>
        {event.races.length ? (
          <ul className="space-y-1.5 text-sm">
            {event.races.map((race) => (
              <li key={race.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="min-w-0 font-medium text-foreground">{race.name}{race.race_date ? <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDay(race.race_date)}</span> : null}</span>
                <span className="flex flex-wrap gap-1">
                  {race.racebook_is_live ? <StatusBadge tone="success" dot={false}>Livret en ligne</StatusBadge> : race.racebook_publication_approved_at ? <StatusBadge tone="info" dot={false}>Autorisé, hors ligne</StatusBadge> : <StatusBadge tone="neutral" dot={false}>Non publié</StatusBadge>}
                  {race.data_status === "draft" ? <StatusBadge tone="warning" dot={false} title={race.missing_required_fields?.join(", ") || undefined}>Données incomplètes</StatusBadge> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </DetailSection>
    </div>
  );
}

function BillingTab({ event, onNewInvoice, onTransfer }: { event: RacebookPublicationEvent; onNewInvoice: (target: OrganizerInvoiceTarget) => void; onTransfer: () => void }) {
  const payments = event.payments.filter((payment) => payment.status !== "expired").slice(0, 5);
  const invoices = event.invoices.filter((invoice) => invoice.document_status === "active").slice(0, 5);
  if (!event.editionId) return <p className="text-sm text-muted-foreground">Cette fiche n’a pas d’édition : aucune facturation possible.</p>;
  return (
    <div className="space-y-5">
      <DetailSection title="Résumé">
        <EditionBillingSummary event={event} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="outline" className="h-9 px-3 text-sm" onClick={() => onNewInvoice({ editionId: event.editionId, eventName: event.name, editionYear: event.editionYear, currentTier: activeTier(event) })}>
            Nouvelle facture
          </Button>
          <Button type="button" variant="outline" className="h-9 px-3 text-sm" onClick={onTransfer}>Enregistrer un virement</Button>
        </div>
      </DetailSection>
      <DetailSection title="Derniers paiements" action={<Link href={editionBillingHref(event.editionId) as Route} className={`text-xs ${linkClass}`}>Registre filtré →</Link>}>
        {payments.length ? (
          <ul className="space-y-1.5 text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{organizerTierLabel[payment.to_tier as keyof typeof organizerTierLabel] ?? payment.to_tier}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{payment.payment_channel === "bank_transfer" ? "Virement" : "Stripe"} · {formatBillingDate(payment.paid_at ?? payment.created_at)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums">{formatBillingAmount(payment.amount_total ?? null)}</span>
                  <StatusBadge tone={payment.status === "paid" ? "success" : payment.status === "pending" ? "info" : payment.status === "failed" || payment.status === "disputed" ? "danger" : "neutral"}>{payment.status}</StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucun paiement.</p>}
      </DetailSection>
      <DetailSection title="Factures manuelles">
        {invoices.length ? (
          <ul className="space-y-1.5 text-sm">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="min-w-0">
                  <span className="font-mono text-xs">{invoice.invoice_number}</span>
                  <span className="ml-2 text-xs text-muted-foreground">émise le {formatDay(invoice.invoice_issued_at)} · échéance {formatDay(invoice.due_date)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums">{formatBillingAmount(invoice.net_total)}</span>
                  <StatusBadge tone={invoice.paid_at ? "success" : invoice.net_total === 0 ? "neutral" : "warning"}>{invoice.paid_at ? "réglée" : invoice.net_total === 0 ? "offert" : "à régler"}</StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucune facture manuelle.</p>}
        <p className="text-xs text-muted-foreground">Marquer réglée, rectifier ou télécharger : depuis la ligne du registre.</p>
      </DetailSection>

    </div>
  );
}

function RequestsTab({ event, data }: { event: RacebookPublicationEvent; data: OrganizerAdminData }) {
  const pending = editionPendingRequests(event, data);
  const total = pending.claims.length + pending.publicationRequests.length + pending.editionRequests.length;
  if (!total) return <EmptyState title="Aucune demande en attente" description="Demandes de publication, d’accès (claims) et de nouvelle édition de cet événement." />;
  return (
    <div className="space-y-5">
      {pending.publicationRequests.length ? (
        <DetailSection title="Publication">
          {pending.publicationRequests.map((request) => <PublicationRequestItem key={request.id} request={request} data={data} />)}
        </DetailSection>
      ) : null}
      {pending.claims.length ? (
        <DetailSection title="Accès (claims)">
          {pending.claims.map((claim) => <ClaimItem key={claim.id} claim={claim} data={data} />)}
        </DetailSection>
      ) : null}
      {pending.editionRequests.length ? (
        <DetailSection title="Nouvelle édition">
          {pending.editionRequests.map((request) => <EditionRequestItem key={request.id} request={request} data={data} />)}
        </DetailSection>
      ) : null}
    </div>
  );
}

/** Racebook readers measured for the social proofs (`organizer_social_proofs`, PostHog snapshot); nothing is queried live. */
function ActivityTab({ accessToken, event }: { accessToken: string; event: RacebookPublicationEvent }) {
  const proofs = useQuery({
    queryKey: ["admin", "organizer-social-proofs", accessToken],
    staleTime: 60_000,
    queryFn: () => adminFetch(accessToken, "/api/admin/organizer-social-proofs", organizerSocialProofAdminResponseSchema, {}, "Les statistiques n’ont pas pu être chargées."),
  });
  const proof = proofs.data?.proofs.find((item) => item.editionId === event.editionId) ?? null;
  if (proofs.isLoading) return <p role="status" className="text-sm text-muted-foreground">Chargement des statistiques…</p>;
  if (proofs.error) return <p role="alert" className="text-sm text-red-700">{proofs.error instanceof Error ? proofs.error.message : "Les statistiques n’ont pas pu être chargées."}</p>;
  if (!proof?.analyticsCapturedAt) {
    return (
      <EmptyState
        title="Aucune mesure enregistrée"
        description="Les lecteurs du livret sont mesurés (PostHog) quand une preuve sociale de l’édition est actualisée."
        action={<Link href={"/admin/organizers/social-proofs" as Route} className={linkClass}>Preuves sociales →</Link>}
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Lecteurs uniques</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{proof.uniqueReaders.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Ouvertures</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{proof.totalOpens.toLocaleString("fr-FR")}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Période du {formatDay(proof.analyticsFrom)} au {formatDay(proof.analyticsTo)} · mesuré le {formatBillingDate(proof.analyticsCapturedAt)} · preuve {proof.status === "published" ? "publiée" : "en brouillon"}.
      </p>
      <Link href={"/admin/organizers/social-proofs" as Route} className={`text-sm ${linkClass}`}>Actualiser dans Preuves sociales →</Link>
    </div>
  );
}

/**
 * Edition profile of Organisateurs (lot 5), opened by a row or `?edition=<id>` (`&fiche=`): Résumé,
 * Pack & modules (the former « Gérer le pack et les accès » dialog), Facturation (summary, register
 * link, invoice and bank-transfer dialogs), Demandes, Activité (stored social-proof statistics).
 */
export function EditionDrawer({ accessToken, editionId, tab, data, onTabChange, onClose }: {
  accessToken: string | null;
  editionId: string | null;
  tab: EditionDrawerTab;
  data: OrganizerAdminData;
  onTabChange: (tab: EditionDrawerTab) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  // Billing dialogs are siblings of the drawer (not inside it): its focus trap and Échap stay its own.
  const [invoiceTarget, setInvoiceTarget] = useState<OrganizerInvoiceTarget | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const editions = useBillingEditions(accessToken ?? "", transferOpen);
  const event = editionId ? data.publicationEvents.find((candidate) => candidate.editionId === editionId) ?? null : null;
  const pending = event ? editionPendingRequests(event, data) : null;
  const pendingCount = pending ? pending.claims.length + pending.publicationRequests.length + pending.editionRequests.length : 0;
  const packKey = event
    ? [event.editionId, event.entitlement?.tier, event.entitlement?.source, event.entitlement?.status, event.featureGrants.filter((grant) => grant.status === "active").map((grant) => grant.capability_key).sort().join(",")].join(":")
    : "";

  const afterChange = async (message: string, tone: "success" | "danger" = "success") => {
    toast.show({ message, tone });
    await data.load();
  };

  return (
    <>
    <Drawer
      open={Boolean(editionId)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={event ? `${event.name}${event.editionYear ? ` · ${event.editionYear}` : ""}` : "Fiche de l’édition"}
      description={event ? [event.location, organizerTierLabel[activeTier(event)]].filter(Boolean).join(" · ") : undefined}
      widthClassName="w-full max-w-2xl"
    >
      {!event ? (
        <p role="status" className="px-5 py-4 text-sm text-muted-foreground">
          {data.loaded ? "Cette édition est introuvable (supprimée, ou identifiant inconnu)." : "Chargement de l’édition…"}
        </p>
      ) : (
        <DrawerTabs<EditionDrawerTab>
          label="Sections de la fiche édition"
          active={tab}
          onChange={onTabChange}
          tabs={[
            { id: "resume", label: "Résumé" },
            { id: "pack", label: "Pack & modules" },
            { id: "facturation", label: "Facturation" },
            { id: "demandes", label: "Demandes", count: pendingCount },
            { id: "activite", label: "Activité" },
          ]}
        >
          {data.error ? <p role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{data.error}</p> : null}
          {tab === "resume" ? <SummaryTab event={event} data={data} /> : null}
          {tab === "pack" ? (
            event.editionId ? (
              <EditionPackForm
                key={packKey}
                accessToken={accessToken}
                event={event}
                featureCatalog={data.featureCatalog}
                onSaved={({ warning }) => afterChange(warning ?? "Pack et modules enregistrés.", warning ? "danger" : "success")}
              />
            ) : <p className="text-sm text-muted-foreground">Aucune édition : le pack ne peut pas être modifié.</p>
          ) : null}
          {tab === "facturation" ? <BillingTab event={event} onNewInvoice={setInvoiceTarget} onTransfer={() => setTransferOpen(true)} /> : null}
          {tab === "demandes" ? <RequestsTab event={event} data={data} /> : null}
          {tab === "activite" && accessToken ? <ActivityTab accessToken={accessToken} event={event} /> : null}
        </DrawerTabs>
      )}
    </Drawer>
    {accessToken ? (
      <>
    <OrganizerInvoiceDialog
      accessToken={accessToken ?? ""}
      target={invoiceTarget}
      onClose={() => setInvoiceTarget(null)}
      onIssued={(message) => {
        setInvoiceTarget(null);
        void afterChange(message);
      }}
    />
    <BankTransferDialog
      accessToken={accessToken ?? ""}
      open={transferOpen}
      defaultEditionId={event?.editionId ?? null}
      editions={editions.data?.editions ?? []}
      editionsLoading={editions.isLoading}
      editionsError={editions.error instanceof Error ? editions.error.message : null}
      onClose={() => setTransferOpen(false)}
      onRecorded={(message) => {
        setTransferOpen(false);
        void afterChange(message);
      }}
    />

      </>
    ) : null}
    </>
  );
}
