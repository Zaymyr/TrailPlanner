import { z } from "zod";

import { fuelProductSchema } from "./product-types";

export const userProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(150).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  waterBagLiters: z.number().min(0).max(20).optional().nullable(),
  favoriteProducts: z.array(fuelProductSchema).default([]),
});

export const profileResponseSchema = z.object({
  profile: userProfileSchema,
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(150).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  waterBagLiters: z.number().min(0).max(20).optional().nullable(),
  favoriteProductIds: z.array(z.string().uuid()).optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type ProfileUpdatePayload = z.infer<typeof profileUpdateSchema>;
