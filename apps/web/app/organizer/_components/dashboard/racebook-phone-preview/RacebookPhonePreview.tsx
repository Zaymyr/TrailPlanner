"use client";

import {
  RacebookView,
  type RacebookCourseTab,
  type RacebookLocale,
  type RacebookPreviewMode,
  type RacebookPrimaryTab,
  type RacebookViewModel,
} from "@pace-yourself/racebook-ui";
import { useId, useState, type ReactNode } from "react";

import { Button } from "../../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../../components/ui/dialog";

export type RacebookPreviewFormatOption = { id: string; label: string };

export type RacebookPreviewStatus = {
  label: string;
  tone?: "neutral" | "warning" | "locked";
};

export type RacebookPhonePreviewProps = {
  model: RacebookViewModel;
  locale: RacebookLocale;
  onLocaleChange: (locale: RacebookLocale) => void;
  previewMode: RacebookPreviewMode;
  onPreviewModeChange: (mode: RacebookPreviewMode) => void;
  formats: RacebookPreviewFormatOption[];
  selectedFormatId: string | null;
  onFormatChange: (formatId: string) => void;
  activeTab: RacebookPrimaryTab;
  activeCourseTab: RacebookCourseTab;
  onTabChange: (tab: RacebookPrimaryTab) => void;
  onCourseTabChange: (tab: RacebookCourseTab) => void;
  statuses?: RacebookPreviewStatus[];
  loadingProgress?: number;
};

const statusClasses: Record<NonNullable<RacebookPreviewStatus["tone"]>, string> = {
  neutral: "border-border bg-muted/50 text-muted-foreground",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  locked: "border-brand/30 bg-brand/5 text-foreground",
};

export function RacebookPhonePreview(props: RacebookPhonePreviewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="xl:hidden">
        <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
          Voir l’aperçu
        </Button>
      </div>

      <aside className="hidden w-[422px] shrink-0 xl:block" aria-label="Aperçu RaceBook en direct">
        <div className="sticky top-6">
          <PreviewPanel {...props} />
        </div>
      </aside>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="!flex max-h-[calc(100dvh-2rem)] max-w-[440px] flex-col overflow-hidden p-3 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>Aperçu RaceBook en direct</DialogTitle>
            <DialogDescription>Prévisualisation du brouillon dans un téléphone simulé.</DialogDescription>
          </DialogHeader>
          <PreviewPanel {...props} compact />
          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
            Fermer l’aperçu
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PreviewPanel({ compact = false, ...props }: RacebookPhonePreviewProps & { compact?: boolean }) {
  const localeId = useId();
  const formatId = useId();
  const modeId = useId();
  const viewAvailabilityKey = [
    props.activeTab,
    props.activeCourseTab,
    props.model.modules.equipment,
    props.model.modules.bibPickup,
    props.model.modules.access,
    props.model.modules.services,
    props.model.modules.startWaves,
    props.model.modules.awards,
    props.model.modules.relay,
    props.model.data.editionServices.length,
    props.model.data.startWaves.length,
    props.model.data.awards.length,
    props.model.data.relayPoints.length,
  ].join(":");

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Aperçu du brouillon</p>
          <p className="text-xs text-muted-foreground">Mis à jour pendant la saisie</p>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-label="Aperçu synchronisé" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Control label="Langue" id={localeId} value={props.locale} onChange={(value) => props.onLocaleChange(value as RacebookLocale)}>
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </Control>
        <Control label="Format" id={formatId} value={props.selectedFormatId ?? ""} onChange={props.onFormatChange} disabled={props.formats.length === 0}>
          {props.formats.length === 0 ? <option value="">Aucun</option> : props.selectedFormatId === null ? <option value="">Sélectionner</option> : null}
          {props.formats.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}
        </Control>
        <Control label="Vue" id={modeId} value={props.previewMode} onChange={(value) => props.onPreviewModeChange(value as RacebookPreviewMode)}>
          <option value="content">RaceBook</option>
          <option value="sponsor-loading">Sponsors</option>
        </Control>
      </div>

      {props.statuses?.length ? (
        <div className="flex flex-wrap gap-1.5" aria-label="État de l’aperçu">
          {props.statuses.map((status, index) => (
            <span key={`${status.label}-${index}`} className={`rounded-full border px-2 py-1 text-[11px] font-medium ${statusClasses[status.tone ?? "neutral"]}`}>
              {status.label}
            </span>
          ))}
        </div>
      ) : null}

      <PhoneFrame compact={compact}>
        <RacebookView
          key={viewAvailabilityKey}
          model={props.model}
          locale={props.locale}
          previewMode={props.previewMode}
          loadingProgress={props.loadingProgress}
          sponsorLookupDone
          activeTab={props.activeTab}
          activeCourseTab={props.activeCourseTab}
          onTabChange={props.onTabChange}
          onCourseTabChange={props.onCourseTabChange}
        />
      </PhoneFrame>
    </div>
  );
}

function Control({ label, id, children, ...props }: {
  label: string;
  id: string;
  children: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="min-w-0 text-[11px] font-medium text-muted-foreground">
      {label}
      <select
        id={id}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        disabled={props.disabled}
      >
        {children}
      </select>
    </label>
  );
}

function PhoneFrame({ children, compact }: { children: ReactNode; compact: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[390px] rounded-[42px] border-[7px] border-[#20231f] bg-[#20231f] p-1 shadow-xl">
      <div className="mx-auto mb-1 h-5 w-24 rounded-b-2xl bg-[#20231f]" aria-hidden="true" />
      <div
        className={`overflow-y-auto rounded-[30px] bg-[#f7f7f3] ${compact ? "h-[min(680px,calc(100dvh-15rem))] min-h-[360px]" : "h-[720px]"}`}
        aria-label="Écran du téléphone simulé"
      >
        {children}
      </div>
    </div>
  );
}
