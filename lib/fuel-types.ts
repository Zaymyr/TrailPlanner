import { z } from "zod";

export const fuelTypeValues = [
  "gel",
  "drink_mix",
  "electrolyte",
  "capsule",
  "bar",
  "real_food",
  "other",
] as const;

export const fuelTypeSchema = z.enum(fuelTypeValues);

export type FuelType = z.infer<typeof fuelTypeSchema>;

export const defaultFuelType: FuelType = "other";
