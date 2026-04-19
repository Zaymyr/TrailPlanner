"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { exportHtmlToPng } from "../../../lib/export-html-to-png";
import type { AdminTranslations } from "../../../locales/types";
import type { SocialRacePlanTemplate } from "../../../lib/social-race-plan-template";
import {
  getSocialRacePlanSlideLabel,
  SocialRacePlanCarousel,
  socialRacePlanSlideIds,
  type SocialRacePlanSlideId,
} from "./SocialRacePlanCarousel";

type Props = {
  accessToken: string | null | undefined;
  t: AdminTranslations["socialTemplates"];
};

const savedPlansResponseSchema = z.object({
  plans: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      updated_at: z.string().optional(),
      races: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
    })
  ),
});

type SavedPlanOption = z.infer<typeof savedPlansResponseSchema>["plans"][number];

const formatPlanLabel = (plan: SavedPlanOption) => {
  const raceName = plan.races?.name?.trim();
  return raceName && raceName !== plan.name ? `${plan.name} | ${raceName}` : plan.name;
};

const formatUpdatedAt = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const sanitizeFileName = (value: string) => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || "social-race-plan";
};

const isSlideId = (value: string): value is SocialRacePlanSlideId =>
  socialRacePlanSlideIds.some((slideId) => slideId === value);

