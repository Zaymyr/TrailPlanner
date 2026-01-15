"use client";
import { Analytics } from "@vercel/analytics/next";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import Script from "next/script";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from "../../../components/race-planner/TimelineIcons";
import { useI18n } from "../../i18n-provider";
import { useProductSelection } from "../../hooks/useProductSelection";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Locale, RacePlannerTranslations } from "../../../locales/types";
import type {
  AidStation,
  ElevationPoint,
  FormValues,
  SavedPlan,
  Segment,
  SegmentPlan,
  StationSupply,
} from "./types";
import { RACE_PLANNER_URL } from "../../seo";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SESSION_EMAIL_KEY } from "../../../lib/auth-storage";
import { defaultFuelProducts } from "../../../lib/default-products";
import { readLocalProducts } from "../../../lib/local-products";
import { fuelProductSchema, type FuelProduct } from "../../../lib/product-types";
import { fetchUserProfile } from "../../../lib/profile-client";
import { mapProductToSelection } from "../../../lib/product-preferences";
import { RacePlannerLayout } from "../../../components/race-planner/RacePlannerLayout";
import { CommandCenter } from "../../../components/race-planner/CommandCenter";
import { ActionPlan } from "../../../components/race-planner/ActionPlan";
import { PlanManager } from "../../../components/race-planner/PlanManager";
import { RaceCatalogModal } from "./components/RaceCatalogModal";
import type { UserEntitlements } from "../../../lib/entitlements";
import { defaultEntitlements, fetchEntitlements } from "../../../lib/entitlements-client";
import {
  clearRacePlannerStorage,
  readRacePlannerStorage,
  writeRacePlannerStorage,
} from "../../../lib/race-planner-storage";
import { formatClockTime, formatMinutes } from "./utils/format";
import { minutesPerKm, paceToSpeedKph, speedToPace } from "./utils/pacing";
import {
  buildPlannerGpx,
  parseGpx,
  type ParsedGpx,
} from "./utils/gpx";
import {
  dedupeAidStations,
  sanitizeAidStations,
  sanitizeElevationProfile,
  sanitizePlannerValues,
  sanitizeSegmentPlan,
} from "./utils/plan-sanitizers";
import { buildSegments } from "./utils/segments";
import { buildFuelProductEstimates, buildRaceTotals, type FuelProductEstimate } from "./utils/nutrition";

const MessageCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4 8.5 8.5 0 0 1-6.6 3.1 8.38 8.38 0 0 1-5.4-1.9L3 21l1.9-4.1a8.38 8.38 0 0 1-1.9-5.4 8.5 8.5 0 0 1 3.1-6.6 8.38 8.38 0 0 1 5.4-1.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </svg>
);

type CardTitleWithTooltipProps = {
  title: string;
  description: string;
};

const CardTitleWithTooltip = ({ title, description }: CardTitleWithTooltipProps) => (
  <CardTitle className="flex items-center gap-2">
    <span>{title}</span>
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      title={description}
      aria-label={description}
    >
      ?
    </span>
  </CardTitle>
);

const productListSchema = z.object({ products: z.array(fuelProductSchema) });

const mergeFuelProducts = (primary: FuelProduct[], secondary: FuelProduct[]) => {
  const productsById = new Map<string, FuelProduct>();
  primary.forEach((product) => productsById.set(product.id, product));
  secondary.forEach((product) => {
    if (!productsById.has(product.id)) {
      productsById.set(product.id, product);
    }
  });
  return Array.from(productsById.values());
};

type StripeInterval = "day" | "week" | "month" | "year";

const stripePriceResponseSchema = z.object({
  price: z.object({
    currency: z.string().min(1),
    unitAmount: z.number().nonnegative(),
    interval: z.enum(["day", "week", "month", "year"]).nullable(),
    intervalCount: z.number().int().positive().nullable().optional().default(null),
  }),
});

const intervalLabels: Record<Locale, Record<StripeInterval, { singular: string; plural: string }>> = {
  en: {
    day: { singular: "day", plural: "days" },
    week: { singular: "week", plural: "weeks" },
    month: { singular: "month", plural: "months" },
    year: { singular: "year", plural: "years" },
  },
  fr: {
    day: { singular: "jour", plural: "jours" },
    week: { singular: "semaine", plural: "semaines" },
    month: { singular: "mois", plural: "mois" },
    year: { singular: "an", plural: "ans" },
  },
};

const formatAidStationName = (template: string, index: number) =>
  template.replace("{index}", String(index));

const formatIntervalLabel = (interval: StripeInterval | null, count: number | null, locale: Locale) => {
  if (!interval) return null;

  const labels = intervalLabels[locale]?.[interval];
  if (!labels) return null;

  const safeCount = Math.max(count ?? 1, 1);
  const label = safeCount > 1 ? labels.plural : labels.singular;

  return safeCount > 1 ? `${safeCount} ${label}` : label;
};

const buildDefaultValues = (copy: RacePlannerTranslations): FormValues => ({
  raceDistanceKm: 50,
  elevationGain: 2200,
  paceType: "pace",
  paceMinutes: 6,
  paceSeconds: 30,
  speedKph: 9.2,
  targetIntakePerHour: 70,
  waterBagLiters: 1.5,
  waterIntakePerHour: 500,
  sodiumIntakePerHour: 600,
  startSupplies: [],
  aidStations: [
    { name: formatAidStationName(copy.defaults.aidStationName, 1), distanceKm: 10, waterRefill: true },
    { name: formatAidStationName(copy.defaults.aidStationName, 2), distanceKm: 20, waterRefill: true },
    { name: formatAidStationName(copy.defaults.aidStationName, 3), distanceKm: 30, waterRefill: true },
    { name: formatAidStationName(copy.defaults.aidStationName, 4), distanceKm: 40, waterRefill: true },
    { name: copy.defaults.finalBottles, distanceKm: 45, waterRefill: true },
  ],
  finishPlan: {},
});

const createSegmentPlanSchema = (validation: RacePlannerTranslations["validation"]) =>
  z.object({
    segmentMinutesOverride: z.coerce.number().nonnegative({ message: validation.nonNegative }).optional(),
    paceAdjustmentMinutesPerKm: z.coerce.number().optional(),
    pauseMinutes: z.coerce.number().nonnegative({ message: validation.nonNegative }).optional(),
    gelsPlanned: z.coerce.number().nonnegative({ message: validation.nonNegative }).optional(),
    pickupGels: z.coerce.number().nonnegative({ message: validation.nonNegative }).optional(),
    supplies: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.coerce.number().positive({ message: validation.nonNegative }),
        })
      )
      .optional(),
  });

const createAidStationSchema = (validation: RacePlannerTranslations["validation"]) =>
  createSegmentPlanSchema(validation).extend({
    name: z.string().min(1, validation.required),
    distanceKm: z.coerce.number().nonnegative({ message: validation.nonNegative }),
    waterRefill: z.coerce.boolean().optional().default(true),
  });

const createFormSchema = (copy: RacePlannerTranslations) =>
  z
    .object({
      raceDistanceKm: z.coerce.number().positive(copy.validation.raceDistance),
      elevationGain: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      paceType: z.enum(["pace", "speed"]),
      paceMinutes: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      paceSeconds: z.coerce
        .number()
        .min(0, { message: copy.validation.paceSecondsRange })
        .max(59, { message: copy.validation.paceSecondsRange }),
      speedKph: z.coerce.number().positive(copy.validation.speedPositive),
      targetIntakePerHour: z.coerce.number().positive(copy.validation.targetIntake),
      waterIntakePerHour: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      sodiumIntakePerHour: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      waterBagLiters: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      startSupplies: createSegmentPlanSchema(copy.validation).shape.supplies.optional(),
      aidStations: z.array(createAidStationSchema(copy.validation)).min(1, copy.validation.aidStationMin),
      finishPlan: createSegmentPlanSchema(copy.validation).optional(),
    })
    .superRefine((values, ctx) => {
      if (values.paceType === "pace" && values.paceMinutes === 0 && values.paceSeconds === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.validation.paceZero,
          path: ["paceMinutes"],
        });
      }
      if (values.paceType === "speed" && values.speedKph <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.validation.speedPositive,
          path: ["speedKph"],
        });
      }
    });

function slopeToColor(grade: number) {
  const clamped = Math.max(-0.25, Math.min(0.25, grade));
  const t = (clamped + 0.25) / 0.5;
  const start = { r: 59, g: 130, b: 246 }; // blue
  const end = { r: 239, g: 68, b: 68 }; // red
  const channel = (from: number, to: number) => Math.round(from + (to - from) * t);

  return `rgb(${channel(start.r, end.r)}, ${channel(start.g, end.g)}, ${channel(start.b, end.b)})`;
}

type EnrichedElevationPoint = ElevationPoint & {
  segmentGainM: number;
  segmentLossM: number;
  cumulativeGainM: number;
  cumulativeLossM: number;
  timeMinutes: number | null;
};

type ChartHoverState = {
  hoveredIndex: number | null;
  isPinned: boolean;
  setPinned: (pinned: boolean) => void;
  updateFromClientX: (clientX: number) => void;
  clearHover: () => void;
};

const findNearestPointIndex = (points: ElevationPoint[], distanceKm: number) => {
  if (points.length === 0) return null;
  let left = 0;
  let right = points.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const current = points[mid];
    if (!current) break;
    if (current.distanceKm === distanceKm) return mid;
    if (current.distanceKm < distanceKm) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  const leftPoint = points[left];
  const rightPoint = points[Math.max(left - 1, 0)];
  if (!leftPoint) return points.length - 1;
  if (!rightPoint) return 0;
  return Math.abs(leftPoint.distanceKm - distanceKm) < Math.abs(rightPoint.distanceKm - distanceKm) ? left : left - 1;
};

