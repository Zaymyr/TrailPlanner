import { z } from "zod";

export const growthRangeSchema = z.enum(["today", "yesterday", "last7", "last30", "custom"]);

export const adminGrowthResponseSchema = z.object({
  range: z.object({
    key: growthRangeSchema,
    start: z.string(),
    end: z.string(),
  }),
  kpis: z.object({
    newAnonymousUsers: z.number(),
    newRegisteredAccounts: z.number(),
    newPlansCreated: z.number(),
    newPlansCompletedOrSaved: z.number(),
    conversionAnonymousToAccount: z.number(),
    conversionAccountToPlanCreated: z.number(),
    conversionPlanCreatedToSavedOrCompleted: z.number(),
    returningUsersJ1: z.number().nullable(),
    returningUsersJ7: z.number().nullable(),
    profilesWithDetails: z.number(),
    usersWithFavoriteProduct: z.number(),
  }),
  funnel: z.array(z.object({ step: z.string(), count: z.number(), conversionFromPrevious: z.number().nullable() })),
  bySource: z.array(z.object({ source: z.string(), campaign: z.string(), users: z.number(), accounts: z.number(), plansCreated: z.number() })),
  todos: z.array(z.string()),
});

export type AdminGrowthResponse = z.infer<typeof adminGrowthResponseSchema>;
