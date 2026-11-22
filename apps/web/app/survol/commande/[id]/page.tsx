import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createFlyoverOrderRepository, FLYOVER_DELIVERY_HOURS, FLYOVER_MAP_PRESETS, FLYOVER_OFFERS, FLYOVER_STORY_MODES, getFlyoverMode, verifyFlyoverOrderToken, type FlyoverOrderRow } from "../../../../lib/flyover-orders";
import { formatParisDateTime, parisLocalToUtc } from "../../../../lib/social-posts";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre vidéo de survol", robots: { index: false, follow: false } };

type PageProps = { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> };

const STATUS_COPY: Record<FlyoverOrderRow["status"], { title: string; text: string }> = {
  pending_payment: { title: "Paiement en attente", text: "Nous n’avons pas encore reçu la confirmation du paiement. Cette page se met à jour dès qu’il est validé." },
  paid: { title: "Commande confirmée", text: "Nous écrivons le récit de votre parcours." },
  scripted: { title: "Récit écrit", text: "Nous enregistrons la voix off et lançons le rendu 3D." },
  rendering: { title: "Rendu en cours", text: "Le survol 3D est en cours de fabrication." },
  ready: { title: "Votre vidéo est prête", text: "" },
  failed: { title: "Nous reprenons votre vidéo", text: "La fabrication automatique a rencontré un problème : notre équipe la termine et vous écrit très vite." },
  expired: { title: "Commande non payée", text: "Le paiement n’a pas abouti. Vous pouvez repasser commande depuis la page Vidéo de survol." },
  refunded: { title: "Commande remboursée", text: "Cette commande a été remboursée." },
  cancelled: { title: "Commande annulée", text: "Cette commande a été annulée. Une question ? Répondez à l’e-mail de confirmation." },
};

const STEPS: Array<FlyoverOrderRow["status"]> = ["paid", "scripted", "rendering", "ready"];

/** Order page, reached from the Stripe return and the emails (signed link, never indexed). */
export default async function FlyoverOrderStatusPage({ params, searchParams }: PageProps) {
  const token = typeof searchParams?.t === "string" ? searchParams.t : null;
  if (!/^[0-9a-f-]{36}$/i.test(params.id) || !verifyFlyoverOrderToken(params.id, token)) notFound();
  const supabase = getSupabaseServiceConfig();
  if (!supabase) notFound();
  const order = await createFlyoverOrderRepository(supabase).get(params.id).catch(() => null);
  if (!order) notFound();

  const justPaid = searchParams?.paiement === "ok";
  const status = order.status === "pending_payment" && justPaid ? { title: "Paiement reçu, confirmation en cours", text: "Stripe nous confirme le paiement dans quelques instants : rechargez la page si besoin." } : STATUS_COPY[order.status];
  const publishAt = order.publish_local ? parisLocalToUtc(order.publish_local) : null;
  const stepIndex = STEPS.indexOf(order.status);
  const downloadHref = `/api/flyover-orders/${order.id}/download?t=${encodeURIComponent(token ?? "")}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <section className="rounded-3xl border border-brand-border bg-card p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-300">Vidéo de survol · {FLYOVER_OFFERS[order.offer].label}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{order.race_name}</h1>
        <h2 className="mt-5 text-lg font-semibold text-foreground">{status.title}</h2>
        {status.text ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{status.text}</p> : null}

        {stepIndex >= 0 && order.status !== "ready" ? (
          <>
            <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Avancement">
              {STEPS.map((step, index) => (
                <li key={step} className={`h-2 rounded-full ${index <= stepIndex ? "bg-brand dark:bg-emerald-400" : "bg-muted"}`} />
              ))}
            </ol>
            <p className="mt-3 text-sm text-muted-foreground">Vidéo prête sous {FLYOVER_DELIVERY_HOURS} h après le paiement : nous vous prévenons par e-mail à {order.contact_email}.</p>
          </>
        ) : null}

        {order.status === "ready" && order.offer === "download" ? (
          <div className="mt-4 space-y-2">
            <a href={downloadHref} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-brand-foreground transition hover:bg-brand-light dark:bg-emerald-400 dark:text-slate-950">
              Télécharger la vidéo (MP4)
            </a>
            <p className="text-sm text-muted-foreground">
              Disponible 30 jours{order.ready_at ? `, jusqu’au ${formatParisDateTime(new Date(Date.parse(order.ready_at) + 30 * 86_400_000).toISOString())}` : ""} : pensez à l’enregistrer.
            </p>
          </div>
        ) : null}

        {order.status === "ready" && order.offer === "collab" ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {order.error
              ? "La vidéo est prête ; nous confirmons sa programmation sur Instagram et revenons vers vous."
              : `Publication programmée sur le compte Instagram Pace Yourself le ${publishAt ? formatParisDateTime(publishAt.toISOString()) : "jour choisi"}, en collaboration avec @${order.instagram_handle}. Acceptez l’invitation de collaboration qu’Instagram enverra à votre compte.`}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-muted/50 p-5 text-sm leading-6 text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Votre commande</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt>Parcours</dt><dd className="text-foreground">{order.distance_km.toFixed(1).replace(".", ",")} km{order.elevation_gain_m ? ` · ${Math.round(order.elevation_gain_m)} m D+` : ""}</dd>
          <dt>Ravitos</dt><dd className="text-foreground">{order.aid_stations.length || "Aucun"}</dd>
          <dt>Format</dt><dd className="text-foreground">{FLYOVER_STORY_MODES[order.story_mode ?? getFlyoverMode(order.distance_km)].label}</dd>
          <dt>Fond de carte</dt><dd className="text-foreground">{FLYOVER_MAP_PRESETS[order.map_preset].label}</dd>
          <dt>Relief</dt><dd className="text-foreground">× {order.terrain_exaggeration.toFixed(1).replace(".", ",")}</dd>
          {order.instagram_handle ? (<><dt>Instagram</dt><dd className="text-foreground">@{order.instagram_handle}</dd></>) : null}
          {publishAt ? (<><dt>Publication</dt><dd className="text-foreground">{formatParisDateTime(publishAt.toISOString())}</dd></>) : null}
        </dl>
        <p className="mt-3">Une question ? Répondez à l’e-mail de confirmation.</p>
      </section>
    </div>
  );
}
