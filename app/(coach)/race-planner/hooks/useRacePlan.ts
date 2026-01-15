"use client";

import { z } from "zod";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { UseFormReturn } from "react-hook-form";

import { defaultFuelProducts } from "../../../../lib/default-products";
import { readLocalProducts } from "../../../../lib/local-products";
import { fuelProductSchema, type FuelProduct } from "../../../../lib/product-types";
import { clearRacePlannerStorage } from "../../../../lib/race-planner-storage";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SESSION_EMAIL_KEY } from "../../../../lib/auth-storage";
import type { RacePlannerTranslations } from "../../../../locales/types";
import type { UserEntitlements } from "../../../../lib/entitlements";
import type { ElevationPoint, FormValues, SavedPlan } from "../types";
import {
  dedupeAidStations,
  sanitizeAidStations,
  sanitizeElevationProfile,
  sanitizePlannerValues,
  sanitizeSegmentPlan,
} from "../utils/plan-sanitizers";

export type RacePlannerSession = {
  accessToken: string;
  refreshToken?: string;
  email?: string;
  role?: string;
  roles?: string[];
};

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

const mapSavedPlan = (row: Record<string, unknown>): SavedPlan | null => {
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
};

type UseRacePlanParams = {
  racePlannerCopy: RacePlannerTranslations;
  premiumCopy: RacePlannerTranslations["account"]["premium"];
  defaultValues: FormValues;
  form: UseFormReturn<FormValues>;
  parsedValues: z.SafeParseReturnType<FormValues, FormValues>;
  elevationProfile: ElevationPoint[];
  setElevationProfile: Dispatch<SetStateAction<ElevationPoint[]>>;
  setIsRaceCatalogOpen: (open: boolean) => void;
  setCatalogSubmissionId: (id: string | null) => void;
  entitlements: UserEntitlements;
  setUpgradeDialogOpen: (open: boolean) => void;
  setUpgradeError: (message: string | null) => void;
  setUpgradeReason: (reason: "autoFill" | "print" | "plans") => void;
  onSessionCleared?: () => void;
};

export const useRacePlan = ({
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
  onSessionCleared,
}: UseRacePlanParams) => {
  const [planName, setPlanName] = useState("");
  const [session, setSession] = useState<RacePlannerSession | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<"idle" | "signingIn" | "signingUp" | "checking">("idle");
  const [planStatus, setPlanStatus] = useState<"idle" | "saving">("idle");
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [fuelProducts, setFuelProducts] = useState<FuelProduct[]>(defaultFuelProducts);
  const [fuelLoadStatus, setFuelLoadStatus] = useState<"loading" | "ready">("loading");

  const planLimitReached = useMemo(
    () =>
      !entitlements.isPremium &&
      Number.isFinite(entitlements.planLimit) &&
      savedPlans.length >= entitlements.planLimit,
    [entitlements.isPremium, entitlements.planLimit, savedPlans.length]
  );

  const canSavePlan = useMemo(
    () =>
      entitlements.isPremium ||
      !planLimitReached ||
      Boolean(activePlanId) ||
      Boolean(savedPlans.find((plan) => plan.id === activePlanId)),
    [activePlanId, entitlements.isPremium, planLimitReached, savedPlans]
  );

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
    onSessionCleared?.();
  }, [onSessionCleared]);

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
    const abortController = new AbortController();
    setFuelLoadStatus("loading");

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
      } finally {
        if (!abortController.signal.aborted) {
          setFuelLoadStatus("ready");
        }
      }
    };

    void loadProducts();

    return () => {
      abortController.abort();
    };
  }, [racePlannerCopy.sections.gels.loadError, session?.accessToken]);

  const handleLoadPlan = useCallback(
    (plan: SavedPlan, message: string = racePlannerCopy.account.messages.loadedPlan) => {
      const sanitizedAidStations = sanitizeAidStations(plan.plannerValues.aidStations) ?? [];
      const aidStations =
        sanitizedAidStations.length > 0 ? dedupeAidStations(sanitizedAidStations) : defaultValues.aidStations;
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
    },
    [defaultValues, form, racePlannerCopy.account.messages.loadedPlan, setElevationProfile]
  );

  const handleSavePlan = useCallback(async () => {
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
  }, [
    elevationProfile,
    parsedValues,
    planLimitReached,
    planName,
    premiumCopy.planLimitReached,
    racePlannerCopy.account.errors.missingSession,
    racePlannerCopy.account.errors.saveFailed,
    racePlannerCopy.account.messages.savedPlan,
    racePlannerCopy.account.plans.defaultName,
    requestPremiumUpgrade,
    savedPlans,
    session?.accessToken,
  ]);

  const handleDeletePlan = useCallback(async (planId: string) => {
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
  }, [racePlannerCopy.account.errors.deleteFailed, racePlannerCopy.account.errors.missingSession, racePlannerCopy.account.messages.deletedPlan, session?.accessToken]);

  const handleRefreshPlans = useCallback(() => {
    if (session?.accessToken) {
      refreshSavedPlans(session.accessToken);
    }
  }, [refreshSavedPlans, session?.accessToken]);

  const handleUseCatalogRace = useCallback(async (raceId: string) => {
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
  }, [
    handleLoadPlan,
    premiumCopy.planLimitReached,
    racePlannerCopy.raceCatalog.errors.authRequired,
    racePlannerCopy.raceCatalog.errors.createFailed,
    racePlannerCopy.raceCatalog.messages.created,
    requestPremiumUpgrade,
    session?.accessToken,
    setCatalogSubmissionId,
    setIsRaceCatalogOpen,
  ]);

  return {
    session,
    planName,
    setPlanName,
    savedPlans,
    accountMessage,
    accountError,
    authStatus,
    planStatus,
    deletingPlanId,
    fuelProducts,
    fuelLoadStatus,
    planLimitReached,
    canSavePlan,
    requestPremiumUpgrade,
    handleSavePlan,
    handleLoadPlan,
    handleDeletePlan,
    handleRefreshPlans,
    handleUseCatalogRace,
  };
};
