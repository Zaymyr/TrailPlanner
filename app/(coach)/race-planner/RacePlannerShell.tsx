"use client";

import Script from "next/script";
import { useState } from "react";
import type React from "react";

import { RacePlannerLayout } from "../../components/race-planner/RacePlannerLayout";
import { ActionPlan } from "../../components/race-planner/ActionPlan";
import { ProductsPicker } from "../../components/race-planner/ProductsPicker";
import { SettingsPanel } from "../../components/race-planner/SettingsPanel";
import { AffiliateProductModal } from "./components/AffiliateProductModal";
import { useRacePlanner, slopeToColor, smoothSpeedSamples, adjustedSegmentMinutes } from "./hooks/useRacePlanner";
import { useI18n } from "../i18n-provider";
import type { AidStation, ElevationPoint, SpeedSample } from "./types";
import { Button } from "../../components/ui/button";
import { PlanSummaryPanel } from "../../components/race-planner/PlanSummaryPanel";
import { PlanPersistenceCard } from "../../components/race-planner/PlanPersistenceCard";
import { AidStationsEditor } from "../../components/race-planner/AidStationsEditor";
import { FeedbackDialog } from "../../components/race-planner/FeedbackDialog";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

import type { RacePlannerTranslations } from "../../locales/types";

const CardTitleWithTooltip = ({ title, description }: { title: string; description: string }) => (
  <CardTitle className="flex items-center gap-2">
    <span>{title}</span>
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200"
      title={description}
      aria-label={description}
    >
      ?
    </span>
  </CardTitle>
);

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

