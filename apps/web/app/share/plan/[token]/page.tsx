import type { Metadata } from "next";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { z } from "zod";

import {
  departureTimeSchema,
  hashPlanShareToken,
  isValidPlanShareToken,
  localeSchema,
  planShareSnapshotSchema,
  type PlanShareSnapshot,
} from "../../../../lib/plan-share";
import { getSupabaseServiceConfig, type SupabaseServiceConfig } from "../../../../lib/supabase";
import { PlanShareCrewTimeline } from "./PlanShareCrewTimeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: {
    token: string;
  };
};

type PlanShareProduct = PlanShareSnapshot["productTotals"][number];

const LIGHT_SHARE_THEME_STYLE = {
  colorScheme: "light",
  "--background": "47 19% 91%",
  "--foreground": "0 0% 10%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 10%",
  "--muted": "43 26% 95%",
  "--muted-foreground": "0 0% 42%",
  "--surface-muted": "47 18% 90%",
  "--border": "44 13% 83%",
  "--border-strong": "44 7% 67%",
  "--input": "44 13% 83%",
  "--ring": "96 57% 20%",
  "--primary": "96 57% 20%",
  "--primary-foreground": "0 0% 100%",
  "--icon": "0 0% 10%",
  "--icon-muted": "0 0% 42%",
  "--brand": "96 57% 20%",
  "--brand-light": "96 51% 32%",
  "--brand-surface": "90 35% 91%",
  "--brand-border": "88 33% 70%",
  "--brand-foreground": "0 0% 100%",
  "--success": "96 57% 20%",
  "--success-foreground": "0 0% 100%",
} as CSSProperties;

const planShareRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  snapshot: planShareSnapshotSchema,
  departure_time: departureTimeSchema.nullable(),
  locale: localeSchema,
  plan_updated_at: z.string().nullable(),
  expires_at: z.string().nullable(),
});

type PlanShareRow = z.infer<typeof planShareRowSchema>;

const COPY = {
  fr: {
    title: "Récap équipe",
    unavailableTitle: "Lien indisponible",
    unavailableBody: "Ce récap n'existe plus, a expiré, ou le lien est incomplet.",
    hourlyTargets: "Cibles horaires",
    distance: "Distance",
    elevation: "D+",
    duration: "Durée estimée",
    products: "Produits",
    departure: "Départ",
    packList: "À préparer",
    crewPlan: "Équipe ravitos",
    carbs: "Glucides",
    sodium: "Sodium",
    noProducts: "Aucun produit planifié.",
    nothingToGive: "Rien à donner",
    give: "À donner",
    water: "Eau",
    pause: "Pause",
    sharedAt: "Lien généré",
    waterFull: "poche pleine {liters} L",
    waterRefill: "remplir la poche",
    waterUnavailable: "pas de recharge eau",
    waterFinish: "arrivée",
    solidUnavailable: "pas de solide",
    dayOffset: "J+{days}",
  },
  en: {
    title: "Crew recap",
    unavailableTitle: "Link unavailable",
    unavailableBody: "This recap no longer exists, has expired, or the link is incomplete.",
    hourlyTargets: "Hourly targets",
    distance: "Distance",
    elevation: "Gain",
    duration: "Estimated duration",
    products: "Products",
    departure: "Start",
    packList: "Pack list",
    crewPlan: "Crew aid stations",
    carbs: "Carbs",
    sodium: "Sodium",
    noProducts: "No planned products.",
    nothingToGive: "Nothing to give",
    give: "Give",
    water: "Water",
    pause: "Pause",
    sharedAt: "Generated",
    waterFull: "full bladder {liters} L",
    waterRefill: "refill the bladder",
    waterUnavailable: "no water refill",
    waterFinish: "finish",
    solidUnavailable: "no solids",
    dayOffset: "D+{days}",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Récap plan partagé | Pace Yourself",
    robots: {
      index: false,
      follow: false,
    },
  };
}

const serviceHeaders = (serviceConfig: SupabaseServiceConfig) => ({
  apikey: serviceConfig.supabaseServiceRoleKey,
  Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
});

