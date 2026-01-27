"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../components/ui/button";
import { fetchCoachRelationshipStatus } from "../lib/coach-relationship-client";
import { fetchTrialStatus, markTrialWelcomeSeen } from "../lib/trial-client";
import { useVerifiedSession } from "./hooks/useVerifiedSession";

const COACH_INVITE_SEEN_KEY = "trailplanner.coachInviteWelcomeSeen";

const TRIAL_COPY = {
  title: "Bienvenue ! / Welcome!",
  introFr: "Merci d'avoir créé votre compte. Vous avez accès pendant 14 jours aux fonctions Premium :",
  introEn: "Thanks for creating your account. You get 14 days of Premium features:",
  featuresFr: [
    "Export GPX",
    "Remplissage automatique des ravitos avec vos produits favoris",
    "Impression de votre plan de course",
  ],
  featuresEn: ["GPX export", "Automatic aid-station fill with your favorite products", "Print your race plan"],
  cta: "OK",
};

const COACH_COPY = {
  title: "Invitation acceptée ! / Invitation accepted!",
  introFr: "Un coach vous a invité(e). Vous bénéficiez de l'accès Premium grâce à votre coach.",
  introEn: "A coach invited you. You now have Premium access thanks to your coach.",
  detailsLabelFr: "Coach",
  detailsLabelEn: "Coach",
  cta: "OK",
};

type DialogType = "trial" | "coach";

export function TrialWelcomeDialog() {
  const { session } = useVerifiedSession();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogType, setDialogType] = useState<DialogType | null>(null);
  const [coachInviteSeen, setCoachInviteSeen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCoachInviteSeen(window.localStorage.getItem(COACH_INVITE_SEEN_KEY) === "true");
  }, []);

  const trialQuery = useQuery({
    queryKey: ["trial-status", session?.accessToken],
    queryFn: () => fetchTrialStatus(session?.accessToken ?? ""),
    enabled: Boolean(session?.accessToken),
    staleTime: 60_000,
  });

  const coachRelationshipQuery = useQuery({
    queryKey: ["coach-relationship", session?.accessToken],
    queryFn: () => fetchCoachRelationshipStatus(session?.accessToken ?? ""),
    enabled: Boolean(session?.accessToken),
    staleTime: 60_000,
  });

  const coachLabel = useMemo(() => {
    const coach = coachRelationshipQuery.data?.coach;
    return coach?.fullName ?? coach?.email ?? null;
  }, [coachRelationshipQuery.data?.coach]);

  useEffect(() => {
    if (dismissed || !session?.accessToken) {
      return;
    }

    const hasCoachInvite = Boolean(coachRelationshipQuery.data?.status);
    const shouldShowCoachInvite = hasCoachInvite && !coachInviteSeen;
    const shouldShowTrial = Boolean(
      !hasCoachInvite && trialQuery.data?.trialStartedAt && !trialQuery.data?.trialWelcomeSeenAt
    );

    if (shouldShowCoachInvite) {
      setDialogType("coach");
      setIsOpen(true);
      return;
    }

    if (shouldShowTrial) {
      setDialogType("trial");
      setIsOpen(true);
      return;
    }

    if (isOpen) {
      setIsOpen(false);
      setDialogType(null);
    }
  }, [
    coachInviteSeen,
    coachRelationshipQuery.data?.status,
    dismissed,
    isOpen,
    session?.accessToken,
    trialQuery.data,
  ]);

  const handleClose = async () => {
    if (!session?.accessToken) {
      setIsOpen(false);
      setDismissed(true);
      return;
    }

    if (dialogType === "coach") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COACH_INVITE_SEEN_KEY, "true");
      }
      setCoachInviteSeen(true);
      setIsOpen(false);
      setDismissed(true);
      setDialogType(null);
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
      setDialogType(null);
    }
  };

  if (!isOpen || !dialogType) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-10 backdrop-blur">
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-emerald-300/30 bg-card p-6 text-foreground shadow-2xl dark:bg-slate-950">
        <div className="space-y-3">
          <p className="text-lg font-semibold text-foreground">
            {dialogType === "trial" ? TRIAL_COPY.title : COACH_COPY.title}
          </p>
          {dialogType === "trial" ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Français</p>
                <p className="text-sm text-muted-foreground">{TRIAL_COPY.introFr}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {TRIAL_COPY.featuresFr.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">English</p>
                <p className="text-sm text-muted-foreground">{TRIAL_COPY.introEn}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {TRIAL_COPY.featuresEn.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Français</p>
                <p className="text-sm text-muted-foreground">{COACH_COPY.introFr}</p>
                {coachLabel ? (
                  <p className="text-sm text-muted-foreground">
                    {COACH_COPY.detailsLabelFr} : {coachLabel}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">English</p>
                <p className="text-sm text-muted-foreground">{COACH_COPY.introEn}</p>
                {coachLabel ? (
                  <p className="text-sm text-muted-foreground">
                    {COACH_COPY.detailsLabelEn}: {coachLabel}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" onClick={handleClose} disabled={isSubmitting}>
            {dialogType === "trial" ? TRIAL_COPY.cta : COACH_COPY.cta}
          </Button>
        </div>
      </div>
    </div>
  );
}
