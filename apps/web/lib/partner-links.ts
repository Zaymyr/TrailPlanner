import { z } from "zod";

export const partnerKeySchema = z.enum(["booking", "decathlon"]);
export type PartnerKey = z.infer<typeof partnerKeySchema>;

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"), "Use an HTTPS URL.");

export const partnerLinkSettingSchema = z.object({
  partnerKey: partnerKeySchema,
  standardUrl: httpsUrlSchema,
  affiliateUrl: httpsUrlSchema.nullable(),
  affiliateEnabled: z.boolean(),
  isEnabled: z.boolean(),
  updatedAt: z.string(),
});

export const partnerLinkSettingsResponseSchema = z.object({
  settings: z.array(partnerLinkSettingSchema).length(2),
});

export const partnerLinkSettingsUpdateSchema = z.object({
  settings: z.array(
    z.object({
      partnerKey: partnerKeySchema,
      standardUrl: httpsUrlSchema,
      affiliateUrl: z.union([httpsUrlSchema, z.literal(""), z.null()]).transform((value) => value || null),
      affiliateEnabled: z.boolean(),
      isEnabled: z.boolean(),
    }).superRefine((setting, context) => {
      if (setting.affiliateEnabled && !setting.affiliateUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["affiliateUrl"],
          message: "An affiliate URL is required when affiliate mode is enabled.",
        });
      }
    })
  ).length(2),
}).superRefine(({ settings }, context) => {
  const keys = new Set(settings.map((setting) => setting.partnerKey));
  if (keys.size !== partnerKeySchema.options.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["settings"],
      message: "Booking and Decathlon settings are both required.",
    });
  }
});

export type PartnerLinkSetting = z.infer<typeof partnerLinkSettingSchema>;

export const resolvedPartnerLinkSchema = z.object({
  partnerKey: partnerKeySchema,
  url: httpsUrlSchema,
  isAffiliate: z.boolean(),
});

export const resolvedPartnerLinksResponseSchema = z.object({
  links: z.array(resolvedPartnerLinkSchema),
});

export type ResolvedPartnerLink = z.infer<typeof resolvedPartnerLinkSchema>;

export function resolvePartnerLinkUrl(setting: PartnerLinkSetting) {
  if (!setting.isEnabled) return null;
  return setting.affiliateEnabled && setting.affiliateUrl
    ? setting.affiliateUrl
    : setting.standardUrl;
}

export function resolvePublicPartnerLink(setting: PartnerLinkSetting): ResolvedPartnerLink | null {
  const url = resolvePartnerLinkUrl(setting);
  if (!url) return null;

  return {
    partnerKey: setting.partnerKey,
    url,
    isAffiliate: setting.affiliateEnabled && Boolean(setting.affiliateUrl),
  };
}
