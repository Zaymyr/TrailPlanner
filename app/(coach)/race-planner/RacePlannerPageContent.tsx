"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../i18n-provider";
import { useProductSelection } from "../../hooks/useProductSelection";
import { useCoachIntakeTargets } from "../../hooks/useCoachIntakeTargets";
import { useEffectiveIntakeTargets } from "../../hooks/useEffectiveIntakeTargets";
import { useCoachCoachees } from "../../hooks/useCoachCoachees";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale, RacePlannerTranslations } from "../../../locales/types";
import type { ElevationPoint, FormValues, StationSupply } from "./types";
import { RACE_PLANNER_URL } from "../../seo";
import { defaultFuelType } from "../../../lib/fuel-types";
import type { FuelProduct } from "../../../lib/product-types";
import { fetchUserProfile } from "../../../lib/profile-client";
import { mapProductToSelection } from "../../../lib/product-preferences";
import { RacePlannerLayout } from "../../../components/race-planner/RacePlannerLayout";
import { RaceCatalogModal } from "./components/RaceCatalogModal";
import { PlanPrimaryContent } from "./components/PlanPrimaryContent";
import { PlannerRightPanel } from "./components/PlannerRightPanel";
import { GuestSaveBanner } from "../../../components/GuestSaveBanner";
import type { UserEntitlements } from "../../../lib/entitlements";
import { defaultEntitlements, fetchEntitlements } from "../../../lib/entitlements-client";
import { clearRacePlannerStorage, readRacePlannerStorage, writeRacePlannerStorage } from "../../../lib/race-planner-storage";
import { formatMinutes } from "./utils/format";
import { minutesPerKm, paceToSpeedKph, speedToPace } from "./utils/pacing";
import { buildPlannerGpx, parseGpx } from "./utils/gpx";
import {
  dedupeAidStations,
  sanitizeAidStations,
  sanitizeElevationProfile,
  sanitizePlannerValues,
  sanitizeSegmentPlan,
} from "./utils/plan-sanitizers";
import { buildSegments } from "./utils/segments";
import { buildFuelProductEstimates, buildRaceTotals, type FuelProductEstimate } from "./utils/nutrition";
import { CourseProfileSection } from "./components/CourseProfileSection";
import { usePlannerState } from "./hooks/usePlannerState";
import { useRacePlan } from "./hooks/useRacePlan";
import { PrintablePlanV2 } from "./components/print/PrintablePlanV2";

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
  const searchParams = useSearchParams();
  const printLayout = searchParams?.get("printLayout");
  const usePrintLayoutV2 = printLayout === "v2";
  const [selectedCoacheeId, setSelectedCoacheeId] = useState<string | null>(null);
  const queryPlanIdRef = useRef<string | null>(null);
  const initializedQueryRef = useRef(false);

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
  const baseIntakeTargets = useMemo(
    () => ({
      carbsPerHour: watchedValues.targetIntakePerHour ?? defaultValues.targetIntakePerHour,
      waterMlPerHour: watchedValues.waterIntakePerHour ?? defaultValues.waterIntakePerHour,
      sodiumMgPerHour: watchedValues.sodiumIntakePerHour ?? defaultValues.sodiumIntakePerHour,
    }),
    [
      defaultValues.sodiumIntakePerHour,
      defaultValues.targetIntakePerHour,
      defaultValues.waterIntakePerHour,
      watchedValues.sodiumIntakePerHour,
      watchedValues.targetIntakePerHour,
      watchedValues.waterIntakePerHour,
    ]
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const { selectedProducts, replaceSelection, toggleProduct } = useProductSelection();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<UserEntitlements>(defaultEntitlements);
  const [stripePrice, setStripePrice] = useState<z.infer<typeof stripePriceResponseSchema>["price"] | null>(null);
  const {
    state: {
      importError,
      feedbackOpen,
      feedbackSubject,
      feedbackDetail,
      feedbackStatus,
      feedbackError,
      isDesktopApp,
      mobileView,
      isSettingsCollapsed,
      isRaceCatalogOpen,
      catalogSubmissionId,
      isCourseCollapsed,
      upgradeStatus,
      upgradeError,
      upgradeDialogOpen,
      upgradeReason,
    },
    actions: {
      setImportError,
      setFeedbackOpen,
      setFeedbackSubject,
      setFeedbackDetail,
      setFeedbackStatus,
      setFeedbackError,
      setIsDesktopApp,
      setMobileView,
      setIsSettingsCollapsed,
      setIsRaceCatalogOpen,
      setCatalogSubmissionId,
      setIsCourseCollapsed,
      setUpgradeStatus,
      setUpgradeError,
      setUpgradeDialogOpen,
      setUpgradeReason,
    },
  } = usePlannerState();

  useEffect(() => {
    if (initializedQueryRef.current) return;

    const coacheeIdParam = searchParams?.get("coacheeId");
    const planIdParam = searchParams?.get("planId");

    if (coacheeIdParam) {
      setSelectedCoacheeId(coacheeIdParam);
    }

    if (planIdParam) {
      queryPlanIdRef.current = planIdParam;
    }

    initializedQueryRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
    const isElectron = userAgent.includes("electron");
    const isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;

    setIsDesktopApp(isElectron || Boolean(isStandalone));
  }, [setIsDesktopApp]);

  const parsedValues = useMemo(() => formSchema.safeParse(watchedValues), [formSchema, watchedValues]);

  const {
    session,
    planName,
    setPlanName,
    savedPlans,
    activePlanId,
    accountMessage,
    accountError,
    authStatus,
    planStatus,
    deletingPlanId,
    fuelProducts,
    planLimitReached,
    canSavePlan,
    requestPremiumUpgrade,
    handleSavePlan,
    handleLoadPlan,
    handleDeletePlan,
    handleRefreshPlans,
    handleUseCatalogRace,
  } = useRacePlan({
    racePlannerCopy,
    premiumCopy,
    defaultValues,
    form,
    parsedValues,
    elevationProfile,
    setElevationProfile,
    setIsRaceCatalogOpen,
    setCatalogSubmissionId,
    entitlements,
    setUpgradeDialogOpen,
    setUpgradeError,
    setUpgradeReason,
    coachCoacheeId: selectedCoacheeId,
    onSessionCleared: () => {
      setEntitlements(defaultEntitlements);
      setUpgradeError(null);
    },
  });
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");
  const isCoach = Boolean(isAdmin || session?.role === "coach" || session?.roles?.includes("coach"));
  const isAuthed = Boolean(session?.accessToken);
  const { coachees, isLoading: isCoacheesLoading, error: coacheesError } = useCoachCoachees({
    accessToken: session?.accessToken,
    enabled: isCoach,
  });
  const { targets: coachTargets } = useCoachIntakeTargets(session?.accessToken);
  const { effectiveTargets, isCoachManaged } = useEffectiveIntakeTargets(baseIntakeTargets, coachTargets);
  const canEditCoachComments = Boolean(
    isAdmin || session?.role === "coach" || session?.roles?.includes("coach")
  );
  const planOwnerOptions = useMemo(() => {
    if (!isCoach) {
      return [];
    }

    const ownerOptions = [
      { value: "self", label: racePlannerCopy.account.coach.myPlans },
      ...coachees.map((coachee) => ({
        value: coachee.id,
        label:
          coachee.fullName ??
          coachee.invitedEmail ??
          t.coachDashboard.coachees.unknownName,
      })),
    ];

    return ownerOptions;
  }, [coachees, isCoach, racePlannerCopy.account.coach.myPlans, t.coachDashboard.coachees.unknownName]);
  const selectedPlanOwnerValue = selectedCoacheeId ?? "self";
  const handlePlanOwnerChange = useCallback((value: string) => {
    setSelectedCoacheeId(value === "self" ? null : value);
  }, []);
  const coachCommentsCoacheeId = isCoach && selectedCoacheeId ? selectedCoacheeId : session?.id;

  useEffect(() => {
    if (!queryPlanIdRef.current) return;

    const matchedPlan = savedPlans.find((plan) => plan.id === queryPlanIdRef.current);

    if (matchedPlan) {
      handleLoadPlan(matchedPlan);
      queryPlanIdRef.current = null;
    }
  }, [handleLoadPlan, savedPlans]);

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
    if (!isCoachManaged) {
      return;
    }

    const currentValues = form.getValues();

    if (currentValues.targetIntakePerHour !== effectiveTargets.carbsPerHour) {
      form.setValue("targetIntakePerHour", effectiveTargets.carbsPerHour);
    }
    if (currentValues.waterIntakePerHour !== effectiveTargets.waterMlPerHour) {
      form.setValue("waterIntakePerHour", effectiveTargets.waterMlPerHour);
    }
    if (currentValues.sodiumIntakePerHour !== effectiveTargets.sodiumMgPerHour) {
      form.setValue("sodiumIntakePerHour", effectiveTargets.sodiumMgPerHour);
    }
  }, [effectiveTargets, form, isCoachManaged]);

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
  const printableRaceName = planName?.trim()
    ? planName.trim()
    : racePlannerCopy.sections.timeline.printViewV2.defaultRaceName;
  const exportDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    [locale]
  );

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
          fuelType: defaultFuelType,
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
    setUpgradeError,
    setUpgradeDialogOpen,
    setUpgradeStatus,
  ]);

  const handlePremiumFeature = useCallback(
    (reason: "autoFill" | "print") => {
      const message = reason === "autoFill" ? premiumCopy.autoFillLocked : premiumCopy.printLocked;
      requestPremiumUpgrade(message, reason);
    },
    [premiumCopy.autoFillLocked, premiumCopy.printLocked, requestPremiumUpgrade]
  );


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

  const totalDistanceKm =
    (parsedValues.success ? parsedValues.data.raceDistanceKm : watchedValues?.raceDistanceKm) ??
    defaultValues.raceDistanceKm;
  const courseProfileAidStations = parsedValues.success ? parsedValues.data.aidStations : sanitizedWatchedAidStations;
  const planPrimaryContent = (
    <PlanPrimaryContent
      profileError={profileError}
      showProfileError={Boolean(session?.accessToken)}
      copy={racePlannerCopy}
      sectionIds={sectionIds}
      pacing={{
        durationMinutes: pacingOverviewDuration,
        paceMinutes: paceMinutesValue,
        paceSeconds: paceSecondsValue,
        speedKph: speedKphValue,
      }}
      coachManaged={isCoachManaged}
      register={register}
      onPaceChange={handlePaceUpdate}
      onSpeedChange={handleSpeedUpdate}
      formatDuration={(totalMinutes) => formatMinutes(totalMinutes, racePlannerCopy.units)}
      segments={segments}
      raceTotals={raceTotals}
      onPrint={handlePrint}
      onAutomaticFill={handleAutomaticFill}
      onAddAidStation={handleAddAidStation}
      onRemoveAidStation={handleRemoveAidStation}
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
      coachCommentsCopy={t.coachComments}
      coachCommentsContext={{
        accessToken: session?.accessToken,
        planId: activePlanId ?? undefined,
        coacheeId: coachCommentsCoacheeId,
        canEdit: canEditCoachComments,
      }}
    />
  );

  const settingsContent = (
    <PlannerRightPanel
      planManagerProps={{
        copy: racePlannerCopy.account,
        planName,
        planStatus,
        accountMessage,
        accountError,
        savedPlans,
        deletingPlanId,
        sessionEmail: session?.email,
        authStatus,
        canSavePlan,
        showPlanLimitUpsell: planLimitReached && !isPremium,
        premiumCopy,
        planOwnerSelector: isCoach
          ? {
              label: racePlannerCopy.account.coach.planOwnerLabel,
              helper: racePlannerCopy.account.coach.planOwnerHelper,
              options: planOwnerOptions,
              value: selectedPlanOwnerValue,
              isLoading: isCoacheesLoading,
              errorMessage: coacheesError ? racePlannerCopy.account.coach.loadError : null,
              onChange: handlePlanOwnerChange,
            }
          : undefined,
        onPlanNameChange: setPlanName,
        onSavePlan: handleSavePlan,
        onRefreshPlans: handleRefreshPlans,
        onLoadPlan: handleLoadPlan,
        onDeletePlan: handleDeletePlan,
      }}
    />
  );

  return (
    <>
      <Script id="software-application-ld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(structuredData)}
      </Script>

      <div className={`space-y-6 ${pagePaddingClass} print:hidden`}>
        <GuestSaveBanner isAuthed={isAuthed} />
        <CourseProfileSection
          sectionId={sectionIds.courseProfile}
          copy={racePlannerCopy}
          isCollapsed={isCourseCollapsed}
          onToggleCollapsed={() => setIsCourseCollapsed((prev) => !prev)}
          fileInputRef={fileInputRef}
          onImportGpx={handleImportGpx}
          onOpenRaceCatalog={() => setIsRaceCatalogOpen(true)}
          allowExport={allowExport}
          onExportGpx={handleExportGpx}
          onRequestExportUpgrade={() => requestPremiumUpgrade(premiumCopy.exportLocked)}
          importError={importError}
          register={register}
          elevationProfile={elevationProfile}
          aidStations={courseProfileAidStations}
          segments={segments}
          totalDistanceKm={totalDistanceKm}
          baseMinutesPerKm={baseMinutesPerKm}
        />

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
                  <p className="text-sm text-slate-600 dark:text-slate-300">
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

              <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-50">
                <p className="font-semibold">
                  {premiumCopy.premiumModal.priceLabel}: {premiumPriceDisplay}
                </p>
                {upgradeReason === "plans" ? (
                  <p className="text-xs text-emerald-600/90 dark:text-emerald-100/80">
                    {premiumCopy.planLimitReached}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {premiumCopy.premiumModal.featuresTitle}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {premiumCopy.premiumModal.features.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span aria-hidden className="mt-[2px] text-emerald-600 dark:text-emerald-300">
                        •
                      </span>
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
        usePrintLayoutV2 ? (
          <PrintablePlanV2
            segments={segments}
            raceName={printableRaceName}
            exportDate={exportDate}
            strategy={baseIntakeTargets}
            products={mergedFuelProducts}
            copy={racePlannerCopy}
            locale={locale}
            formatDistanceWithUnit={formatDistanceWithUnit}
          />
        ) : (
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
        )
      ) : null}

    </>
  );

  }