async function loadPlanShare(token: string): Promise<PlanShareRow | null> {
  if (!isValidPlanShareToken(token)) return null;

  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return null;

  const params = new URLSearchParams();
  params.set("token_hash", `eq.${hashPlanShareToken(token)}`);
  params.set("revoked_at", "is.null");
  params.set("or", `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`);
  params.set(
    "select",
    "id,created_at,updated_at,snapshot,departure_time,locale,plan_updated_at,expires_at"
  );
  params.set("limit", "1");

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/plan_share_links?${params.toString()}`, {
    headers: serviceHeaders(serviceConfig),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to load plan share link", await response.text().catch(() => ""));
    return null;
  }

  const rows = (await response.json().catch(() => [])) as unknown[];
  const parsed = planShareRowSchema.safeParse(rows[0]);

  if (!parsed.success) {
    if (rows[0]) console.error("Invalid plan share row", parsed.error.flatten().fieldErrors);
    return null;
  }

  return parsed.data;
}

function formatDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours <= 0) return `${safeMinutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function formatKm(distanceKm: number) {
  const rounded = Number(distanceKm.toFixed(1));
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${formatted} km`;
}

function formatDate(value: string, locale: "fr" | "en") {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ProductRow({ product }: { product: PlanShareProduct }) {
  return (
    <li className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-foreground sm:text-base">{product.name}</p>
        {product.brand ? <p className="text-xs text-muted-foreground">{product.brand}</p> : null}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="font-mono text-sm font-bold text-brand">x{product.quantity}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {Math.round(product.carbsG)}g / {Math.round(product.sodiumMg)}mg
        </p>
      </div>
    </li>
  );
}

function LightShareShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={LIGHT_SHARE_THEME_STYLE}
      className="min-h-screen bg-background text-foreground"
    >
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between">
          <a href="/" aria-label="Pace Yourself" className="inline-flex">
            <Image
              src="/branding/logo-horizontal-v2.png"
              alt="Pace Yourself"
              width={213}
              height={50}
              priority
              unoptimized
              className="h-10 w-auto"
            />
          </a>
        </header>
        {children}
      </main>
    </div>
  );
}

function UnavailablePage() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">{COPY.fr.unavailableTitle}</h1>
        <p className="mt-3 text-muted-foreground">{COPY.fr.unavailableBody}</p>
      </div>
    </div>
  );
}

export default async function SharedPlanPage({ params }: PageProps) {
  const share = await loadPlanShare(params.token);

  if (!share) {
    return (
      <LightShareShell>
        <UnavailablePage />
      </LightShareShell>
    );
  }

  const summary = share.snapshot;
  const locale = share.locale;
  const copy = COPY[locale];
  const targetSummary = `${Math.round(summary.targetCarbsPerHour)} g/h - ${Math.round(
    summary.targetWaterPerHour
  )} ml/h - ${Math.round(summary.targetSodiumPerHour)} mg/h`;

  return (
    <LightShareShell>
      <div className="flex w-full flex-col gap-6">
      <section className="rounded-lg border border-brand-border bg-brand-surface p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-brand">{copy.title}</p>
            <h1 className="mt-2 break-words text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              {summary.name}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {copy.hourlyTargets} : {targetSummary}
            </p>
          </div>
          <div className="rounded-lg bg-card px-4 py-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{copy.departure}</p>
            <p className="font-mono text-2xl font-bold text-brand">{share.departure_time ?? "--:--"}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [copy.distance, formatKm(summary.distanceKm)],
            [copy.elevation, `${Math.round(summary.elevationGainM)} m`],
            [copy.duration, formatDuration(summary.totalDurationMin)],
            [copy.products, String(summary.totalProductUnits)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-brand-border bg-card p-4">
              <p className="font-mono text-xl font-bold text-brand">{value}</p>
              <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{copy.packList}</h2>
          <p className="mt-1 font-mono text-sm font-bold text-brand">
            {Math.round(summary.totalCarbsG)} g {copy.carbs} · {Math.round(summary.totalSodiumMg)} mg {copy.sodium}
          </p>
        </div>
        {summary.productTotals.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">{copy.noProducts}</div>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border bg-card">
            {summary.productTotals.map((product) => (
              <ProductRow key={product.productId} product={product} />
            ))}
          </ul>
        )}
      </section>

      <PlanShareCrewTimeline summary={summary} departureTime={share.departure_time} locale={locale} />

      <p className="text-center text-xs text-muted-foreground">
        {copy.sharedAt} : {formatDate(share.created_at, locale)}
      </p>
      </div>
    </LightShareShell>
  );
}
