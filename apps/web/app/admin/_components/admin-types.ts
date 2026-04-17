import { z } from "zod";

import { fuelTypeValues } from "../../../lib/fuel-types";

export const adminProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string().optional(),
  name: z.string(),
  brand: z.string().optional(),
  productUrl: z.string().optional(),
  isLive: z.boolean(),
  isArchived: z.boolean(),
  updatedAt: z.string(),
  fuelType: z.string().optional(),
  caloriesKcal: z.number().nonnegative().optional(),
  carbsGrams: z.number().nonnegative().optional(),
  sodiumMg: z.number().nonnegative().optional(),
  proteinGrams: z.number().nonnegative().optional(),
  fatGrams: z.number().nonnegative().optional(),
});

export const adminProductImportItemSchema = z.object({
  name: z.string().trim().min(1),
  brand: z.string().trim().min(1).optional().nullable(),
  slug: z.string().trim().min(1).optional(),
  sku: z.string().trim().min(1).optional(),
  imageUrl: z.string().url().optional().nullable(),
  productUrl: z.string().url().optional().nullable(),
  fuelType: z.enum(fuelTypeValues).optional(),
  caloriesKcal: z.coerce.number().nonnegative().optional(),
  carbsGrams: z.coerce.number().nonnegative().optional(),
  sodiumMg: z.coerce.number().nonnegative().optional(),
  proteinGrams: z.coerce.number().nonnegative().optional(),
  fatGrams: z.coerce.number().nonnegative().optional(),
  isLive: z.boolean().optional(),
});

export const adminProductImportRequestSchema = z.union([
  z.array(adminProductImportItemSchema).min(1),
  z.object({
    products: z.array(adminProductImportItemSchema).min(1),
    archiveSharedCatalog: z.boolean().optional(),
  }),
]);

export const adminProductImportResponseSchema = z.object({
  archivedSharedCatalog: z.boolean(),
  importedCount: z.number().int().nonnegative(),
});

export const editProductFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  sku: z.string().trim().optional(),
  productUrl: z.string().url().or(z.literal("")).optional(),
  fuelType: z.enum(fuelTypeValues),
  caloriesKcal: z.coerce.number().nonnegative(),
  carbsGrams: z.coerce.number().nonnegative(),
  sodiumMg: z.coerce.number().nonnegative(),
  proteinGrams: z.coerce.number().nonnegative(),
  fatGrams: z.coerce.number().nonnegative(),
});

export type EditProductFormValues = z.infer<typeof editProductFormSchema>;

export const adminUsersSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string().email().optional(),
      createdAt: z.string(),
      lastSignInAt: z.string().optional(),
      role: z.string().optional(),
      roles: z.array(z.string()).optional(),
      premiumGrant: z
        .object({
          id: z.string(),
          startsAt: z.string(),
          initialDurationDays: z.number(),
          remainingDurationDays: z.number(),
          reason: z.string(),
        })
        .nullable()
        .optional(),
      trial: z
        .object({
          endsAt: z.string(),
          remainingDays: z.number(),
        })
        .nullable()
        .optional(),
      subscription: z
        .object({
          status: z.string(),
          currentPeriodEnd: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    })
  ),
});

export const adminUserSchema = adminUsersSchema.shape.users.element;
export type AdminUser = z.infer<typeof adminUserSchema>;

export const premiumGrantResponseSchema = z.object({
  premiumGrant: z
    .object({
      id: z.string(),
      startsAt: z.string(),
      initialDurationDays: z.number(),
      remainingDurationDays: z.number(),
      reason: z.string(),
    })
    .nullable(),
});

export const adminAnalyticsSchema = z.object({
  totals: z.object({
    popupOpens: z.number(),
    clicks: z.number(),
  }),
  productStats: z.array(
    z.object({
      productId: z.string(),
      productName: z.string().optional(),
      popupOpens: z.number(),
      clicks: z.number(),
    })
  ),
  recentEvents: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      productName: z.string().optional(),
      eventType: z.enum(["popup_open", "click"]),
      countryCode: z.string().optional(),
      merchant: z.string().optional(),
      occurredAt: z.string(),
    })
  ),
});

export const userRoleOptions = ["user", "coach", "admin"] as const;
export type UserRoleOption = (typeof userRoleOptions)[number];

export const basePillClass = "rounded-full px-3 py-1 text-xs font-semibold";

export const premiumGrantFormSchema = z.object({
  startsAt: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date"),
  initialDurationDays: z.coerce.number().int().positive(),
  reason: z.string().min(1),
});

export type PremiumGrantFormValues = z.infer<typeof premiumGrantFormSchema>;

export const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const formatDuration = (days?: number) => {
  if (days === undefined || Number.isNaN(days)) return "—";
  return `${days}d`;
};

export const formatStatus = (value?: string) => {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};
