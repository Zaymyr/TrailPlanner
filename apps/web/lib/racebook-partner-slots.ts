import { z } from "zod";

/**
 * RaceBook partner slots ("emplacements partenaires").
 *
 * Every slot shows a Pace Yourself affiliate link by default. With the
 * Signature sponsors module, an organizer can replace a slot with one of their
 * edition sponsors (name, logo, counted redirect, short headline) or hide it.
 */

export const racebookPartnerSlotKeySchema = z.enum(["equipment", "lodging"]);
export const racebookPartnerSlotModeSchema = z.enum(["affiliate", "partner", "hidden"]);
export type RacebookPartnerSlotKey = z.infer<typeof racebookPartnerSlotKeySchema>;
export type RacebookPartnerSlotMode = z.infer<typeof racebookPartnerSlotModeSchema>;

export const RACEBOOK_PARTNER_SLOT_KEYS = racebookPartnerSlotKeySchema.options;

export const RACEBOOK_PARTNER_SLOTS: Record<RacebookPartnerSlotKey, { label: string; affiliatePartner: string; tab: string }> = {
  equipment: { label: "Matériel", affiliatePartner: "Decathlon", tab: "Matériel" },
  lodging: { label: "Hébergement", affiliatePartner: "Booking.com", tab: "Services" },
};

export const racebookPartnerSlotRowSchema = z.object({
  edition_id: z.string().uuid(),
  slot_key: racebookPartnerSlotKeySchema,
  mode: racebookPartnerSlotModeSchema,
  sponsor_id: z.string().uuid().nullable(),
  headline: z.string().nullable(),
  impression_count: z.coerce.number().int().nonnegative().default(0),
  click_count: z.coerce.number().int().nonnegative().default(0),
});
export type RacebookPartnerSlotRow = z.infer<typeof racebookPartnerSlotRowSchema>;

export const racebookPartnerSlotHeadlineSchema = z
  .string()
  .trim()
  .max(120)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

export const racebookPartnerSlotUpdateSchema = z.discriminatedUnion("mode", [
  z.object({ slot: racebookPartnerSlotKeySchema, mode: z.literal("affiliate") }),
  z.object({ slot: racebookPartnerSlotKeySchema, mode: z.literal("hidden") }),
  z.object({
    slot: racebookPartnerSlotKeySchema,
    mode: z.literal("partner"),
    sponsorId: z.string().uuid(),
    headline: racebookPartnerSlotHeadlineSchema.optional().default(null),
  }),
]);
export type RacebookPartnerSlotUpdate = z.infer<typeof racebookPartnerSlotUpdateSchema>;

/** Frozen into each published RaceBook snapshot. */
export const racebookPublishedPartnerSlotSchema = z.object({
  slot: racebookPartnerSlotKeySchema,
  mode: racebookPartnerSlotModeSchema,
  partner: z.object({
    sponsorId: z.string().uuid(),
    name: z.string(),
    logoUrl: z.string().url(),
    destinationUrl: z.string().url().nullable(),
    headline: z.string().nullable(),
  }).nullable(),
});
export type RacebookPublishedPartnerSlot = z.infer<typeof racebookPublishedPartnerSlotSchema>;

type SponsorPresentation = { id: string; name: string; logo_url: string; website_url: string | null };

/**
 * Builds the snapshot slots from draft rows. Without the effective sponsors
 * module (Signature), every slot stays on its affiliate default.
 */
export function buildPublishedPartnerSlots(
  rows: readonly RacebookPartnerSlotRow[],
  sponsors: readonly SponsorPresentation[],
  sponsorsModuleEnabled: boolean,
): RacebookPublishedPartnerSlot[] {
  if (!sponsorsModuleEnabled) return [];
  const sponsorsById = new Map(sponsors.map((sponsor) => [sponsor.id, sponsor]));
  return RACEBOOK_PARTNER_SLOT_KEYS.flatMap((slot): RacebookPublishedPartnerSlot[] => {
    const row = rows.find((candidate) => candidate.slot_key === slot);
    if (!row || row.mode === "affiliate") return [];
    if (row.mode === "hidden") return [{ slot, mode: "hidden" as const, partner: null }];
    const sponsor = row.sponsor_id ? sponsorsById.get(row.sponsor_id) : undefined;
    if (!sponsor) return [];
    return [{
      slot,
      mode: "partner" as const,
      partner: {
        sponsorId: sponsor.id,
        name: sponsor.name,
        logoUrl: sponsor.logo_url,
        destinationUrl: sponsor.website_url,
        headline: row.headline,
      },
    }];
  });
}

export type RacebookRunnerPartnerSlot =
  | { mode: "affiliate" }
  | { mode: "hidden" }
  | { mode: "partner"; name: string; logoUrl: string; headline: string | null; clickUrl: string | null };

/** Runner payload: the destination URL is replaced by a counted redirect. */
export function toRunnerPartnerSlots(
  slots: readonly RacebookPublishedPartnerSlot[],
  sponsorsModuleEnabled: boolean,
  clickUrl: (slot: RacebookPartnerSlotKey) => string,
): Record<RacebookPartnerSlotKey, RacebookRunnerPartnerSlot> {
  return Object.fromEntries(RACEBOOK_PARTNER_SLOT_KEYS.map((slot) => {
    const published = sponsorsModuleEnabled ? slots.find((candidate) => candidate.slot === slot) : undefined;
    if (!published) return [slot, { mode: "affiliate" }];
    if (published.mode === "hidden") return [slot, { mode: "hidden" }];
    if (published.mode === "partner" && published.partner) {
      return [slot, {
        mode: "partner",
        name: published.partner.name,
        logoUrl: published.partner.logoUrl,
        headline: published.partner.headline,
        clickUrl: published.partner.destinationUrl ? clickUrl(slot) : null,
      }];
    }
    return [slot, { mode: "affiliate" }];
  })) as Record<RacebookPartnerSlotKey, RacebookRunnerPartnerSlot>;
}

/** Slots that will still show a Pace Yourself affiliate link once published. */
export function listAffiliatePartnerSlots(slots: readonly RacebookPublishedPartnerSlot[]) {
  return RACEBOOK_PARTNER_SLOT_KEYS
    .filter((slot) => !slots.some((candidate) => candidate.slot === slot))
    .map((slot) => ({ slot, label: RACEBOOK_PARTNER_SLOTS[slot].label, partner: RACEBOOK_PARTNER_SLOTS[slot].affiliatePartner }));
}

export const toOrganizerPartnerSlots = (rows: readonly RacebookPartnerSlotRow[]) =>
  RACEBOOK_PARTNER_SLOT_KEYS.map((slot) => {
    const row = rows.find((candidate) => candidate.slot_key === slot);
    return {
      slot,
      label: RACEBOOK_PARTNER_SLOTS[slot].label,
      affiliatePartner: RACEBOOK_PARTNER_SLOTS[slot].affiliatePartner,
      mode: row?.mode ?? "affiliate",
      sponsorId: row?.sponsor_id ?? null,
      headline: row?.headline ?? null,
      impressionCount: row?.impression_count ?? 0,
      clickCount: row?.click_count ?? 0,
    };
  });
