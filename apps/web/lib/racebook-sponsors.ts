import { z } from "zod";

import {
  buildRunnerOrganizerDetails,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "./organizer-dashboard-details";

export const MAX_RACEBOOK_SPONSORS_PER_EDITION = 10;
export const MAX_RACEBOOK_LOADING_SPONSORS = 2;
export const MAX_RACEBOOK_SPONSOR_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const RACEBOOK_SPONSOR_IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export const racebookSponsorRowSchema = z.object({
  id: z.string().uuid(),
  edition_id: z.string().uuid(),
  name: z.string(),
  logo_url: z.string().url(),
  website_url: z.string().url().nullable(),
  is_active: z.boolean(),
  show_on_loading: z.boolean(),
  show_in_banner: z.boolean(),
  position: z.number().int().nonnegative(),
  click_count: z.number().int().nonnegative(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type RacebookSponsorRow = z.infer<typeof racebookSponsorRowSchema>;

export const sponsorNameSchema = z.string().trim().min(1).max(80);
export const sponsorWebsiteSchema = z
  .union([z.string().trim().url(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null))
  .refine((value) => !value || /^https?:\/\//i.test(value), "Invalid sponsor URL.");

export const sponsorMetadataSchema = z
  .object({
    name: sponsorNameSchema,
    websiteUrl: sponsorWebsiteSchema,
    isActive: z.boolean(),
    showOnLoading: z.boolean(),
    showInBanner: z.boolean(),
    position: z.number().int().min(0).max(MAX_RACEBOOK_SPONSORS_PER_EDITION - 1),
  })
  .refine((value) => !value.isActive || value.showOnLoading || value.showInBanner, {
    message: "An active sponsor needs at least one placement.",
  });

export const toOrganizerSponsor = (sponsor: RacebookSponsorRow) => ({
  id: sponsor.id,
  editionId: sponsor.edition_id,
  name: sponsor.name,
  logoUrl: sponsor.logo_url,
  websiteUrl: sponsor.website_url,
  isActive: sponsor.is_active,
  showOnLoading: sponsor.show_on_loading,
  showInBanner: sponsor.show_in_banner,
  position: sponsor.position,
  clickCount: sponsor.click_count,
});

const hasText = (...values: Array<string | null | undefined>) =>
  values.some((value) => typeof value === "string" && value.trim().length > 0);

const hasLocation = (location: ReturnType<typeof parseOrganizerEventDetails>["eventLocation"]) =>
  hasText(location.label, location.googleMapsUrl) || (location.lat !== null && location.lng !== null);

const hasEquipment = (equipment: ReturnType<typeof parseOrganizerEventDetails>["mandatoryEquipment"]) =>
  equipment.items.length > 0 || hasText(equipment.note);

export function hasOrganizerRacebookContent(
  eventValue: unknown,
  raceValue: unknown,
  participationMode: unknown,
) {
  if (participationMode === "relay" || participationMode === "solo_and_relay") return true;
  const event = parseOrganizerEventDetails(eventValue);
  const race = parseOrganizerRaceDetails(raceValue);
  const runner = buildRunnerOrganizerDetails(event, race);
  const bib = event.bibPickup;
  const access = runner.access;

  return (
    hasText(event.dateRange.endDate, event.emergencyContact.phone) ||
    hasLocation(event.eventLocation) ||
    hasLocation(race.raceLocation) ||
    hasEquipment(event.mandatoryEquipment) ||
    hasEquipment(race.mandatoryEquipment) ||
    hasText(bib.location, bib.schedule, bib.requiredDocuments, bib.note) ||
    hasLocation(bib.locationDetails) ||
    bib.locations.some((location) =>
      hasText(location.location) ||
      hasLocation(location.locationDetails) ||
      location.slots.some((slot) => hasText(slot.date, slot.startTime, slot.endTime))) ||
    bib.thirdPartyPickupAllowed !== null ||
    bib.equipmentCheck !== null ||
    hasText(
      access.startAddress,
      access.finishAddress,
      access.enabledSections.officialParkings ? access.officialParkings : null,
      access.enabledSections.shuttles ? access.shuttles : null,
      access.enabledSections.shuttles ? access.shuttleSchedule : null,
      access.enabledSections.roadRestrictions ? access.roadRestrictions : null,
      access.enabledSections.mapUrl ? access.mapUrl : null,
      access.note,
    ) ||
    hasLocation(access.startLocation) ||
    hasLocation(access.finishLocation) ||
    hasText(
      runner.services.supporters,
      runner.services.accommodations,
      runner.services.restaurants,
      runner.services.recovery,
      runner.services.partners,
      runner.services.lastMinuteMessage,
      runner.services.note,
      runner.runnerInfo.startArea,
      runner.runnerInfo.briefing,
      runner.runnerInfo.rules,
      runner.runnerInfo.note,
      runner.schedule.startTime,
      runner.schedule.finishCutoffTime,
      runner.schedule.shuttleSchedule,
      runner.schedule.cutoffNote,
      runner.schedule.note,
    )
  );
}
