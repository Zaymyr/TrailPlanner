import { z } from "zod";

export const adminGrowthResponseSchema = z.object({
  userRows: z.array(
    z.object({
      userId: z.string(),
      email: z.string().nullable(),
      createdAt: z.string(),
      lastSignInAt: z.string().nullable(),
      planCount: z.number(),
      hasProfile: z.boolean(),
      subscriptionStatus: z.string().nullable(),
      subscriptionPeriodEnd: z.string().nullable(),
      grantReason: z.string().nullable(),
      isAdmin: z.boolean(),
    })
  ),
  signupsByMonth: z.array(z.object({ month: z.string(), count: z.number() })),
  signupsByDay: z.array(z.object({ day: z.string(), count: z.number() })),
  totals: z.object({
    users: z.number(),
    usersWithPlan: z.number(),
    usersWithProfile: z.number(),
    activeSubscriptions: z.number(),
    premiumGrants: z.number(),
  }),
});

export type AdminGrowthResponse = z.infer<typeof adminGrowthResponseSchema>;
