import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const dashboard = () => source("app/organizer/_components/OrganizerDashboard.tsx");
const phone = () => source("app/organizer/_components/dashboard/racebook-phone-preview/RacebookPhonePreview.tsx");
const sharedView = () => source("../../packages/racebook-ui/src/view/RacebookView.tsx");
const sharedLoadingView = () => source("../../packages/racebook-ui/src/view/RacebookLoadingView.tsx");
const mobileRacebook = () => source("../mobile/app/(app)/race/[id]/racebook.tsx");

describe("RaceBook live preview integration contract", () => {
  it("keeps the dashboard preview behind the public feature flag", () => {
    const value = dashboard();

    expect(value).toContain('process.env.NEXT_PUBLIC_ORGANIZER_RACEBOOK_LIVE_PREVIEW_ENABLED === "true"');
    expect(value).toContain("RACEBOOK_LIVE_PREVIEW_ENABLED ? (");
    expect(value).toContain("<RacebookPhonePreview");
    expect(value).toContain("model={previewModel}");
  });

  it("wires controlled tabs, locale, format and loading mode into the phone", () => {
    const value = phone();

    expect(value).toContain('<option value="fr">FR</option>');
    expect(value).toContain('<option value="en">EN</option>');
    expect(value).toContain('<option value="sponsor-loading">Sponsors</option>');
    expect(value).toContain("activeTab={props.activeTab}");
    expect(value).toContain("activeCourseTab={props.activeCourseTab}");
    expect(value).toContain("onTabChange={props.onTabChange}");
    expect(value).toContain("onCourseTabChange={props.onCourseTabChange}");
    expect(value).toContain('value={props.selectedFormatId ?? ""} onChange={props.onFormatChange}');
  });

  it("does not provide an external-action adapter to the organizer phone", () => {
    const value = phone();
    const viewInvocation = value.slice(value.indexOf("<RacebookView"), value.indexOf("/>", value.indexOf("<RacebookView")));

    expect(viewInvocation).not.toContain("adapters=");
    expect(viewInvocation).not.toContain("onInteraction=");
    expect(sharedView()).toContain("const enabled = Boolean(url && adapters?.openUrl)");
  });

  it("keeps sponsor loading as a controlled rendering state", () => {
    const value = phone();
    const view = sharedView();

    expect(value).toContain("previewMode={props.previewMode}");
    expect(value).toContain("sponsorLookupDone");
    expect(view).toContain('if(previewMode==="sponsor-loading")');
    expect(view).toContain("model.sponsors.loading");
    expect(view).toContain("<RacebookLoadingView");
    expect(sharedLoadingView()).toContain("Animated.timing(animatedProgress");
  });

  it("keeps loading presentation out of the mobile container", () => {
    const value = mobileRacebook();
    expect(value).toContain("<RacebookLoadingView");
    expect(value).not.toContain("function SponsorChip");
    expect(value).not.toContain("function FeaturedSponsor");
    expect(value).not.toContain("function RacebookLoadingScreen");
  });

  it("preloads private structured drafts once for the selected scopes", () => {
    const value = dashboard();

    expect(value).toContain("`/api/organizer/editions/${editionId}/services`");
    expect(value).toContain("`/api/organizer/editions/${editionId}/sponsors`");
    expect(value).toContain("`/api/organizer/editions/${editionId}/branding`");
    expect(value).toContain("`/api/organizer/races/${raceId}/start-waves`");
    expect(value).toContain("`/api/organizer/races/${raceId}/awards`");
    expect(value).toContain("previewServices?.scopeId === activeEdition.id");
    expect(value).toContain("previewStartWaves?.scopeId === previewRaceId");
  });

  it("remounts the controlled view when a requested tab becomes available", () => {
    const value = phone();

    expect(value).toContain("const viewAvailabilityKey = [");
    expect(value).toContain("props.model.data.startWaves.length");
    expect(value).toContain("key={viewAvailabilityKey}");
  });

  it("keeps the editor full-width below xl and restores the baseline shell when disabled", () => {
    const value = dashboard();

    expect(value).toContain('RACEBOOK_LIVE_PREVIEW_ENABLED ? "max-w-[1600px]" : "max-w-7xl"');
    expect(value).toContain('"flex flex-col items-stretch gap-5 xl:flex-row xl:items-start"');
    expect(value).toContain("RACEBOOK_LIVE_PREVIEW_ENABLED && previewModel ? (");
  });

  it("keeps sidecar caches complete and invalidates races after module settings change", () => {
    const value = dashboard();

    expect(value).toContain('fetch(`/api/organizer/races/${raceId}/aid-stations`');
    expect(value).not.toContain("raceModules?.aid_stations ?? true");
    expect(value).toContain("invalidateOrganizerRaceDataCache(raceId);");
    expect(value).toContain("sidecarRequestsRef.current.delete(raceId);");
  });

  it("isolates and selects the draft-new-format preview", () => {
    const value = dashboard();

    expect(value).toContain("resolvePreviewRace(isAddingFormat, activeRace, previewFallbackRace)");
    expect(value).toContain('id: isAddingFormat ? "draft-new-format" : previewRace?.id ?? null');
    expect(value).toContain("selectedFormatId={isAddingFormat ? ADD_FORMAT_TAB_ID");
  });

  it("merges the open custom product form only into its active race preview", () => {
    const value = dashboard();

    expect(value).toContain("const previewStationProducts = mergeDraftProductIntoPreview(");
    expect(value).toContain("Boolean(previewRaceId && activeRace?.id === previewRaceId && activeSidecarsReady)");
  });
});
