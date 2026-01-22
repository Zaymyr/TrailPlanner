"use client";

import type { UseFormRegister, UseFormSetValue } from "react-hook-form";

import type { CoachCommentsTranslations, RacePlannerTranslations } from "../../../../locales/types";
import type { FuelProduct } from "../../../../lib/product-types";
import type { StoredProductPreference } from "../../../../lib/product-preferences";
import { ActionPlan } from "../../../../components/race-planner/ActionPlan";
import { CommandCenter } from "../../../../components/race-planner/CommandCenter";
import type { FormValues, Segment, StationSupply } from "../types";
import type { RaceTotals } from "../utils/nutrition";

type PlanPrimaryContentProps = {
  profileError: string | null;
  showProfileError: boolean;
  copy: RacePlannerTranslations;
  sectionIds: { pacing: string; intake: string; timeline: string };
  pacing: {
    durationMinutes: number | null;
    paceMinutes: number;
    paceSeconds: number;
    speedKph: number;
  };
  coachManaged?: boolean;
  register: UseFormRegister<FormValues>;
  onPaceChange: (minutes: number, seconds: number) => void;
  onSpeedChange: (speedKph: number) => void;
  formatDuration: (totalMinutes: number) => string;
  segments: Segment[];
  raceTotals: RaceTotals | null;
  onPrint: () => void;
  onAutomaticFill: () => void;
  onAddAidStation: (station: { name: string; distanceKm: number }) => void;
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
  startSupplies: StationSupply[];
  onStartSupplyDrop: (productId: string, quantity?: number) => void;
  onStartSupplyRemove: (productId: string) => void;
  onSupplyDrop: (aidStationIndex: number, productId: string, quantity?: number) => void;
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

export function PlanPrimaryContent({
  profileError,
  showProfileError,
  copy,
  sectionIds,
  pacing,
  coachManaged,
  register,
  onPaceChange,
  onSpeedChange,
  formatDuration,
  segments,
  raceTotals,
  onPrint,
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
      <CommandCenter
        copy={copy}
        sectionIds={{ pacing: sectionIds.pacing, intake: sectionIds.intake }}
        pacing={pacing}
        coachManaged={coachManaged}
        register={register}
        onPaceChange={onPaceChange}
        onSpeedChange={onSpeedChange}
        formatDuration={formatDuration}
      />

      <ActionPlan
        copy={copy}
        segments={segments}
        raceTotals={raceTotals}
        sectionId={sectionIds.timeline}
        onPrint={onPrint}
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
}
