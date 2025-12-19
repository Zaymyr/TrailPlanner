import { z } from "zod";

export const fuelProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string().optional(),
  name: z.string(),
  productUrl: z.string().url().optional().nullable(),
  caloriesKcal: z.number(),
  carbsGrams: z.number(),
  sodiumMg: z.number(),
  proteinGrams: z.number(),
  fatGrams: z.number(),
});

export type FuelProduct = z.infer<typeof fuelProductSchema>;