const useChartHover = (
  points: ElevationPoint[],
  getDistanceForClientX: (clientX: number) => number | null
): ChartHoverState => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isPinned, setPinned] = useState(false);
  const hoveredIndexRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingClientXRef = useRef<number | null>(null);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      pendingClientXRef.current = clientX;
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        const pendingClientX = pendingClientXRef.current;
        frameRef.current = null;
        if (pendingClientX === null) return;
        const distanceKm = getDistanceForClientX(pendingClientX);
        if (distanceKm === null) return;
        const nextIndex = findNearestPointIndex(points, distanceKm);
        if (nextIndex === null) return;
        if (hoveredIndexRef.current !== nextIndex) {
          hoveredIndexRef.current = nextIndex;
          setHoveredIndex(nextIndex);
        }
      });
    },
    [getDistanceForClientX, points]
  );

  const clearHover = useCallback(() => {
    hoveredIndexRef.current = null;
    setHoveredIndex(null);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    hoveredIndex,
    isPinned,
    setPinned,
    updateFromClientX,
    clearHover,
  };
};

type PlannerStorageValues = Partial<FormValues> & { startSupplies?: StationSupply[] };

const sanitizeRacePlannerStorage = (
  payload?: { values?: Partial<FormValues>; elevationProfile?: ElevationPoint[] } | null
): { values: Partial<FormValues>; elevationProfile: ElevationPoint[] } | null => {
  if (!payload) return null;

  const sanitizedValues = sanitizePlannerValues(payload.values);
  const sanitizedElevationProfile = sanitizeElevationProfile(payload.elevationProfile);

  if (!sanitizedValues) return null;

  return {
    values: sanitizedValues,
    elevationProfile: sanitizedElevationProfile,
  };
};

function mapSavedPlan(row: Record<string, unknown>): SavedPlan | null {
  const id = typeof row.id === "string" ? row.id : undefined;
  const name = typeof row.name === "string" ? row.name : undefined;
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString();

  if (!id || !name) return null;

  const plannerValues = sanitizePlannerValues(row.planner_values as Partial<FormValues>) ?? {};
  const elevationProfile = sanitizeElevationProfile(row.elevation_profile as ElevationPoint[]);

  return {
    id,
    name,
    updatedAt,
    plannerValues,
    elevationProfile,
  };
}