export function RacePlannerShell({ enableMobileNav = true }: { enableMobileNav?: boolean }) {
  const { t } = useI18n();
  const copy = t.racePlanner;
  const planner = useRacePlanner(copy);
  const [mobileView, setMobileView] = useState<"plan" | "settings">("plan");

  const sectionIds = {
    inputs: "race-inputs",
    timeline: "race-timeline",
    courseProfile: "course-profile",
    pacing: "pacing-section",
    intake: "intake-section",
  } as const;

  const handleMobileImport = () => {
    setMobileView("settings");
    planner.handleImportFromMobileNav();
  };

  const handleMobileFocus = (sectionId: string, view: "plan" | "settings") => {
    setMobileView(view);
    planner.focusSection(sectionId);
  };

  const mobileNavActions = [
    { key: "import", label: copy.mobileNav.importGpx, onClick: handleMobileImport },
    { key: "timeline", label: copy.mobileNav.timeline, onClick: () => handleMobileFocus(sectionIds.timeline, "plan") },
    { key: "pacing", label: copy.mobileNav.pacing, onClick: () => handleMobileFocus(sectionIds.pacing, "settings") },
    { key: "intake", label: copy.mobileNav.intake, onClick: () => handleMobileFocus(sectionIds.intake, "settings") },
  ];

  const pagePaddingClass = enableMobileNav ? "pb-28 xl:pb-6" : "pb-6 xl:pb-6";
  const feedbackButtonOffsetClass = enableMobileNav ? "bottom-20" : "bottom-6";

  const planContent = (
    <div className="space-y-6">
      <PlanSummaryPanel
        copy={copy}
        totals={planner.raceTotals}
        intakeTargets={planner.intakeTargets}
        productEstimates={planner.productEstimates}
        isUsingCustomProducts={planner.isUsingCustomProducts}
        formatDuration={planner.formatMinutes}
        settingsLabel={t.navigation.settings}
        onViewProduct={planner.handleViewProduct}
      />

      <PlanPersistenceCard
        copy={copy.account}
        session={planner.session}
        planName={planner.planName}
        onPlanNameChange={planner.setPlanName}
        onSavePlan={planner.handleSavePlan}
        planStatus={planner.planStatus}
        savedPlans={planner.savedPlans}
        deletingPlanId={planner.deletingPlanId}
        onLoadPlan={planner.handleLoadPlan}
        onDeletePlan={planner.handleDeletePlan}
        accountMessage={planner.accountMessage}
        accountError={planner.accountError}
        onSignOut={planner.handleSignOut}
      />

      <Card id={sectionIds.courseProfile}>
        <CardHeader className="space-y-0">
          <div className="flex items-center justify-between gap-3">
            <CardTitleWithTooltip
              title={copy.sections.courseProfile.title}
              description={copy.sections.courseProfile.description}
            />
          </div>
        </CardHeader>
        <CardContent>
          <ElevationProfileChart
            profile={planner.elevationProfile}
            aidStations={planner.parsedValues.success ? planner.parsedValues.data.aidStations : planner.sanitizedWatchedAidStations}
            totalDistanceKm={(planner.parsedValues.success ? planner.parsedValues.data.raceDistanceKm : planner.watchedValues?.raceDistanceKm) ?? planner.form.getValues("raceDistanceKm")}
            copy={copy}
            baseMinutesPerKm={planner.baseMinutesPerKm}
            uphillEffort={planner.form.watch("uphillEffort") ?? 0}
            downhillEffort={planner.form.watch("downhillEffort") ?? 0}
          />
        </CardContent>
      </Card>

      <AidStationsEditor
        copy={copy.sections.aidStations}
        fields={planner.fields}
        register={planner.form.register}
        onAdd={planner.addAidStation}
        onRemove={planner.removeAidStation}
      />

      <ActionPlan
        copy={copy}
        segments={planner.segments}
        raceTotals={planner.raceTotals}
        sectionId={sectionIds.timeline}
        onPrint={planner.handlePrint}
        onAddAidStation={planner.addAidStation}
        formatDistanceWithUnit={planner.formatDistanceWithUnit}
        formatMinutes={planner.formatMinutes}
        formatFuelAmount={planner.formatFuelAmount}
        formatWaterAmount={planner.formatWaterAmount}
        formatSodiumAmount={planner.formatSodiumAmount}
        calculatePercentage={planner.calculatePercentage}
      />
    </div>
  );

  const planSecondaryContent = (
    <ProductsPicker
      copy={copy.sections.gels}
      products={planner.gelEstimates.map(({ count, ...gel }) => ({ ...gel, servings: count }))}
      selectedProducts={planner.selectedProductSlugs}
      onToggleProduct={(product) =>
        planner.toggleProductSelection({
          id: product.slug,
          slug: product.slug,
          sku: product.slug,
          name: product.name,
          carbsGrams: product.carbs,
          sodiumMg: product.sodium,
          caloriesKcal: 0,
          proteinGrams: 0,
          fatGrams: 0,
        })
      }
      onViewProduct={(product) => planner.handleViewProduct({ slug: product.slug, name: product.name })}
    />
  );

  const settingsContent = (
    <SettingsPanel
      copy={copy}
      sectionIds={{ inputs: sectionIds.inputs, pacing: sectionIds.pacing, intake: sectionIds.intake }}
      importError={planner.importError}
      fileInputRef={planner.fileInputRef}
      onImportGpx={planner.handleImportGpx}
      onExportGpx={planner.handleExportGpx}
      register={planner.form.register}
      paceType={planner.paceType}
      onPaceTypeChange={planner.handlePaceTypeChange}
    />
  );

  return (
    <>
      <Script id="software-application-ld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(planner.structuredData)}
      </Script>

      <div className={`space-y-6 ${pagePaddingClass} print:hidden`}>
        <RacePlannerLayout
          className="space-y-6"
          planContent={planContent}
          planSecondaryContent={planSecondaryContent}
          settingsContent={settingsContent}
          mobileView={mobileView}
          onMobileViewChange={setMobileView}
          planLabel={copy.sections.summary.title}
          settingsLabel={copy.sections.raceInputs.title}
        />

        {enableMobileNav ? (
          <div className="fixed bottom-4 left-4 right-4 z-30 xl:hidden">
            <div className="rounded-full border border-slate-800 bg-slate-950/90 px-2 py-2 shadow-lg shadow-emerald-500/20 backdrop-blur">
              <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-100">
                {mobileNavActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="flex items-center justify-center rounded-full px-3 py-2 text-center transition hover:bg-slate-800/80 active:translate-y-[1px]"
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {!planner.isDesktopApp && (
          <Button
            type="button"
            className={`fixed ${feedbackButtonOffsetClass} left-6 z-20 inline-flex h-12 w-12 rounded-full shadow-lg`}
            aria-label={copy.sections.summary.feedback.open}
            onClick={planner.openFeedbackForm}
          >
            <MessageCircleIcon className="h-5 w-5" />
          </Button>
        )}

        <FeedbackDialog
          copy={copy.sections.summary.feedback}
          open={planner.feedbackState.open}
          subject={planner.feedbackState.subject}
          detail={planner.feedbackState.detail}
          status={planner.feedbackState.status}
          error={planner.feedbackState.error}
          onSubjectChange={planner.setFeedbackSubject}
          onDetailChange={planner.setFeedbackDetail}
          onClose={planner.closeFeedbackForm}
          onSubmit={planner.handleSubmitFeedback}
        />
      </div>

      {planner.segments.length > 0 ? (
        <div className="hidden rounded-lg border border-slate-300 bg-white p-4 text-slate-900 shadow-sm print:block">
          <div className="mb-3">
            <p className="text-sm font-semibold">{copy.sections.timeline.printView.title}</p>
            <p className="text-xs text-slate-600">{copy.sections.timeline.printView.description}</p>
          </div>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full border-collapse text-xs leading-6">
              <thead className="bg-slate-50 text-slate-900">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">#</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {copy.sections.timeline.printView.columns.checkpoint}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {copy.sections.timeline.printView.columns.distance}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {copy.sections.timeline.printView.columns.segment}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {copy.sections.timeline.printView.columns.eta}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {copy.sections.timeline.printView.columns.segmentTime}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {copy.sections.timeline.printView.columns.fuel}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {copy.sections.timeline.printView.columns.water}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {copy.sections.timeline.printView.columns.sodium}
                  </th>
                </tr>
              </thead>
              <tbody>
                {planner.segments.map((segment, index) => {
                  const rowBorder = index === planner.segments.length - 1 ? "" : "border-b border-slate-200";
                  return (
                    <tr key={`${segment.checkpoint}-print-${segment.distanceKm}`} className="align-top">
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>{index + 1}</td>
                      <td className={`${rowBorder} px-3 py-2`}>
                        <div className="font-semibold">{segment.checkpoint}</div>
                        <div className="text-[10px] text-slate-600">
                          {copy.sections.timeline.segmentLabel.replace("{distance}", segment.segmentKm.toFixed(1))}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {planner.formatDistanceWithUnit(segment.distanceKm)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {copy.sections.timeline.segmentLabel.replace("{distance}", segment.segmentKm.toFixed(1))}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {planner.formatMinutes(segment.etaMinutes)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {planner.formatMinutes(segment.segmentMinutes)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {planner.formatFuelAmount(segment.fuelGrams)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {planner.formatWaterAmount(segment.waterMl)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {planner.formatSodiumAmount(segment.sodiumMg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <AffiliateProductModal
        open={Boolean(planner.activeAffiliateProduct)}
        onClose={() => planner.setActiveAffiliateProduct(null)}
        slug={planner.activeAffiliateProduct?.slug ?? ""}
        displayName={planner.activeAffiliateProduct?.name ?? ""}
        countryCode={planner.countryCode}
        sessionId={planner.affiliateSessionId}
        logger={planner.affiliateLogger}
        totals={planner.raceTotals}
      />
    </>
  );
}

type ElevationProfileChartProps = {
  profile: ElevationPoint[];
  aidStations: AidStation[];
  totalDistanceKm: number;
  copy: RacePlannerTranslations;
  baseMinutesPerKm: number | null;
  uphillEffort: number;
  downhillEffort: number;
};

function ElevationProfileChart({
  profile,
  aidStations,
  totalDistanceKm,
  copy,
  baseMinutesPerKm,
  uphillEffort,
  downhillEffort,
}: ElevationProfileChartProps) {
  if (!profile.length || totalDistanceKm <= 0) {
    return <p className="text-sm text-slate-400">{copy.sections.courseProfile.empty}</p>;
  }

  const width = 900;
  const paddingX = 32;
  const paddingY = 20;
  const elevationAreaHeight = 200;
  const speedAreaHeight = 120;
  const verticalGap = 28;
  const height = paddingY + elevationAreaHeight + verticalGap + speedAreaHeight + paddingY;
  const elevationBottom = paddingY + elevationAreaHeight;
  const speedTop = elevationBottom + verticalGap;
  const speedBottom = speedTop + speedAreaHeight;
  const maxElevation = Math.max(...profile.map((p) => p.elevationM));
  const minElevation = Math.min(...profile.map((p) => p.elevationM));
  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const scaledMax = Math.ceil(maxElevation / 10) * 10;
  const scaledMin = Math.floor(minElevation / 10) * 10;

  const xScale = (distanceKm: number) => paddingX + Math.min(Math.max(distanceKm, 0), totalDistanceKm) * ((width - paddingX * 2) / totalDistanceKm);
  const yScale = (elevation: number) => elevationBottom - ((elevation - minElevation) / elevationRange) * elevationAreaHeight;

  const getElevationAtDistance = (distanceKm: number) => {
    if (profile.length === 0) return minElevation;
    const clamped = Math.min(Math.max(distanceKm, 0), totalDistanceKm);
    const nextIndex = profile.findIndex((point) => point.distanceKm >= clamped);
    if (nextIndex <= 0) return profile[0].elevationM;
    const prevPoint = profile[nextIndex - 1];
    const nextPoint = profile[nextIndex] ?? prevPoint;
    const ratio =
      nextPoint.distanceKm === prevPoint.distanceKm
        ? 0
        : (clamped - prevPoint.distanceKm) / (nextPoint.distanceKm - prevPoint.distanceKm);
    return prevPoint.elevationM + (nextPoint.elevationM - prevPoint.elevationM) * ratio;
  };

  const path = profile
    .map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.distanceKm)},${yScale(point.elevationM)}`)
    .join(" ");

  const areaPath = `${path} L${xScale(profile.at(-1)?.distanceKm ?? 0)},${elevationBottom} L${xScale(profile[0].distanceKm)},${elevationBottom} Z`;

  const slopeSegments = profile.slice(1).map((point, index) => {
    const prev = profile[index];
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

  let cumulativeMinutes = 0;
  const speedSamples =
    !baseMinutesPerKm || baseMinutesPerKm <= 0
      ? []
      : profile.slice(1).reduce<SpeedSample[]>((samples, point, index) => {
          const prev = profile[index];
          const segmentKm = Math.max(point.distanceKm - prev.distanceKm, 0);
          if (segmentKm === 0) return samples;

          const ascent = Math.max(point.elevationM - prev.elevationM, 0);
          const descent = Math.max(prev.elevationM - point.elevationM, 0);
          const minutes = adjustedSegmentMinutes(baseMinutesPerKm, segmentKm, { ascent, descent }, uphillEffort, downhillEffort);
          if (minutes <= 0) return samples;

          cumulativeMinutes += minutes;
          const cumulativeDistanceKm = point.distanceKm;
          const averageSpeedKph = cumulativeDistanceKm / (cumulativeMinutes / 60);

          return [...samples, { distanceKm: cumulativeDistanceKm, speedKph: averageSpeedKph }];
        }, []);
  const smoothedSpeedSamples = smoothSpeedSamples(speedSamples, 1.6);
  const maxSpeedKph = smoothedSpeedSamples.length > 0 ? Math.max(...smoothedSpeedSamples.map((s) => s.speedKph)) : 0;
  const minSpeedKph = smoothedSpeedSamples.length > 0 ? Math.min(...smoothedSpeedSamples.map((s) => s.speedKph)) : 0;
  const speedRange = Math.max(maxSpeedKph - minSpeedKph, 1);
  const speedYScale = (speedKph: number) => speedBottom - ((speedKph - minSpeedKph) / speedRange) * speedAreaHeight;
  const speedPath = smoothedSpeedSamples
    .map((sample, index) => `${index === 0 ? "M" : "L"}${xScale(sample.distanceKm)},${speedYScale(sample.speedKph)}`)
    .join(" ");

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-80 w-full"
        role="img"
        aria-label={copy.sections.courseProfile.ariaLabel}
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

        {smoothedSpeedSamples.length > 1 && speedPath && (
          <>
            <rect
              x={paddingX}
              y={speedTop - 10}
              width={width - paddingX * 2}
              height={speedAreaHeight + 20}
              rx={10}
              className="fill-slate-900/40"
            />
            <line x1={paddingX} x2={width - paddingX} y1={speedBottom} y2={speedBottom} stroke="#0f172a" strokeWidth={1} />
            <path
              d={speedPath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_1px_4px_rgba(34,211,238,0.3)]"
            />
            <g>
              <rect x={width - paddingX - 140} y={speedTop} width={120} height={20} rx={4} className="fill-slate-900/70" />
              <text x={width - paddingX - 80} y={speedTop + 14} className="fill-cyan-200 text-[10px]" textAnchor="middle">
                {`${copy.sections.courseProfile.speedLabel} (${copy.sections.courseProfile.speedUnit})`}
              </text>
            </g>
            <text x={width - paddingX} y={speedYScale(maxSpeedKph) - 4} className="fill-cyan-100 text-[10px]" textAnchor="end">
              {`${maxSpeedKph.toFixed(1)} ${copy.sections.courseProfile.speedUnit}`}
            </text>
            <text x={width - paddingX} y={speedYScale(minSpeedKph) + 12} className="fill-cyan-100 text-[10px]" textAnchor="end">
              {`${minSpeedKph.toFixed(1)} ${copy.sections.courseProfile.speedUnit}`}
            </text>
          </>
        )}

        {aidStations.map((station) => {
          const x = xScale(station.distanceKm);
          const elevationAtPoint = getElevationAtDistance(station.distanceKm);
          const y = yScale(elevationAtPoint);
          return (
            <g key={`${station.name}-${station.distanceKm}`}>
              <line x1={x} x2={x} y1={y} y2={elevationBottom} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="2 3" />
              <circle cx={x} cy={y} r={4} fill="#fbbf24" />
              <text x={x} y={elevationBottom + 12} className="fill-slate-300 text-[10px]" textAnchor="middle">
                {station.name}
              </text>
            </g>
          );
        })}

        <text x={width / 2} y={height - 4} className="fill-slate-400 text-[10px]" textAnchor="middle">
          {copy.sections.courseProfile.axisLabel}
        </text>
      </svg>
    </div>
  );
}
