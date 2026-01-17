"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { TrialExpiredBanner } from "../components/trial-expired/TrialExpiredBanner";
import { TrialExpiredModal } from "../components/trial-expired/TrialExpiredModal";
import type { UserEntitlements } from "../lib/entitlements";
import { defaultEntitlements, fetchEntitlements } from "../lib/entitlements-client";
import { markTrialExpiredSeen } from "../lib/trial-client";
import { useVerifiedSession } from "./hooks/useVerifiedSession";

const COPY = {
  banner: "Ton essai Premium est terminé. Abonne-toi pour réactiver les fonctions Premium.",
  modalTitle: "Essai Premium terminé",
  modalBody:
    "Ton essai Premium de 14 jours est terminé. Abonne-toi pour réactiver : export GPX, remplissage automatique des ravitos avec tes produits favoris, et impression de ton plan de course.",
  cta: "S’abonner",
  later: "Plus tard",
  checkoutError: "Impossible d’ouvrir la page d’abonnement. Réessaie plus tard.",
  missingSession: "Connecte-toi pour accéder à l’abonnement Premium.",
};

export const TrialExpiredNotice = () => {
  const { session } = useVerifiedSession();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "opening">("idle");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [isMarkingSeen, setIsMarkingSeen] = useState(false);

  const entitlementsQuery = useQuery({
    queryKey: ["entitlements", session?.accessToken],
    queryFn: () => fetchEntitlements(session?.accessToken ?? ""),
    enabled: Boolean(session?.accessToken),
    staleTime: 60_000,
  });

  const entitlements = entitlementsQuery.data ?? defaultEntitlements;

  const isTrialExpired = useMemo(() => {
    if (!entitlements.trialEndsAt) return false;
    const trialEnd = new Date(entitlements.trialEndsAt);
    return Number.isFinite(trialEnd.getTime()) && trialEnd.getTime() <= Date.now();
  }, [entitlements.trialEndsAt]);

  const shouldShowBanner = Boolean(session?.accessToken) && !entitlements.isPremium && isTrialExpired;
  const shouldShowModal = shouldShowBanner && !entitlements.trialExpiredSeenAt;

  useEffect(() => {
    if (dismissed) {
      setIsModalOpen(false);
      return;
    }

    if (shouldShowModal) {
      setIsModalOpen(true);
    } else if (isModalOpen) {
      setIsModalOpen(false);
    }
  }, [dismissed, isModalOpen, shouldShowModal]);

  const handleMarkSeen = useCallback(async () => {
    if (!session?.accessToken) {
      return null;
    }

    try {
      const result = await markTrialExpiredSeen(session.accessToken);
      const seenAt = result.trialExpiredSeenAt ?? new Date().toISOString();

      queryClient.setQueryData<UserEntitlements>(["entitlements", session.accessToken], (previous) =>
        previous ? { ...previous, trialExpiredSeenAt: seenAt } : previous
      );

      return seenAt;
    } catch (error) {
      console.error("Unable to mark trial expired as seen", error);
      return null;
    }
  }, [queryClient, session?.accessToken]);

  const handleDismiss = useCallback(async () => {
    setUpgradeError(null);
    setIsMarkingSeen(true);

    try {
      await handleMarkSeen();
    } finally {
      setIsMarkingSeen(false);
      setDismissed(true);
      setIsModalOpen(false);
    }
  }, [handleMarkSeen]);

  const handleUpgrade = useCallback(async () => {
    setUpgradeError(null);
    setUpgradeStatus("opening");

    try {
      if (!session?.accessToken) {
        setUpgradeError(COPY.missingSession);
        return;
      }

      await handleMarkSeen();

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.message ?? COPY.checkoutError);
      }

      const popup = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!popup) {
        throw new Error(COPY.checkoutError);
      }

      popup.opener = null;
      popup.focus();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Unable to open checkout", error);
      setUpgradeError(error instanceof Error ? error.message : COPY.checkoutError);
    } finally {
      setUpgradeStatus("idle");
    }
  }, [handleMarkSeen, session?.accessToken]);

  if (!shouldShowBanner) {
    return null;
  }

  return (
    <>
      <TrialExpiredBanner
        message={COPY.banner}
        ctaLabel={COPY.cta}
        onUpgrade={handleUpgrade}
        isLoading={upgradeStatus === "opening"}
        error={upgradeError && !isModalOpen ? upgradeError : null}
      />
      <TrialExpiredModal
        open={isModalOpen}
        title={COPY.modalTitle}
        description={COPY.modalBody}
        primaryLabel={COPY.cta}
        secondaryLabel={COPY.later}
        onClose={handleDismiss}
        onUpgrade={handleUpgrade}
        isSubmitting={upgradeStatus === "opening" || isMarkingSeen}
        error={upgradeError && isModalOpen ? upgradeError : null}
      />
      {/* Manual test steps:
          1) User in trial: no banner or modal.
          2) Trial expired + not premium: banner shows, modal opens once.
          3) Dismiss modal: banner stays, modal never reopens across devices.
          4) Subscribe: banner and modal disappear. */}
    </>
  );
};