export default function AdminSocialTemplatesSection({ accessToken, t }: Props) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Record<SocialRacePlanSlideId, HTMLDivElement | null>>({
    hook: null,
    macro: null,
    nutrition: null,
    cta: null,
  });
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [activeSlideId, setActiveSlideId] = useState<SocialRacePlanSlideId>("hook");
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["admin", "social-templates", "plans", accessToken],
    enabled: Boolean(accessToken),
    staleTime: 60_000,
    queryFn: async () => {
      if (!accessToken) throw new Error(t.loadPlansError);

      const response = await fetch("/api/plans", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message = (data as { message?: string } | null)?.message ?? t.loadPlansError;
        throw new Error(message);
      }

      const parsed = savedPlansResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error(t.loadPlansError);

      return parsed.data.plans;
    },
  });

  useEffect(() => {
    const plans = plansQuery.data ?? [];

    if (plans.length === 0) {
      if (selectedPlanId) setSelectedPlanId("");
      return;
    }

    if (!plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans[0]?.id ?? "");
    }
  }, [plansQuery.data, selectedPlanId]);

  const templateQuery = useQuery({
    queryKey: ["admin", "social-templates", "template", accessToken, selectedPlanId],
    enabled: Boolean(accessToken && selectedPlanId),
    queryFn: async () => {
      if (!accessToken || !selectedPlanId) throw new Error(t.loadTemplateError);

      const response = await fetch(`/api/race-plans/${selectedPlanId}/social-template`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as SocialRacePlanTemplate | { message?: string } | null;

      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.loadTemplateError);
      }

      return data as SocialRacePlanTemplate;
    },
  });

  const selectedPlan = useMemo(
    () => (plansQuery.data ?? []).find((plan) => plan.id === selectedPlanId) ?? null,
    [plansQuery.data, selectedPlanId]
  );
  const template = templateQuery.data ?? null;

  const slideDefinitions = useMemo(
    () =>
      socialRacePlanSlideIds.map((slideId) => ({
        id: slideId,
        label: getSocialRacePlanSlideLabel(slideId, t.poster),
      })),
    [t.poster]
  );

  useEffect(() => {
    if (!templateQuery.data) return;

    setActiveSlideId("hook");

    const hookSlide = slideRefs.current.hook;
    if (hookSlide) {
      hookSlide.scrollIntoView({ behavior: "auto", inline: "start", block: "nearest" });
    }
  }, [templateQuery.data]);

  useEffect(() => {
    const root = carouselRef.current;
    if (!root || !templateQuery.data) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        const slideId = visibleEntry?.target.getAttribute("data-slide-id");

        if (slideId && isSlideId(slideId)) {
          setActiveSlideId(slideId);
        }
      },
      {
        root,
        threshold: [0.45, 0.6, 0.8],
      }
    );

    slideDefinitions.forEach((slide) => {
      const node = slideRefs.current[slide.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [slideDefinitions, templateQuery.data]);

  const scrollToSlide = (slideId: SocialRacePlanSlideId) => {
    setActiveSlideId(slideId);
    slideRefs.current[slideId]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const handleExport = async () => {
    const activeSlide = slideRefs.current[activeSlideId];

    if (!template || !activeSlide) return;

    setExportError(null);
    setIsExporting(true);

    try {
      await exportHtmlToPng(
        activeSlide,
        `${sanitizeFileName(`${template.plan.name}-${activeSlideId}`)}.png`
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : t.exportError);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.title}</CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.description}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-social-template-plan">{t.planLabel}</Label>
              <select
                id="admin-social-template-plan"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                value={selectedPlanId}
                onChange={(event) => {
                  setExportError(null);
                  setSelectedPlanId(event.target.value);
                }}
                disabled={plansQuery.isLoading || (plansQuery.data?.length ?? 0) === 0}
              >
                <option value="">{t.planPlaceholder}</option>
                {(plansQuery.data ?? []).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {formatPlanLabel(plan)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void plansQuery.refetch()} disabled={plansQuery.isLoading}>
                {plansQuery.isLoading ? t.refreshingPlans : t.refreshPlans}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void templateQuery.refetch()}
                disabled={!selectedPlanId || templateQuery.isLoading}
              >
                {templateQuery.isLoading ? t.refreshingPreview : t.refreshPreview}
              </Button>
              <Button type="button" onClick={() => void handleExport()} disabled={!templateQuery.data || isExporting}>
                {isExporting ? t.exporting : t.exportPng}
              </Button>
            </div>

            {selectedPlan ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {t.selectionTitle}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">{selectedPlan.name}</p>
                {selectedPlan.races?.name ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedPlan.races.name}</p>
                ) : null}
                {formatUpdatedAt(selectedPlan.updated_at) ? (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {t.updatedAt.replace("{date}", formatUpdatedAt(selectedPlan.updated_at) ?? "")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {plansQuery.error ? (
              <p className="text-sm text-red-600 dark:text-red-300">
                {plansQuery.error instanceof Error ? plansQuery.error.message : t.loadPlansError}
              </p>
            ) : null}

            {templateQuery.error ? (
              <p className="text-sm text-red-600 dark:text-red-300">
                {templateQuery.error instanceof Error ? templateQuery.error.message : t.loadTemplateError}
              </p>
            ) : null}

            {exportError ? <p className="text-sm text-red-600 dark:text-red-300">{exportError}</p> : null}

            {(plansQuery.data?.length ?? 0) === 0 && !plansQuery.isLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.emptyPlans}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.previewTitle}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t.previewDescription}</p>
            </div>

            {template ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {slideDefinitions.map((slide, index) => {
                      const isActive = slide.id === activeSlideId;

                      return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => scrollToSlide(slide.id)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            isActive
                              ? "bg-emerald-600 text-white dark:bg-emerald-500"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          }`}
                        >
                          {slide.label}
                          <span className="ml-2 text-xs opacity-75">{String(index + 1).padStart(2, "0")}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {t.slideProgress
                      .replace("{current}", String(slideDefinitions.findIndex((slide) => slide.id === activeSlideId) + 1))
                      .replace("{total}", String(slideDefinitions.length))}
                  </p>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400">{t.scrollHint}</p>

                <div
                  ref={carouselRef}
                  className="flex snap-x snap-mandatory gap-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  {slideDefinitions.map((slide) => (
                    <div
                      key={slide.id}
                      ref={(node) => {
                        slideRefs.current[slide.id] = node;
                      }}
                      data-slide-id={slide.id}
                      className="shrink-0 snap-start"
                    >
                      <SocialRacePlanCarousel template={template} t={t.poster} slideId={slide.id} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
                {selectedPlanId ? (templateQuery.isLoading ? t.loadingPreview : t.previewEmpty) : t.noPlanSelected}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
