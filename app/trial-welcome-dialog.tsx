"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../components/ui/button";
import { fetchTrialStatus, markTrialWelcomeSeen } from "../lib/trial-client";
import { useVerifiedSession } from "./hooks/useVerifiedSession";

const TRIAL_COPY = {
  title: "Bienvenue !",
  body: "Merci d'avoir créé votre compte. Vous avez accès pendant 14 jours aux fonctions Premium : export GPX, remplissage automatique des ravitos avec vos produits favoris, impression de votre plan de course. Profitez-en !",
  cta: "OK",
};

export function TrialWelcomeDialog() {
  const { session } = useVerifiedSession();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trialQuery = useQuery({
    queryKey: ["trial-status", session?.accessToken],
    queryFn: () => fetchTrialStatus(session?.accessToken ?? ""),
    enabled: Boolean(session?.accessToken),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (dismissed || !session?.accessToken) {
      return;
    }

    const shouldShow = Boolean(trialQuery.data?.trialStartedAt && !trialQuery.data?.trialWelcomeSeenAt);

    if (shouldShow) {
      setIsOpen(true);
    } else if (isOpen) {
      setIsOpen(false);
    }
  }, [dismissed, isOpen, session?.accessToken, trialQuery.data]);

  const handleClose = async () => {
    if (!session?.accessToken) {
      setIsOpen(false);
      setDismissed(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await markTrialWelcomeSeen(session.accessToken);
      queryClient.setQueryData(["trial-status", session.accessToken], updated);
    } catch (error) {
      console.error("Unable to mark trial welcome as seen", error);
    } finally {
      setIsSubmitting(false);
      setIsOpen(false);
      setDismissed(true);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-10 backdrop-blur">
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-emerald-300/30 bg-card p-6 text-foreground shadow-2xl dark:bg-slate-950">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">{TRIAL_COPY.title}</p>
          <p className="text-sm text-muted-foreground">{TRIAL_COPY.body}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" onClick={handleClose} disabled={isSubmitting}>
            {TRIAL_COPY.cta}
          </Button>
        </div>
      </div>
    </div>
  );
}
