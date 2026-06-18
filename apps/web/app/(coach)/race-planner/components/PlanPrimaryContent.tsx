"use client";

import { memo, type ReactNode } from "react";
import type { UseFormRegister, UseFormSetValue } from "react-hook-form";

import type { CoachCommentsTranslations, RacePlannerTranslations } from "../../../../locales/types";
import type { FuelProduct } from "../../../../lib/product-types";
import type { StoredProductPreference } from "../../../../lib/product-preferences";
import { ActionPlan } from "../../../../components/race-planner/ActionPlan";
import type {
  ElevationPoint,
  FormValues,
  OrganizerAidStationProductSuggestion,
  SectionSegment,
  Segment,
  StationSupply,
} from "../types";
import type { RaceTotals } from "../utils/nutrition";

type PlanPrimaryContentProps = {
  profileError: string | null;
  showProfileError: boolean;
  copy: RacePlannerTranslations;
  sectionIds: { pacing: string; intake: string; timeline: string };
  pacing: {
    durationMinutes: number | null;
    paceType: "pace" | "speed";
    paceMinutes: number;
    paceSeconds: number;
    speedKph: number;
    fatigueLevel: number;
  };
  setupContent?: ReactNode;
  register: UseFormRegister<FormValues>;
  segments: Segment[];
  sectionSegments?: Record<string, SectionSegment[]>;
  elevationProfile: ElevationPoint[];
  baseMinutesPerKm: number | null;
  raceTotals: RaceTotals | null;
  onPrintAssistance: () => void;
  onAutomaticFill: (options?: { useOrganizerProducts?: boolean }) => void;
  onAddAidStation: (station: { name: string; distanceKm: number; waterRefill?: boolean; solidRefill?: boolean; assistanceAllowed?: boolean }) => void;
  onRemoveAidStation: (index: number) => void;
  setValue: UseFormSetValue<FormValues>;
  formatDistanceWithUnit: (value: number) => string;
  formatMinutes: (totalMinutes: number) => string;
  formatFuelAmount: (value: number) => string;
  formatWaterAmount: (value: number) => string;
  formatSodiumAmount: (value: number) => string;
  fuelProducts: FuelProduct[];
  favoriteProducts: StoredProductPreference[];
  onFavoriteToggle: (product: FuelProduct) => { updated: boolean; reason?: "limit" };
  favoriteLimit: number;
  localProductIds?: string[];
  organizerAidStationProducts?: Record<string, OrganizerAidStationProductSuggestion[]>;
  startSupplies: StationSupply[];
  onStartSupplyDrop: (productId: string, quantity?: number) => void;
  onStartSupplyRemove: (productId: string) => void;
  onSupplyDrop: (
    aidStationIndex: number,
    productId: string,
    quantity?: number,
    options?: { source?: StationSupply["source"] }
  ) => void;
  onSupplyRemove: (aidStationIndex: number, productId: string) => void;
  allowAutoFill: boolean;
  allowExport: boolean;
  premiumCopy: RacePlannerTranslations["account"]["premium"];
  onUpgrade: (reason: "autoFill" | "print") => void;
  upgradeStatus: "idle" | "opening";
  coachCommentsCopy: CoachCommentsTranslations;
  coachCommentsContext?: {
    accessToken?: string;
    planId?: string;
    coacheeId?: string;
    canEdit?: boolean;
  };
};

export const PlanPrimaryContent = memo(function PlanPrimaryContent({
  profileError,
  showProfileError,
  copy,
  sectionIds,
  pacing,
  setupContent,
  register,
  segments,
  sectionSegments,
  elevationProfile,
  baseMinutesPerKm,
  raceTotals,
  onPrintAssistance,
  onAutomaticFill,
  onAddAidStation,
  onRemoveAidStation,
  setValue,
  formatDistanceWithUnit,
  formatMinutes,
  formatFuelAmount,
  formatWaterAmount,
  formatSodiumAmount,
  fuelProducts,
  favoriteProducts,
  onFavoriteToggle,
  favoriteLimit,
  localProductIds,
  organizerAidStationProducts,
  startSupplies,
  onStartSupplyDrop,
  onStartSupplyRemove,
  onSupplyDrop,
  onSupplyRemove,
  allowAutoFill,
  allowExport,
  premiumCopy,
  onUpgrade,
  upgradeStatus,
  coachCommentsCopy,
  coachCommentsContext,
}: PlanPrimaryContentProps) {
  return (
    <div className="space-y-6">
      {showProfileError && profileError ? <p className="text-sm text-amber-200">{profileError}</p> : null}
      {setupContent}

      <ActionPlan
        copy={copy}
        segments={segments}
        sectionSegments={sectionSegments}
        elevationProfile={elevationProfile}
        baseMinutesPerKm={baseMinutesPerKm}
        fatigueLevel={pacing.fatigueLevel}
        raceTotals={raceTotals}
        sectionId={sectionIds.timeline}
        onPrintAssistance={onPrintAssistance}
        onAutomaticFill={onAutomaticFill}
        onAddAidStation={onAddAidStation}
        onRemoveAidStation={onRemoveAidStation}
        register={register}
        setValue={setValue}
        formatDistanceWithUnit={formatDistanceWithUnit}
        formatMinutes={formatMinutes}
        formatFuelAmount={formatFuelAmount}
        formatWaterAmount={formatWaterAmount}
        formatSodiumAmount={formatSodiumAmount}
        fuelProducts={fuelProducts}
        favoriteProducts={favoriteProducts}
        onFavoriteToggle={onFavoriteToggle}
        favoriteLimit={favoriteLimit}
        localProductIds={localProductIds}
        organizerAidStationProducts={organizerAidStationProducts}
        startSupplies={startSupplies}
        onStartSupplyDrop={onStartSupplyDrop}
        onStartSupplyRemove={onStartSupplyRemove}
        onSupplyDrop={onSupplyDrop}
        onSupplyRemove={onSupplyRemove}
        allowAutoFill={allowAutoFill}
        allowExport={allowExport}
        premiumCopy={premiumCopy}
        onUpgrade={onUpgrade}
        upgradeStatus={upgradeStatus}
        coachCommentsCopy={coachCommentsCopy}
        coachCommentsContext={coachCommentsContext}
      />
    </div>
  );
});

PlanPrimaryContent.displayName = "PlanPrimaryContent";