export function RacePlannerPageContent({ enableMobileNav = true }: { enableMobileNav?: boolean }) {
  const { t, locale } = useI18n();
  const racePlannerCopy = t.racePlanner;
  const premiumCopy = racePlannerCopy.account.premium;

  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: t.homeHero.heading,
      description: t.homeHero.description,
      url: RACE_PLANNER_URL,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: 0,
        priceCurrency: "USD",
      },
    }),
    [t.homeHero.description, t.homeHero.heading]
  );

  const formSchema = useMemo(() => createFormSchema(racePlannerCopy), [racePlannerCopy]);
  const defaultValues = useMemo(() => buildDefaultValues(racePlannerCopy), [racePlannerCopy]);
  const resolver = useMemo(() => zodResolver(formSchema), [formSchema]);

  const form = useForm<FormValues>({
    resolver,
    defaultValues,
    mode: "onChange",
  });
  const { register } = form;

  const sectionIds = {
    timeline: "race-timeline",
    courseProfile: "course-profile",
    pacing: "pacing-section",
    intake: "intake-section",
  } as const;

  const { fields, append, replace } = useFieldArray({ control: form.control, name: "aidStations" });
  const watchedValues = useWatch({ control: form.control, defaultValue: defaultValues });
  const startSupplies = form.watch("startSupplies") ?? [];
  const paceMinutesValue = form.watch("paceMinutes") ?? defaultValues.paceMinutes;
  const paceSecondsValue = form.watch("paceSeconds") ?? defaultValues.paceSeconds;
  const speedKphValue = form.watch("speedKph") ?? defaultValues.speedKph;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [planName, setPlanName] = useState("");
  const [session, setSession] = useState<{
    accessToken: string;
    refreshToken?: string;
    email?: string;
    role?: string;
    roles?: string[];
  } | null>(null);
  const [mobileView, setMobileView] = useState<"plan" | "settings">("plan");
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isRaceCatalogOpen, setIsRaceCatalogOpen] = useState(false);
  const [catalogSubmissionId, setCatalogSubmissionId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<"idle" | "signingIn" | "signingUp" | "checking">("idle");
  const [planStatus, setPlanStatus] = useState<"idle" | "saving">("idle");
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [fuelProducts, setFuelProducts] = useState<FuelProduct[]>(defaultFuelProducts);
  const { selectedProducts, replaceSelection, toggleProduct } = useProductSelection();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isCourseCollapsed, setIsCourseCollapsed] = useState(true);
  const [entitlements, setEntitlements] = useState<UserEntitlements>(defaultEntitlements);
  const [stripePrice, setStripePrice] = useState<z.infer<typeof stripePriceResponseSchema>["price"] | null>(null);
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "opening">("idle");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"autoFill" | "print" | "plans" | null>(null);
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

  useEffect(() => {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
    const isElectron = userAgent.includes("electron");
    const isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;

    setIsDesktopApp(isElectron || Boolean(isStandalone));
  }, []);

  const persistSession = useCallback(
    (accessToken: string, refreshToken?: string, email?: string, role?: string, roles?: string[]) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken) {
          window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        } else {
          window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        }

        if (email) {
          window.localStorage.setItem(SESSION_EMAIL_KEY, email);
        } else {
          window.localStorage.removeItem(SESSION_EMAIL_KEY);
        }
      }

      setSession({ accessToken, refreshToken, email, role, roles });
    },
    []
  );

  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.localStorage.removeItem(SESSION_EMAIL_KEY);
    }

    clearRacePlannerStorage();
    setSession(null);
    setSavedPlans([]);
    setActivePlanId(null);
    setEntitlements(defaultEntitlements);
    setUpgradeError(null);
  }, []);

  const refreshSavedPlans = useCallback(
    async (accessToken: string) => {
      try {
        const response = await fetch("/api/plans", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          setAccountError(racePlannerCopy.account.errors.fetchFailed);
          return;
        }

        const data = (await response.json()) as { plans?: Record<string, unknown>[] };
        const parsedPlans = (data.plans ?? [])
          .map((plan) => mapSavedPlan(plan))
          .filter((plan): plan is SavedPlan => Boolean(plan));
        setSavedPlans(parsedPlans);
      } catch (error) {
        console.error("Unable to fetch saved plans", error);
        setAccountError(racePlannerCopy.account.errors.fetchFailed);
      }
    },
    [racePlannerCopy.account.errors.fetchFailed]
  );

  const verifySession = useCallback(
    async (accessToken: string, emailHint?: string, refreshToken?: string) => {
      setAuthStatus("checking");
      setAccountError(null);

      try {
        const response = await fetch("/api/auth/session", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(refreshToken ? { "x-refresh-token": `Bearer ${refreshToken}` } : {}),
          },
          cache: "no-store",
        });

        if (!response.ok) {
          clearSession();
          setAuthStatus("idle");
          return;
        }

        const data = (await response.json()) as { user?: { email?: string; role?: string; roles?: string[] } };
        const email = data.user?.email ?? emailHint;
        persistSession(accessToken, refreshToken, email ?? undefined, data.user?.role, data.user?.roles);
        setAccountMessage(racePlannerCopy.account.messages.signedIn);
        await refreshSavedPlans(accessToken);
      } catch (error) {
        console.error("Unable to verify session", error);
        clearSession();
      } finally {
        setAuthStatus("idle");
      }
    },
    [clearSession, persistSession, racePlannerCopy.account.messages.signedIn, refreshSavedPlans]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY) ?? undefined;
    const storedEmail = window.localStorage.getItem(SESSION_EMAIL_KEY) ?? undefined;

    if (storedToken) {
      verifySession(storedToken, storedEmail ?? undefined, storedRefresh ?? undefined);
    }
  }, [verifySession]);

  useEffect(() => {
    const storedPlanner = readRacePlannerStorage<PlannerStorageValues, ElevationPoint[]>();
    const sanitized = sanitizeRacePlannerStorage(storedPlanner);

    if (!sanitized) {
      clearRacePlannerStorage();
      return;
    }

    const storedValues = sanitized.values;
    const sanitizedAidStations = sanitizeAidStations(storedValues.aidStations) ?? [];
    const aidStations =
      sanitizedAidStations.length > 0 ? dedupeAidStations(sanitizedAidStations) : defaultValues.aidStations;
    const startSupplies = sanitizeSegmentPlan({ supplies: storedValues.startSupplies }).supplies ?? [];

    const mergedValues: FormValues = {
      ...defaultValues,
      ...storedValues,
      aidStations,
      startSupplies,
      finishPlan: storedValues.finishPlan ?? defaultValues.finishPlan,
    };

    form.reset(mergedValues, { keepDefaultValues: true });
    setElevationProfile(sanitized.elevationProfile);
  }, [defaultValues, form]);

  useEffect(() => {
    const currentValues = form.getValues();
    const sanitizedValues = sanitizePlannerValues(currentValues);
    if (!sanitizedValues) return;

    writeRacePlannerStorage<PlannerStorageValues, ElevationPoint[]>({
      version: 1,
      values: sanitizedValues,
      elevationProfile: sanitizeElevationProfile(elevationProfile),
      updatedAt: new Date().toISOString(),
    });
  }, [elevationProfile, form, watchedValues]);

  useEffect(() => {
    if (!session?.accessToken) {
      setProfileError(null);
      return;
    }

    const abortController = new AbortController();
    setProfileError(null);

    const loadProfile = async () => {
      try {
        const data = await fetchUserProfile(session.accessToken, abortController.signal);
        if (abortController.signal.aborted) return;
        if (typeof data.waterBagLiters === "number") {
          form.setValue("waterBagLiters", data.waterBagLiters);
        }
        replaceSelection(data.favoriteProducts.map((product) => mapProductToSelection(product)));
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error("Unable to load profile", error);
        setProfileError(
          error instanceof Error ? error.message : racePlannerCopy.account.errors.fetchFailed
        );
      }
    };

    void loadProfile();

    return () => {
      abortController.abort();
    };
  }, [
    form,
    racePlannerCopy.account.errors.fetchFailed,
    replaceSelection,
    session?.accessToken,
  ]);

  useEffect(() => {
    if (!session?.accessToken) {
      setEntitlements(defaultEntitlements);
      return;
    }

    const abortController = new AbortController();

    fetchEntitlements(session.accessToken, abortController.signal)
      .then((result) => {
        if (!abortController.signal.aborted) {
          setEntitlements(result);
        }
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        console.error("Unable to load entitlements", error);
        setEntitlements(defaultEntitlements);
      });

    return () => abortController.abort();
  }, [session?.accessToken]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadStripePrice = async () => {
      try {
        const response = await fetch("/api/stripe/price", {
          cache: "no-store",
          signal: abortController.signal,
        });

        const data = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          const message = (data as { message?: string } | null)?.message ?? "Unable to load subscription price.";
          throw new Error(message);
        }

        const parsed = stripePriceResponseSchema.safeParse(data);

        if (!parsed.success) {
          throw new Error("Invalid Stripe price response.");
        }

        if (!abortController.signal.aborted) {
          setStripePrice({
            ...parsed.data.price,
            intervalCount: parsed.data.price.intervalCount ?? null,
          });
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error("Unable to load subscription price", error);
        setStripePrice(null);
      }
    };

    void loadStripePrice();

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const loadProducts = async () => {
      try {
        const response = await fetch("/api/products", {
          headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
          cache: "no-store",
          signal: abortController.signal,
        });

        const data = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          const message = (data as { message?: string } | null)?.message ?? racePlannerCopy.sections.gels.loadError;
          throw new Error(message);
        }

        const parsed = productListSchema.safeParse(data);

        if (!parsed.success) {
          throw new Error(racePlannerCopy.sections.gels.loadError);
        }

        if (!abortController.signal.aborted) {
          const localProducts = readLocalProducts();
          const baseProducts = parsed.data.products.length > 0 ? parsed.data.products : defaultFuelProducts;
          setFuelProducts(mergeFuelProducts(baseProducts, localProducts));
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error("Unable to load fuel products", error);
        const localProducts = readLocalProducts();
        setFuelProducts(mergeFuelProducts(defaultFuelProducts, localProducts));
      }
    };

    void loadProducts();

    return () => {
      abortController.abort();
    };
  }, [racePlannerCopy.sections.gels.loadError, session?.accessToken]);

  const formattedPremiumPrice = useMemo(() => {
    if (!stripePrice) return null;

    try {
      const formatter = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
        style: "currency",
        currency: stripePrice.currency,
      });

      const intervalLabel = formatIntervalLabel(stripePrice.interval, stripePrice.intervalCount, locale);
      const amount = formatter.format(stripePrice.unitAmount / 100);

      return intervalLabel ? `${amount}/${intervalLabel}` : amount;
    } catch (error) {
      console.error("Unable to format premium price", error);
      return null;
    }
  }, [locale, stripePrice]);

  const premiumPriceDisplay = useMemo(
    () => formattedPremiumPrice ?? premiumCopy.premiumModal.priceValue,
    [formattedPremiumPrice, premiumCopy.premiumModal.priceValue]
  );
  const sanitizedWatchedAidStations = sanitizeAidStations(watchedValues?.aidStations);

  const parsedValues = useMemo(() => formSchema.safeParse(watchedValues), [formSchema, watchedValues]);
  const segments = useMemo(
    () =>
      parsedValues.success
        ? buildSegments(
            parsedValues.data,
            racePlannerCopy.defaults.start,
            racePlannerCopy.defaults.finish,
            elevationProfile
          )
        : [],
    [elevationProfile, parsedValues, racePlannerCopy.defaults.finish, racePlannerCopy.defaults.start]
  );
  const baseMinutesPerKm = useMemo(
    () => (parsedValues.success ? minutesPerKm(parsedValues.data) : null),
    [parsedValues]
  );

  const raceTotals = useMemo(() => {
    if (!parsedValues.success) return null;

    return buildRaceTotals(segments);
  }, [parsedValues.success, segments]);

  const distanceForDuration =
    (parsedValues.success ? parsedValues.data.raceDistanceKm : watchedValues?.raceDistanceKm) ??
    defaultValues.raceDistanceKm;
  const projectedDurationMinutes =
    baseMinutesPerKm && Number.isFinite(distanceForDuration) && distanceForDuration > 0
      ? distanceForDuration * baseMinutesPerKm
      : null;
  const pacingOverviewDuration = raceTotals?.durationMinutes ?? projectedDurationMinutes ?? null;
  const isPremium = entitlements.isPremium;
  const allowExport = entitlements.allowExport || entitlements.isPremium;
  const allowAutoFill = entitlements.allowAutoFill || entitlements.isPremium;
  const planLimitReached =
    !entitlements.isPremium && Number.isFinite(entitlements.planLimit) && savedPlans.length >= entitlements.planLimit;
  const canSavePlan =
    entitlements.isPremium || !planLimitReached || Boolean(activePlanId) || Boolean(savedPlans.find((plan) => plan.id === activePlanId));

  const formatDistanceWithUnit = (value: number) =>
    `${value.toFixed(1)} ${racePlannerCopy.sections.timeline.distanceWithUnit}`;

  const formatFuelAmount = (value: number) =>
    racePlannerCopy.sections.timeline.fuelLabel.replace("{amount}", value.toFixed(0));

  const formatWaterAmount = (value: number) =>
    racePlannerCopy.sections.timeline.waterLabel.replace("{amount}", value.toFixed(0));

  const formatSodiumAmount = (value: number) =>
    racePlannerCopy.sections.timeline.sodiumLabel.replace("{amount}", value.toFixed(0));

  const mergedFuelProducts = useMemo(() => {
    const productsById = new Map<string, FuelProduct>();
    fuelProducts.forEach((product) => productsById.set(product.id, product));

    selectedProducts.forEach((product) => {
      if (!productsById.has(product.id)) {
        productsById.set(product.id, {
          id: product.id,
          slug: product.slug,
          sku: product.sku ?? undefined,
          name: product.name,
          productUrl: product.productUrl ?? undefined,
          caloriesKcal: product.caloriesKcal ?? 0,
          carbsGrams: product.carbsGrams,
          sodiumMg: product.sodiumMg ?? 0,
          proteinGrams: 0,
          fatGrams: 0,
          waterMl: 0,
        });
      }
    });

    return Array.from(productsById.values());
  }, [fuelProducts, selectedProducts]);

  const fuelProductEstimates = useMemo<FuelProductEstimate[]>(
    () => buildFuelProductEstimates(mergedFuelProducts, raceTotals),
    [mergedFuelProducts, raceTotals]
  );

  const scrollToSection = (sectionId: (typeof sectionIds)[keyof typeof sectionIds]) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ block: "start" });
    }
  };

  const focusSection = (sectionId: (typeof sectionIds)[keyof typeof sectionIds], view: "plan" | "settings") => {
    setMobileView(view);
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => scrollToSection(sectionId));
    } else {
      scrollToSection(sectionId);
    }
  };

  const handleUpgrade = useCallback(async () => {
    if (!session?.accessToken) {
      setUpgradeError(racePlannerCopy.account.errors.missingSession);
      return;
    }

    setUpgradeStatus("opening");
    setUpgradeError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.message ?? premiumCopy.checkoutError);
      }

      const popup = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!popup) {
        setUpgradeError(premiumCopy.premiumModal.popupBlocked);
        return;
      }

      popup.opener = null;
      popup.focus();
      setUpgradeDialogOpen(false);
    } catch (error) {
      console.error("Unable to open checkout", error);
      setUpgradeError(error instanceof Error ? error.message : premiumCopy.checkoutError);
    } finally {
      setUpgradeStatus("idle");
    }
  }, [
    premiumCopy.checkoutError,
    premiumCopy.premiumModal.popupBlocked,
    racePlannerCopy.account.errors.missingSession,
    session?.accessToken,
    setUpgradeDialogOpen,
  ]);

  const requestPremiumUpgrade = useCallback(
    (message?: string, reason: "autoFill" | "print" | "plans" = "plans") => {
      if (message) {
        setAccountError(message);
      }
      setUpgradeReason(reason);
      setUpgradeDialogOpen(true);
      setUpgradeError(null);
    },
    [setAccountError, setUpgradeDialogOpen, setUpgradeError, setUpgradeReason]
  );

  const handlePremiumFeature = useCallback(
    (reason: "autoFill" | "print") => {
      const message = reason === "autoFill" ? premiumCopy.autoFillLocked : premiumCopy.printLocked;
      requestPremiumUpgrade(message, reason);
    },
    [premiumCopy.autoFillLocked, premiumCopy.printLocked, requestPremiumUpgrade]
  );

  const handleSignOut = () => {
    setAccountMessage(null);
    setAccountError(null);
    clearSession();
    setPlanName("");
  };

  const handleSavePlan = async () => {
    setAccountError(null);
    setAccountMessage(null);

    if (!session?.accessToken) {
      setAccountError(racePlannerCopy.account.errors.missingSession);
      return;
    }

    if (!parsedValues.success) {
      setAccountError(racePlannerCopy.account.errors.saveFailed);
      return;
    }

    const trimmedName = planName.trim() || racePlannerCopy.account.plans.defaultName;
    const existingPlanByName = savedPlans.find(
      (plan) => plan.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (planLimitReached && !existingPlanByName) {
      setAccountError(premiumCopy.planLimitReached);
      requestPremiumUpgrade(premiumCopy.planLimitReached, "plans");
      return;
    }

    setPlanStatus("saving");

    try {
      const sanitizedAidStations = dedupeAidStations(sanitizeAidStations(parsedValues.data.aidStations));
      const sanitizedFinishPlan = sanitizeSegmentPlan(parsedValues.data.finishPlan);

      const plannerValues: FormValues = {
        ...parsedValues.data,
        aidStations: sanitizedAidStations,
        finishPlan: sanitizedFinishPlan,
        startSupplies: sanitizeSegmentPlan({ supplies: parsedValues.data.startSupplies }).supplies ?? [],
      };

      const planIdToUpdate = existingPlanByName?.id ?? null;

      const payload = {
        name: trimmedName,
        plannerValues,
        elevationProfile: sanitizeElevationProfile(elevationProfile),
      };

      const response = await fetch("/api/plans", {
        method: planIdToUpdate ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(planIdToUpdate ? { ...payload, id: planIdToUpdate } : payload),
      });

      const data = (await response.json().catch(() => null)) as {
        plan?: Record<string, unknown> | null;
        message?: string;
      };

      if (response.status === 402) {
        setAccountError(data?.message ?? premiumCopy.planLimitReached);
        requestPremiumUpgrade(data?.message ?? premiumCopy.planLimitReached, "plans");
        return;
      }

      if (!response.ok || !data?.plan) {
        setAccountError(data?.message ?? racePlannerCopy.account.errors.saveFailed);
        return;
      }

      const parsedPlan = mapSavedPlan(data.plan);

      if (parsedPlan) {
        setSavedPlans((previous) => [parsedPlan, ...previous.filter((plan) => plan.id !== parsedPlan.id)]);
        setPlanName(parsedPlan.name);
        setActivePlanId(parsedPlan.id);
      }

      setAccountMessage(racePlannerCopy.account.messages.savedPlan);
    } catch (error) {
      console.error("Unable to save plan", error);
      setAccountError(racePlannerCopy.account.errors.saveFailed);
    } finally {
      setPlanStatus("idle");
    }
  };

  const handleLoadPlan = (plan: SavedPlan, message: string = racePlannerCopy.account.messages.loadedPlan) => {
    const sanitizedAidStations = sanitizeAidStations(plan.plannerValues.aidStations) ?? [];
    const aidStations = sanitizedAidStations.length > 0 ? dedupeAidStations(sanitizedAidStations) : defaultValues.aidStations;
    const startSupplies = sanitizeSegmentPlan({ supplies: plan.plannerValues.startSupplies }).supplies ?? [];

    const mergedValues: FormValues = {
      ...defaultValues,
      ...plan.plannerValues,
      aidStations,
      startSupplies,
      finishPlan: plan.plannerValues.finishPlan ?? defaultValues.finishPlan,
    };

    form.reset(mergedValues, { keepDefaultValues: true });
    setElevationProfile(plan.elevationProfile);
    setPlanName(plan.name);
    setActivePlanId(plan.id);
    setAccountMessage(message);
  };

  const handleUseCatalogRace = async (raceId: string) => {
    setAccountError(null);
    setAccountMessage(null);

    if (!session?.accessToken) {
      setAccountError(racePlannerCopy.raceCatalog.errors.authRequired);
      return;
    }

    setCatalogSubmissionId(raceId);

    try {
      const response = await fetch("/api/plans/from-catalog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ catalogRaceId: raceId }),
      });

      const data = (await response.json().catch(() => null)) as { plan?: Record<string, unknown>; message?: string } | null;

      if (response.status === 402) {
        const message = data?.message ?? premiumCopy.planLimitReached;
        setAccountError(message);
        requestPremiumUpgrade(message, "plans");
        return;
      }

      if (!response.ok || !data?.plan) {
        setAccountError(data?.message ?? racePlannerCopy.raceCatalog.errors.createFailed);
        return;
      }

      const parsedPlan = mapSavedPlan(data.plan);

      if (!parsedPlan) {
        setAccountError(racePlannerCopy.raceCatalog.errors.createFailed);
        return;
      }

      setSavedPlans((previous) => [parsedPlan, ...previous.filter((plan) => plan.id !== parsedPlan.id)]);
      setPlanName(parsedPlan.name);
      setActivePlanId(parsedPlan.id);
      handleLoadPlan(parsedPlan, racePlannerCopy.raceCatalog.messages.created);
      setIsRaceCatalogOpen(false);
    } catch (error) {
      console.error("Unable to create plan from catalog", error);
      setAccountError(racePlannerCopy.raceCatalog.errors.createFailed);
    } finally {
      setCatalogSubmissionId(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setAccountError(null);
    setAccountMessage(null);

    if (!session?.accessToken) {
      setAccountError(racePlannerCopy.account.errors.missingSession);
      return;
    }

    setDeletingPlanId(planId);

    try {
      const response = await fetch("/api/plans", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ id: planId }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setAccountError(data?.message ?? racePlannerCopy.account.errors.deleteFailed);
        return;
      }

      setSavedPlans((previous) => previous.filter((plan) => plan.id !== planId));
      setAccountMessage(racePlannerCopy.account.messages.deletedPlan);
    } catch (error) {
      console.error("Unable to delete plan", error);
      setAccountError(racePlannerCopy.account.errors.deleteFailed);
    } finally {
      setDeletingPlanId(null);
      setActivePlanId((current) => (current === planId ? null : current));
    }
  };

  const handleRefreshPlans = () => {
    if (session?.accessToken) {
      refreshSavedPlans(session.accessToken);
    }
  };

  const handleMobileImport = () => {
    focusSection(sectionIds.courseProfile, "plan");
    const input = fileInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  };

  const mobileNavActions = [
    {
      key: "import",
      label: racePlannerCopy.mobileNav.importGpx,
      onClick: handleMobileImport,
    },
    {
      key: "timeline",
      label: racePlannerCopy.mobileNav.timeline,
      onClick: () => focusSection(sectionIds.timeline, "plan"),
    },
    {
      key: "pacing",
      label: racePlannerCopy.mobileNav.pacing,
      onClick: () => focusSection(sectionIds.pacing, "plan"),
    },
    {
      key: "intake",
      label: racePlannerCopy.mobileNav.intake,
      onClick: () => focusSection(sectionIds.intake, "plan"),
    },
  ];

  const handlePaceUpdate = useCallback(
    (minutes: number, seconds: number) => {
      const safeMinutes = Number.isFinite(minutes) && minutes >= 0 ? Math.floor(minutes) : 0;
      let safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : 0;
      let normalizedMinutes = safeMinutes;
      if (safeSeconds >= 60) {
        normalizedMinutes += Math.floor(safeSeconds / 60);
        safeSeconds %= 60;
      }
      form.setValue("paceMinutes", normalizedMinutes, { shouldDirty: true, shouldValidate: true });
      form.setValue("paceSeconds", safeSeconds, { shouldDirty: true, shouldValidate: true });
      const convertedSpeed = paceToSpeedKph(normalizedMinutes, safeSeconds);
      if (convertedSpeed) {
        form.setValue("speedKph", Number(convertedSpeed.toFixed(2)), { shouldDirty: true, shouldValidate: true });
      }
      form.setValue("paceType", "pace", { shouldDirty: true, shouldValidate: true });
    },
    [form]
  );

  const handleSpeedUpdate = useCallback(
    (speed: number) => {
      const safeSpeed = Number.isFinite(speed) && speed >= 0 ? speed : 0;
      form.setValue("speedKph", safeSpeed, { shouldDirty: true, shouldValidate: true });
      const convertedPace = speedToPace(safeSpeed);
      if (convertedPace) {
        form.setValue("paceMinutes", convertedPace.minutes, { shouldDirty: true, shouldValidate: true });
        form.setValue("paceSeconds", convertedPace.seconds, { shouldDirty: true, shouldValidate: true });
      }
      form.setValue("paceType", "speed", { shouldDirty: true, shouldValidate: true });
    },
    [form]
  );

  const handleImportGpx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsedGpx = parseGpx(content, racePlannerCopy);
      const fallbackDistance = parsedGpx.distanceKm || defaultValues.raceDistanceKm;
      const fallbackStations =
        parsedGpx.aidStations.length > 0
          ? parsedGpx.aidStations
          : [{ name: racePlannerCopy.defaults.finish, distanceKm: Number(fallbackDistance.toFixed(1)) }];

      if (parsedGpx.plannerValues) {
        const plannerAidStations = sanitizeAidStations(parsedGpx.plannerValues.aidStations);
        const mergedAidStations = plannerAidStations.length > 0 ? plannerAidStations : fallbackStations;
        const mergedValues: FormValues = {
          ...defaultValues,
          ...parsedGpx.plannerValues,
          raceDistanceKm: parsedGpx.plannerValues.raceDistanceKm ?? fallbackDistance,
          aidStations: mergedAidStations,
          finishPlan: parsedGpx.plannerValues.finishPlan ?? defaultValues.finishPlan,
        };
        form.reset(mergedValues, { keepDefaultValues: true });
      } else {
        form.setValue("raceDistanceKm", Number(fallbackDistance.toFixed(1)));
        form.setValue("aidStations", fallbackStations);
      }

      setElevationProfile(parsedGpx.elevationProfile);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : racePlannerCopy.gpx.errors.unableToImport);
    } finally {
      event.target.value = "";
    }
  };

  const handleExportGpx = () => {
    const currentValues = form.getValues();
    const sanitizedStations = sanitizeAidStations(currentValues.aidStations);
    const finishPlan = sanitizeSegmentPlan(currentValues.finishPlan);
    const raceDistanceKm =
      Number.isFinite(currentValues.raceDistanceKm) && currentValues.raceDistanceKm !== null
        ? currentValues.raceDistanceKm
        : defaultValues.raceDistanceKm;

    const values: FormValues = {
      ...defaultValues,
      ...currentValues,
      raceDistanceKm,
      aidStations:
        sanitizedStations.length > 0
          ? sanitizedStations
          : [{ name: racePlannerCopy.defaults.finish, distanceKm: Number(raceDistanceKm.toFixed(1)) }],
      finishPlan,
    };

    const gpxContent = buildPlannerGpx(values, elevationProfile);
    const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trailplanner.gpx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  const handleSubmitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = feedbackSubject.trim();
    const detail = feedbackDetail.trim();

    if (!subject || !detail) {
      setFeedbackStatus("error");
      setFeedbackError(racePlannerCopy.sections.summary.feedback.required);
      return;
    }

    try {
      setFeedbackStatus("submitting");
      setFeedbackError(null);

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, detail }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setFeedbackStatus("error");
        setFeedbackError(payload?.message ?? racePlannerCopy.sections.summary.feedback.error);
        return;
      }

      setFeedbackStatus("success");
      setFeedbackSubject("");
      setFeedbackDetail("");
    } catch (error) {
      console.error("Unable to send feedback", error);
      setFeedbackStatus("error");
      setFeedbackError(racePlannerCopy.sections.summary.feedback.error);
    }
  };

  const openFeedbackForm = () => {
    setFeedbackOpen(true);
    setFeedbackStatus("idle");
    setFeedbackError(null);
  };

  const closeFeedbackForm = () => {
    setFeedbackOpen(false);
    setFeedbackError(null);
    setFeedbackStatus("idle");
  };

  const pagePaddingClass = enableMobileNav ? "pb-28 xl:pb-6" : "pb-6 xl:pb-6";
  const feedbackButtonOffsetClass = enableMobileNav ? "bottom-20" : "bottom-6";
  const handleAddAidStation = useCallback(
    (station?: { name: string; distanceKm: number }) => {
      append({
        name: station?.name ?? formatAidStationName(racePlannerCopy.defaults.aidStationName, fields.length + 1),
        distanceKm: station?.distanceKm ?? 0,
      });
    },
    [append, fields.length, racePlannerCopy.defaults.aidStationName]
  );

  const handleRemoveAidStation = useCallback(
    (index: number) => {
      if (!Number.isInteger(index)) return;

      const current = form.getValues("aidStations");
      if (!Array.isArray(current) || index < 0 || index >= current.length) return;

      const nextStations = current.filter((_, stationIndex) => stationIndex !== index);
      replace(nextStations);
      form.setValue("aidStations", nextStations, { shouldDirty: true, shouldValidate: true });
    },
    [form, replace]
  );

  const handleSupplyDrop = useCallback(
    (aidStationIndex: number, productId: string, quantity = 1) => {
      const current = form.getValues(`aidStations.${aidStationIndex}.supplies`) ?? [];
      const sanitized = sanitizeSegmentPlan({ supplies: current }).supplies ?? [];
      const existing = sanitized.find((supply) => supply.productId === productId);
      const nextSupplies: StationSupply[] = existing
        ? sanitized.map((supply) =>
            supply.productId === productId ? { ...supply, quantity: supply.quantity + quantity } : supply
          )
        : [...sanitized, { productId, quantity }];

      form.setValue(`aidStations.${aidStationIndex}.supplies`, nextSupplies, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form]
  );

  const handleSupplyRemove = useCallback(
    (aidStationIndex: number, productId: string) => {
      const current = form.getValues(`aidStations.${aidStationIndex}.supplies`) ?? [];
      const sanitized = sanitizeSegmentPlan({ supplies: current }).supplies ?? [];
      const filtered = sanitized.filter((supply) => supply.productId !== productId);

      form.setValue(`aidStations.${aidStationIndex}.supplies`, filtered, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form]
  );

  const handleStartSupplyDrop = useCallback((productId: string, quantity = 1) => {
    const current = form.getValues("startSupplies") ?? [];
    const sanitized = sanitizeSegmentPlan({ supplies: current }).supplies ?? [];
    const existing = sanitized.find((supply) => supply.productId === productId);
    const nextSupplies: StationSupply[] = existing
      ? sanitized.map((supply) =>
          supply.productId === productId ? { ...supply, quantity: supply.quantity + quantity } : supply
        )
      : [...sanitized, { productId, quantity }];

    form.setValue("startSupplies", nextSupplies, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const handleStartSupplyRemove = useCallback((productId: string) => {
    const current = form.getValues("startSupplies") ?? [];
    const sanitized = sanitizeSegmentPlan({ supplies: current }).supplies ?? [];
    const filtered = sanitized.filter((supply) => supply.productId !== productId);

    form.setValue("startSupplies", filtered, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const handleAutomaticFill = useCallback(() => {
    if (segments.length === 0) return;

    const productOptions = (() => {
      const mergedById = new Map(mergedFuelProducts.map((product) => [product.id, product]));

      const favoriteMatches = selectedProducts
        .map((favorite) => mergedById.get(favorite.id) ?? mergedFuelProducts.find((product) => product.slug === favorite.slug))
        .filter((product): product is FuelProduct => Boolean(product && product.carbsGrams > 0));

      if (favoriteMatches.length > 0) {
        return favoriteMatches;
      }

      return mergedFuelProducts.filter((product) => product.carbsGrams > 0);
    })();

    if (productOptions.length === 0) return;

    const buildPlanForTarget = (targetFuelGrams: number, targetSodiumMg: number): StationSupply[] => {
      if (!Number.isFinite(targetFuelGrams) || targetFuelGrams <= 0) return [];

      const options = productOptions
        .slice()
        .sort((a, b) => b.carbsGrams - a.carbsGrams)
        .slice(0, 3)
        .map((product) => ({
        id: product.id,
        carbs: Math.max(product.carbsGrams, 0),
        sodium: Math.max(product.sodiumMg ?? 0, 0),
      }));

      const minCarbs = Math.max(Math.min(...options.map((option) => option.carbs)), 1);
      const maxUnits = Math.min(12, Math.max(3, Math.ceil(targetFuelGrams / minCarbs) + 2));
      const best = { score: Number.POSITIVE_INFINITY, combo: [] as number[] };

      const evaluateCombo = (combo: number[]) => {
        const plannedCarbs = combo.reduce((total, qty, index) => total + qty * options[index].carbs, 0);
        const plannedSodium = combo.reduce((total, qty, index) => total + qty * options[index].sodium, 0);
        const carbDiff = Math.abs(plannedCarbs - targetFuelGrams) / Math.max(targetFuelGrams, 1);
        const sodiumDiff =
          targetSodiumMg > 0 ? Math.abs(plannedSodium - targetSodiumMg) / targetSodiumMg : 0;
        const underfillPenalty = plannedCarbs < targetFuelGrams ? 0.2 : 0;
        const itemPenalty = combo.reduce((sum, qty) => sum + qty, 0) * 0.01;
        const score = carbDiff * 1.5 + sodiumDiff * 0.5 + underfillPenalty + itemPenalty;

        if (score < best.score && plannedCarbs > 0) {
          best.score = score;
          best.combo = combo.slice();
        }
      };

      const search = (index: number, combo: number[], totalUnits: number) => {
        if (index === options.length) {
          evaluateCombo(combo);
          return;
        }

        const remainingSlots = maxUnits - totalUnits;
        for (let qty = 0; qty <= remainingSlots; qty += 1) {
          combo[index] = qty;
          search(index + 1, combo, totalUnits + qty);
        }
      };

      search(0, new Array(options.length).fill(0), 0);

      if (best.score === Number.POSITIVE_INFINITY || best.combo.every((qty) => qty === 0)) {
        return [];
      }

      return best.combo
        .map((qty, index) => ({ productId: options[index].id, quantity: qty }))
        .filter((supply) => supply.quantity > 0);
    };

    const firstSegment = segments[0];
    if (firstSegment) {
      const startPlan = buildPlanForTarget(firstSegment.targetFuelGrams, firstSegment.targetSodiumMg);
      form.setValue("startSupplies", startPlan, { shouldDirty: true, shouldValidate: true });
    }

    segments.forEach((segment, index) => {
      const nextSegment = segments[index + 1];
      if (!nextSegment || typeof segment.aidStationIndex !== "number") return;

      const supplies = buildPlanForTarget(nextSegment.targetFuelGrams, nextSegment.targetSodiumMg);
      form.setValue(`aidStations.${segment.aidStationIndex}.supplies`, supplies, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  }, [form, mergedFuelProducts, segments, selectedProducts]);

  const courseProfileSection = (
    <Card id={sectionIds.courseProfile} className="relative overflow-hidden">
      <CardHeader className="space-y-0 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitleWithTooltip
            title={racePlannerCopy.sections.courseProfile.title}
            description={racePlannerCopy.sections.courseProfile.description}
          />
          {isCourseCollapsed ? (
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,application/gpx+xml"
                className="hidden"
                onChange={handleImportGpx}
              />
              <Button
                variant="outline"
                type="button"
                className="h-9 px-3 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                {racePlannerCopy.buttons.importGpx}
              </Button>
              <Button
                variant="outline"
                type="button"
                className="h-9 px-3 text-xs"
                onClick={() => setIsRaceCatalogOpen(true)}
              >
                {racePlannerCopy.buttons.chooseRace}
              </Button>
              <Button
                type="button"
                className="relative h-9 px-3 text-xs"
                onClick={allowExport ? handleExportGpx : () => requestPremiumUpgrade(premiumCopy.exportLocked)}
                variant={allowExport ? "default" : "outline"}
              >
                <span className="flex items-center gap-1.5" title={!allowExport ? "Premium feature" : undefined}>
                  {!allowExport ? (
                    <SparklesIcon
                      className="h-3.5 w-3.5 text-muted-foreground dark:text-slate-100/60"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : null}
                  <span>{racePlannerCopy.buttons.exportGpx}</span>
                </span>
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="raceDistanceKm" className="text-[11px] text-muted-foreground dark:text-slate-300">
                    {racePlannerCopy.sections.raceInputs.fields.raceDistance}
                  </Label>
                  <Input
                    id="raceDistanceKm"
                    type="number"
                    step="0.5"
                    className="h-8 w-[110px] border-border bg-background text-xs text-foreground placeholder:text-muted-foreground dark:border-slate-800/70 dark:bg-slate-950/80 dark:text-slate-50"
                    {...register("raceDistanceKm", { valueAsNumber: true })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="elevationGain" className="text-[11px] text-muted-foreground dark:text-slate-300">
                    {racePlannerCopy.sections.raceInputs.fields.elevationGain}
                  </Label>
                  <Input
                    id="elevationGain"
                    type="number"
                    min="0"
                    step="50"
                    className="h-8 w-[110px] border-border bg-background text-xs text-foreground placeholder:text-muted-foreground dark:border-slate-800/70 dark:bg-slate-950/80 dark:text-slate-50"
                    {...register("elevationGain", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-10 sm:px-6">
        {(() => {
          const courseControls = (
            <div className="w-full max-w-xl space-y-4 rounded-lg border border-border bg-card p-4 dark:border-slate-800 dark:bg-slate-950/60 lg:ml-auto">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground dark:text-slate-50">
                  {racePlannerCopy.sections.raceInputs.courseTitle}
                </p>
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  {racePlannerCopy.sections.raceInputs.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  type="button"
                  className="h-9 px-3 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {racePlannerCopy.buttons.importGpx}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="h-9 px-3 text-xs"
                  onClick={() => setIsRaceCatalogOpen(true)}
                >
                  {racePlannerCopy.buttons.chooseRace}
                </Button>
                <Button
                  type="button"
                  className="relative h-9 px-3 text-xs"
                  onClick={allowExport ? handleExportGpx : () => requestPremiumUpgrade(premiumCopy.exportLocked)}
                  variant={allowExport ? "default" : "outline"}
                >
                  <span className="flex items-center gap-1.5" title={!allowExport ? "Premium feature" : undefined}>
                    {!allowExport ? (
                      <SparklesIcon
                        className="h-3.5 w-3.5 text-muted-foreground dark:text-slate-100/60"
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : null}
                    <span>{racePlannerCopy.buttons.exportGpx}</span>
                  </span>
                </Button>
              </div>
              {importError ? <p className="text-xs text-red-400">{importError}</p> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="raceDistanceKm" className="text-xs text-muted-foreground dark:text-slate-200">
                    {racePlannerCopy.sections.raceInputs.fields.raceDistance}
                  </Label>
                  <Input
                    id="raceDistanceKm"
                    type="number"
                    step="0.5"
                    className="border-border bg-background text-sm text-foreground placeholder:text-muted-foreground dark:border-slate-800/70 dark:bg-slate-950/80 dark:text-slate-50"
                    {...register("raceDistanceKm", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="elevationGain" className="text-xs text-muted-foreground dark:text-slate-200">
                    {racePlannerCopy.sections.raceInputs.fields.elevationGain}
                  </Label>
                  <Input
                    id="elevationGain"
                    type="number"
                    min="0"
                    step="50"
                    className="border-border bg-background text-sm text-foreground placeholder:text-muted-foreground dark:border-slate-800/70 dark:bg-slate-950/80 dark:text-slate-50"
                    {...register("elevationGain", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
          );

          if (isCourseCollapsed) {
            return null;
          }

          return (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
              <div className="min-h-[240px] w-full rounded-lg border border-border bg-card p-4 dark:border-slate-800/70 dark:bg-slate-950/40">
                <ElevationProfileChart
                  profile={elevationProfile}
                  aidStations={parsedValues.success ? parsedValues.data.aidStations : sanitizedWatchedAidStations}
                  segments={segments}
                  totalDistanceKm={
                    (parsedValues.success ? parsedValues.data.raceDistanceKm : watchedValues?.raceDistanceKm) ??
                    defaultValues.raceDistanceKm
                  }
                  copy={racePlannerCopy}
                  baseMinutesPerKm={baseMinutesPerKm}
                />
              </div>

              {courseControls}
            </div>
          );
        })()}
      </CardContent>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
        <Button
          type="button"
          variant="ghost"
          className="pointer-events-auto h-10 w-10 rounded-full border border-border bg-card text-foreground shadow-md hover:bg-muted dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-100 dark:hover:bg-slate-900/60"
          aria-label={isCourseCollapsed ? "Expand course profile" : "Collapse course profile"}
          onClick={() => setIsCourseCollapsed((prev) => !prev)}
        >
          {isCourseCollapsed ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
        </Button>
      </div>
    </Card>
  );
  const planPrimaryContent = (
    <div className="space-y-6">
      {session?.accessToken && profileError ? (
        <p className="text-sm text-amber-200">{profileError}</p>
      ) : null}
      <CommandCenter
        copy={racePlannerCopy}
        sectionIds={{ pacing: sectionIds.pacing, intake: sectionIds.intake }}
        pacing={{
          durationMinutes: pacingOverviewDuration,
          paceMinutes: paceMinutesValue,
          paceSeconds: paceSecondsValue,
          speedKph: speedKphValue,
        }}
        register={register}
        onPaceChange={handlePaceUpdate}
        onSpeedChange={handleSpeedUpdate}
        formatDuration={(totalMinutes) => formatMinutes(totalMinutes, racePlannerCopy.units)}
      />

      <ActionPlan
        copy={racePlannerCopy}
        segments={segments}
        raceTotals={raceTotals}
        sectionId={sectionIds.timeline}
        onPrint={handlePrint}
        onAutomaticFill={handleAutomaticFill}
        onAddAidStation={handleAddAidStation}
        onRemoveAidStation={handleRemoveAidStation}
        register={form.register}
        setValue={form.setValue}
        formatDistanceWithUnit={formatDistanceWithUnit}
        formatMinutes={(minutes) => formatMinutes(minutes, racePlannerCopy.units)}
        formatFuelAmount={formatFuelAmount}
        formatWaterAmount={formatWaterAmount}
        formatSodiumAmount={formatSodiumAmount}
        fuelProducts={fuelProductEstimates}
        favoriteProducts={selectedProducts}
        onFavoriteToggle={toggleProduct}
        startSupplies={startSupplies}
        onStartSupplyDrop={handleStartSupplyDrop}
        onStartSupplyRemove={handleStartSupplyRemove}
        onSupplyDrop={handleSupplyDrop}
        onSupplyRemove={handleSupplyRemove}
        allowAutoFill={allowAutoFill}
        allowExport={allowExport}
        premiumCopy={premiumCopy}
        onUpgrade={handlePremiumFeature}
        upgradeStatus={upgradeStatus}
      />

    </div>
  );

  const settingsContent = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{racePlannerCopy.account.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PlanManager
          copy={racePlannerCopy.account}
          planName={planName}
          planStatus={planStatus}
          accountMessage={accountMessage}
          accountError={accountError}
          savedPlans={savedPlans}
          deletingPlanId={deletingPlanId}
          sessionEmail={session?.email}
          authStatus={authStatus}
          canSavePlan={canSavePlan}
          showPlanLimitUpsell={planLimitReached && !isPremium}
          premiumCopy={premiumCopy}
          onPlanNameChange={setPlanName}
          onSavePlan={handleSavePlan}
          onRefreshPlans={handleRefreshPlans}
          onLoadPlan={handleLoadPlan}
          onDeletePlan={handleDeletePlan}
        />
      </CardContent>
    </Card>
  );

  return (
    <>
      <Script id="software-application-ld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(structuredData)}
      </Script>

      <div className={`space-y-6 ${pagePaddingClass} print:hidden`}>
        {courseProfileSection}

        <RacePlannerLayout
          className="space-y-6"
          planContent={planPrimaryContent}
          settingsContent={settingsContent}
          mobileView={mobileView}
          onMobileViewChange={setMobileView}
          planLabel={racePlannerCopy.sections.summary.title}
          settingsLabel={racePlannerCopy.account.title}
          isSettingsCollapsed={isSettingsCollapsed}
          onSettingsToggle={() => setIsSettingsCollapsed((collapsed) => !collapsed)}
          collapseSettingsLabel={racePlannerCopy.sections.layout.collapsePanel}
          expandSettingsLabel={racePlannerCopy.sections.layout.expandPanel}
        />

        {enableMobileNav ? (
          <div className="fixed bottom-4 left-4 right-4 z-30 xl:hidden">
            <div className="rounded-full border border-border bg-card/95 px-2 py-2 shadow-lg shadow-emerald-500/20 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
              <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-foreground dark:text-slate-100">
                {mobileNavActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="flex items-center justify-center rounded-full px-3 py-2 text-center transition hover:bg-muted active:translate-y-[1px] dark:hover:bg-slate-800/80"
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <RaceCatalogModal
          open={isRaceCatalogOpen}
          isSubmittingId={catalogSubmissionId}
          accessToken={session?.accessToken}
          isAdmin={Boolean(isAdmin)}
          copy={{ ...racePlannerCopy.raceCatalog, units: racePlannerCopy.units }}
          onClose={() => setIsRaceCatalogOpen(false)}
          onUseRace={handleUseCatalogRace}
        />

        {!isDesktopApp && (
          <Button
            type="button"
            className={`fixed ${feedbackButtonOffsetClass} left-6 z-20 inline-flex h-12 w-12 rounded-full shadow-lg`}
            aria-label={racePlannerCopy.sections.summary.feedback.open}
            onClick={openFeedbackForm}
          >
            <MessageCircleIcon className="h-5 w-5" />
          </Button>
        )}

        {feedbackOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4">
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900/90">
              <Button
                type="button"
                variant="ghost"
                className="absolute right-2 top-2 h-8 w-8 p-0 text-lg text-foreground dark:text-slate-200"
                aria-label="Close feedback form"
                onClick={closeFeedbackForm}
              >
                ×
              </Button>
              <div className="mb-4 pr-8">
                <p className="text-lg font-semibold text-foreground dark:text-slate-50">
                  {racePlannerCopy.sections.summary.feedback.title}
                </p>
              </div>

              <form id="feedback-form" className="space-y-3" onSubmit={handleSubmitFeedback}>
                <div className="space-y-1">
                  <Label htmlFor="feedback-subject">{racePlannerCopy.sections.summary.feedback.subject}</Label>
                  <Input
                    id="feedback-subject"
                    value={feedbackSubject}
                    onChange={(event) => {
                      setFeedbackSubject(event.target.value);
                      setFeedbackStatus("idle");
                      setFeedbackError(null);
                    }}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="feedback-detail">{racePlannerCopy.sections.summary.feedback.detail}</Label>
                  <textarea
                    id="feedback-detail"
                    value={feedbackDetail}
                    onChange={(event) => {
                      setFeedbackDetail(event.target.value);
                      setFeedbackStatus("idle");
                      setFeedbackError(null);
                    }}
                    required
                    className="min-h-[120px] w-full rounded-md border border-border bg-background p-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-50 dark:placeholder:text-slate-500"
                  />
                </div>
                {feedbackError && <p className="text-sm text-red-400">{feedbackError}</p>}
                {feedbackStatus === "success" && !feedbackError && (
                  <p className="text-sm text-emerald-400">{racePlannerCopy.sections.summary.feedback.success}</p>
                )}
                <div className="flex justify-end">
                  <Button type="submit" className="w-full sm:w-auto" disabled={feedbackStatus === "submitting"}>
                    {racePlannerCopy.sections.summary.feedback.submit}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {upgradeDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur">
            <div className="relative w-full max-w-xl space-y-4 rounded-lg border border-emerald-300/30 bg-card p-6 shadow-2xl dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-foreground dark:text-slate-50">
                    {premiumCopy.premiumModal.title}
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-slate-300">
                    {premiumCopy.premiumModal.description}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setUpgradeDialogOpen(false);
                    setUpgradeError(null);
                  }}
                >
                  {premiumCopy.premiumModal.cancel}
                </Button>
              </div>

              <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-50">
                <p className="font-semibold">
                  {premiumCopy.premiumModal.priceLabel}: {premiumPriceDisplay}
                </p>
                {upgradeReason === "plans" ? (
                  <p className="text-xs text-emerald-100/80">{premiumCopy.planLimitReached}</p>
                ) : null}
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground dark:text-slate-100">
                  {premiumCopy.premiumModal.featuresTitle}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground dark:text-slate-300">
                  {premiumCopy.premiumModal.features.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span aria-hidden className="mt-[2px] text-emerald-300">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {upgradeError ? <p className="text-sm text-red-300">{upgradeError}</p> : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setUpgradeDialogOpen(false);
                    setUpgradeError(null);
                  }}
                >
                  {premiumCopy.premiumModal.cancel}
                </Button>
                <Button type="button" onClick={handleUpgrade} disabled={upgradeStatus === "opening"}>
                  {upgradeStatus === "opening" ? premiumCopy.opening : premiumCopy.premiumModal.subscribe}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {segments.length > 0 ? (
        <div className="hidden rounded-lg border border-slate-300 bg-white p-4 text-slate-900 shadow-sm print:block">
          <div className="mb-3">
            <p className="text-sm font-semibold">{racePlannerCopy.sections.timeline.printView.title}</p>
            <p className="text-xs text-slate-600">{racePlannerCopy.sections.timeline.printView.description}</p>
          </div>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full border-collapse text-xs leading-6">
              <thead className="bg-slate-50 text-slate-900">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">#</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.from}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.checkpoint}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.distance}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.segment}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.eta}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.segmentTime}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.fuel}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.water}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.sodium}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.pickup}
                  </th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, index) => {
                  const rowBorder = index === segments.length - 1 ? "" : "border-b border-slate-200";
                  return (
                    <tr key={`${segment.checkpoint}-print-${segment.distanceKm}`} className="align-top">
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>{index + 1}</td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        <div className="font-semibold">{segment.from}</div>
                        <div className="text-[10px] text-slate-600">
                          {formatDistanceWithUnit(segment.startDistanceKm)}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2`}>
                        <div className="font-semibold">{segment.checkpoint}</div>
                        <div className="text-[10px] text-slate-600">
                          {racePlannerCopy.sections.timeline.segmentLabel.replace(
                            "{distance}",
                            segment.segmentKm.toFixed(1)
                          )}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {formatDistanceWithUnit(segment.distanceKm)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {racePlannerCopy.sections.timeline.segmentDistanceBetween.replace(
                          "{distance}",
                          segment.segmentKm.toFixed(1)
                        )}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {formatMinutes(segment.etaMinutes, racePlannerCopy.units)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {formatMinutes(segment.segmentMinutes, racePlannerCopy.units)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        <div>{formatFuelAmount(segment.plannedFuelGrams)}</div>
                        <div className="text-[10px] text-slate-600">
                          {racePlannerCopy.sections.timeline.targetLabel}: {formatFuelAmount(segment.targetFuelGrams)}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        <div>{formatWaterAmount(segment.plannedWaterMl)}</div>
                        <div className="text-[10px] text-slate-600">
                          {racePlannerCopy.sections.timeline.targetLabel}: {formatWaterAmount(segment.targetWaterMl)}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        <div>{formatSodiumAmount(segment.plannedSodiumMg)}</div>
                        <div className="text-[10px] text-slate-600">
                          {racePlannerCopy.sections.timeline.targetLabel}: {formatSodiumAmount(segment.targetSodiumMg)}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {segment.isFinish ? "–" : segment.pickupGels ?? "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

    </>
  );

  }

function ElevationProfileChart({
  profile,
  aidStations,
  segments,
  totalDistanceKm,
  copy,
  baseMinutesPerKm,
}: {
  profile: ElevationPoint[];
  aidStations: AidStation[];
  segments: Segment[];
  totalDistanceKm: number;
  copy: RacePlannerTranslations;
  baseMinutesPerKm: number | null;
}) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(900);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [ravitoIndex, setRavitoIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setChartWidth(entry.contentRect.width);
    });

    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const hasProfile = profile.length > 0 && totalDistanceKm > 0;
  const safeProfile = useMemo(
    () => (profile.length > 0 ? profile : [{ distanceKm: 0, elevationM: 0 }]),
    [profile]
  );

  const width = Math.max(Math.round(chartWidth), 480);
  const paddingX = 20;
  const paddingY = 14;
  const elevationAreaHeight = 150;
  const height = paddingY + elevationAreaHeight + paddingY;
  const elevationBottom = paddingY + elevationAreaHeight;
  const maxElevation = Math.max(...safeProfile.map((p) => p.elevationM));
  const minElevation = Math.min(...safeProfile.map((p) => p.elevationM));
  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const scaledMax = Math.ceil(maxElevation / 10) * 10;
  const scaledMin = Math.floor(minElevation / 10) * 10;
  const trackDistanceKm = Math.max(totalDistanceKm, safeProfile.at(-1)?.distanceKm ?? 0, 1);

  const xScale = useCallback(
    (distanceKm: number) =>
      paddingX +
      Math.min(Math.max(distanceKm, 0), trackDistanceKm) * ((width - paddingX * 2) / trackDistanceKm),
    [paddingX, trackDistanceKm, width]
  );
  const yScale = useCallback(
    (elevation: number) =>
      elevationBottom - ((elevation - minElevation) / elevationRange) * elevationAreaHeight,
    [elevationAreaHeight, elevationBottom, elevationRange, minElevation]
  );

  const enrichedProfile = useMemo<EnrichedElevationPoint[]>(() => {
    const sorted = [...safeProfile].sort((a, b) => a.distanceKm - b.distanceKm);
    let cumulativeGainM = 0;
    let cumulativeLossM = 0;
    return sorted.map((point, index) => {
      const previous = sorted[index - 1];
      const delta = previous ? point.elevationM - previous.elevationM : 0;
      const segmentGainM = Math.max(delta, 0);
      const segmentLossM = Math.max(-delta, 0);
      cumulativeGainM += segmentGainM;
      cumulativeLossM += segmentLossM;
      const timeMinutes =
        baseMinutesPerKm && Number.isFinite(baseMinutesPerKm) && baseMinutesPerKm > 0
          ? point.distanceKm * baseMinutesPerKm
          : null;
      return {
        ...point,
        segmentGainM,
        segmentLossM,
        cumulativeGainM,
        cumulativeLossM,
        timeMinutes,
      };
    });
  }, [baseMinutesPerKm, safeProfile]);

  const getDistanceForClientX = useCallback(
    (clientX: number) => {
      if (!chartContainerRef.current) return null;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const clampedX = Math.min(Math.max(offsetX, 0), rect.width);
      const ratio = rect.width > 0 ? clampedX / rect.width : 0;
      return ratio * trackDistanceKm;
    },
    [trackDistanceKm]
  );

  const { hoveredIndex, isPinned, setPinned, updateFromClientX, clearHover } = useChartHover(
    enrichedProfile,
    getDistanceForClientX
  );

  const getElevationAtDistance = (distanceKm: number) => {
    if (safeProfile.length === 0) return minElevation;
    const clamped = Math.min(Math.max(distanceKm, 0), totalDistanceKm);
    const nextIndex = safeProfile.findIndex((point) => point.distanceKm >= clamped);
    if (nextIndex <= 0) return safeProfile[0].elevationM;
    const prevPoint = safeProfile[nextIndex - 1];
    const nextPoint = safeProfile[nextIndex] ?? prevPoint;
    const ratio =
      nextPoint.distanceKm === prevPoint.distanceKm
        ? 0
        : (clamped - prevPoint.distanceKm) / (nextPoint.distanceKm - prevPoint.distanceKm);
    return prevPoint.elevationM + (nextPoint.elevationM - prevPoint.elevationM) * ratio;
  };

  const path = safeProfile
    .map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.distanceKm)},${yScale(point.elevationM)}`)
    .join(" ");

  const areaPath = `${path} L${xScale(safeProfile.at(-1)?.distanceKm ?? 0)},${elevationBottom} L${xScale(
    safeProfile[0].distanceKm
  )},${elevationBottom} Z`;

  const slopeSegments = safeProfile.slice(1).map((point, index) => {
    const prev = safeProfile[index];
    const deltaDistanceKm = Math.max(point.distanceKm - prev.distanceKm, 0.0001);
    const grade = (point.elevationM - prev.elevationM) / (deltaDistanceKm * 1000);

    return {
      x1: xScale(prev.distanceKm),
      y1: yScale(prev.elevationM),
      x2: xScale(point.distanceKm),
      y2: yScale(point.elevationM),
      color: slopeToColor(grade),
    };
  });

  const activeRavito = ravitoIndex !== null ? aidStations[ravitoIndex] : null;
  const activePoint =
    ravitoIndex !== null
      ? null
      : hoveredIndex !== null
        ? enrichedProfile[hoveredIndex] ?? null
        : null;

  const activeDistanceKm = activeRavito?.distanceKm ?? activePoint?.distanceKm ?? null;
  const activeElevationM =
    activeDistanceKm !== null ? getElevationAtDistance(activeDistanceKm) : activePoint?.elevationM ?? null;

  const activeSegment =
    activeRavito &&
    segments.find(
      (segment) =>
        segment.checkpoint === activeRavito.name && Math.abs(segment.distanceKm - activeRavito.distanceKm) < 0.05
    );

  const paceLabel =
    baseMinutesPerKm && Number.isFinite(baseMinutesPerKm) && baseMinutesPerKm > 0
      ? (() => {
          const minutes = Math.floor(baseMinutesPerKm);
          const seconds = Math.round((baseMinutesPerKm - minutes) * 60);
          const safeSeconds = seconds === 60 ? 0 : seconds;
          const safeMinutes = seconds === 60 ? minutes + 1 : minutes;
          return `${safeMinutes}:${String(safeSeconds).padStart(2, "0")} /km`;
        })()
      : null;
  const speedLabel =
    baseMinutesPerKm && Number.isFinite(baseMinutesPerKm) && baseMinutesPerKm > 0
      ? `${(60 / baseMinutesPerKm).toFixed(1)} ${copy.sections.courseProfile.speedUnit}`
      : null;

  useLayoutEffect(() => {
    if (!chartContainerRef.current || !svgRef.current || !tooltipRef.current) return;
    if (activeDistanceKm === null || activeElevationM === null) {
      setTooltipPosition(null);
      return;
    }
    const containerRect = chartContainerRef.current.getBoundingClientRect();
    const svgRect = svgRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const anchorX = (xScale(activeDistanceKm) / width) * svgRect.width;
    const anchorY = (yScale(activeElevationM) / height) * svgRect.height;
    let left = anchorX + 12;
    let top = anchorY - tooltipRect.height - 12;
    if (left + tooltipRect.width > containerRect.width) {
      left = anchorX - tooltipRect.width - 12;
    }
    if (left < 8) left = 8;
    if (top < 8) {
      top = anchorY + 12;
    }
    if (top + tooltipRect.height > containerRect.height - 8) {
      top = containerRect.height - tooltipRect.height - 8;
    }
    setTooltipPosition({ left, top });
  }, [activeDistanceKm, activeElevationM, height, width, xScale, yScale]);

  useEffect(() => {
    if (!isPinned) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (chartContainerRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setRavitoIndex(null);
      clearHover();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [clearHover, isPinned, setPinned]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPinned(false);
      setRavitoIndex(null);
      clearHover();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearHover, setPinned]);

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isPinned) return;
    updateFromClientX(event.clientX);
  };

  const handlePointerLeave = () => {
    if (isPinned) return;
    clearHover();
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== "touch") return;
    setPinned(true);
    updateFromClientX(event.clientX);
  };

  const cursorX =
    activeDistanceKm !== null && activeDistanceKm !== undefined ? xScale(activeDistanceKm) : null;
  const cursorY =
    activeElevationM !== null && activeElevationM !== undefined ? yScale(activeElevationM) : null;

  if (!hasProfile) {
    return <p className="text-sm text-muted-foreground dark:text-slate-400">{copy.sections.courseProfile.empty}</p>;
  }

  return (
    <div ref={chartContainerRef} className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-[190px] w-full"
        role="img"
        aria-label={copy.sections.courseProfile.ariaLabel}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <defs>
          <linearGradient id="elevationGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {[scaledMin, scaledMax].map((tick) => (
          <g key={tick}>
            <line
              x1={paddingX}
              x2={width - paddingX}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#1f2937"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={paddingX - 8} y={yScale(tick) + 4} className="fill-slate-400 text-[10px]" textAnchor="end">
              {tick.toFixed(0)} {copy.units.meter}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#elevationGradient)" stroke="none" />
        {slopeSegments.map((segment, index) => (
          <line
            key={`${segment.x1}-${segment.x2}-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}

        {cursorX !== null && cursorY !== null && (
          <>
            <line x1={cursorX} x2={cursorX} y1={paddingY} y2={elevationBottom} stroke="#38bdf8" strokeWidth={1} />
            <circle cx={cursorX} cy={cursorY} r={4} fill="#38bdf8" stroke="#0f172a" strokeWidth={2} />
          </>
        )}

        {aidStations.map((station, index) => {
          const x = xScale(station.distanceKm);
          const elevationAtPoint = getElevationAtDistance(station.distanceKm);
          const y = yScale(elevationAtPoint);
          return (
            <g
              key={`${station.name}-${station.distanceKm}`}
              role="button"
              tabIndex={0}
              aria-label={`${copy.sections.courseProfile.tooltip.ravitoTitle}: ${station.name}`}
              onFocus={() => setRavitoIndex(index)}
              onBlur={() => setRavitoIndex(null)}
              onPointerEnter={() => setRavitoIndex(index)}
              onPointerLeave={() => setRavitoIndex(null)}
            >
              <line x1={x} x2={x} y1={y} y2={elevationBottom} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="2 3" />
              <circle cx={x} cy={y} r={4} fill="#fbbf24" />
              <text x={x} y={elevationBottom + 12} className="fill-slate-300 text-[10px]" textAnchor="middle">
                {station.name}
              </text>
            </g>
          );
        })}

        <text
          x={width / 2}
          y={height - 4}
          className="fill-slate-400 text-[10px]"
          textAnchor="middle"
        >
          {copy.sections.courseProfile.axisLabel}
        </text>
      </svg>

      {(activePoint || activeRavito) && (
        <div
          ref={tooltipRef}
          className="absolute z-10 max-w-[220px] rounded-md border border-border bg-slate-950/90 p-3 text-xs text-slate-100 shadow-lg backdrop-blur"
          style={
            tooltipPosition
              ? { left: tooltipPosition.left, top: tooltipPosition.top }
              : { left: 12, top: 12 }
          }
        >
          {activeRavito ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-50">
                {copy.sections.courseProfile.tooltip.ravitoTitle}: {activeRavito.name}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-200">
                <div>
                  {copy.sections.courseProfile.tooltip.distance}: {activeRavito.distanceKm.toFixed(1)}{" "}
                  {copy.units.kilometer}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.waterRefill}:{" "}
                  {activeRavito.waterRefill !== false
                    ? copy.sections.courseProfile.tooltip.waterRefillYes
                    : copy.sections.courseProfile.tooltip.waterRefillNo}
                </div>
                {activeSegment ? (
                  <>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedGels}: {activeSegment.gelsPlanned.toFixed(1)}
                    </div>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedCarbs}: {activeSegment.plannedFuelGrams.toFixed(0)}{" "}
                      {copy.units.grams}
                    </div>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedCalories}:{" "}
                      {(activeSegment.plannedFuelGrams * 4).toFixed(0)} kcal
                    </div>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedSodium}: {activeSegment.plannedSodiumMg.toFixed(0)}{" "}
                      {copy.units.milligrams}
                    </div>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedWater}: {activeSegment.plannedWaterMl.toFixed(0)}{" "}
                      {copy.units.milliliters}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : activePoint ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-200">
                <div>
                  {copy.sections.courseProfile.tooltip.distance}: {activePoint.distanceKm.toFixed(1)}{" "}
                  {copy.units.kilometer}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.elevation}: {activePoint.elevationM.toFixed(0)} {copy.units.meter}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.segmentGain}: {activePoint.segmentGainM.toFixed(0)}{" "}
                  {copy.units.meter}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.segmentLoss}: {activePoint.segmentLossM.toFixed(0)}{" "}
                  {copy.units.meter}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.cumulativeGain}: {activePoint.cumulativeGainM.toFixed(0)}{" "}
                  {copy.units.meter}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.cumulativeLoss}: {activePoint.cumulativeLossM.toFixed(0)}{" "}
                  {copy.units.meter}
                </div>
                {activePoint.timeMinutes !== null ? (
                  <div>
                    {copy.sections.courseProfile.tooltip.time}: {formatClockTime(activePoint.timeMinutes)}
                  </div>
                ) : null}
              </div>
              {(paceLabel || speedLabel) && (
                <div className="text-[11px] text-slate-300">
                  {paceLabel ? `${copy.sections.courseProfile.tooltip.pace}: ${paceLabel}` : null}
                  {paceLabel && speedLabel ? " • " : null}
                  {speedLabel ? `${copy.sections.courseProfile.tooltip.speed}: ${speedLabel}` : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
