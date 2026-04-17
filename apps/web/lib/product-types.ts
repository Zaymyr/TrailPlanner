import { z } from "zod";

import { defaultFuelType, fuelTypeSchema } from "./fuel-types";

export const fuelProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string().optional(),
  name: z.string(),
  brand: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  fuelType: fuelTypeSchema.default(defaultFuelType),
  productUrl: z.string().url().optional().nullable(),
  caloriesKcal: z.number(),
  carbsGrams: z.number(),
  sodiumMg: z.number(),
  proteinGrams: z.number(),
  fatGrams: z.number(),
  waterMl: z.number().optional(),
  createdBy: z.string().uuid().optional().nullable(),
});

export type FuelProduct = z.infer<typeof fuelProductSchema>;
