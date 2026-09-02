import { z } from "zod";

export const growthRangeSchema = z.enum(["today", "yesterday", "last7", "last30", "custom"]);

const funnelRowSchema = z.object({
  step: z.string(),
  count: z.number(),
  conversionFromPrevious: z.number().nullable(),
});
const trendPointSchema = z.object({
  date: z.string(),
  newAccounts: z.number(),
  activatedUsers: z.number(),
  activePlanUsers: z.number(),
  newPlans: z.number(),
});

export const adminGrowthResponseSchema = z.object({
  range: z.object({
    key: growthRangeSchema,
    start: z.string(),
    end: z.string(),
  }),
  overview: z.object({
    newAccounts: z.number(),
    activatedUsers: z.number(),
    activePlanUsers: z.number(),
    newPlans: z.number(),
    activePremiumUsers: z.number(),
  }),
  trend: z.array(trendPointSchema),
  organizers: z.object({
    newOrganizers: z.number(),
    activeOrganizers: z.number(),
    returningOrganizers: z.number(),
    eventsCreated: z.number(),
    editionsCreated: z.number(),
    formatsCreated: z.number(),
    publishedRacebooks: z.number(),
    activatedRacebooks: z.number(),
    giftedRacebooks: z.number(),
    paidRacebooks: z.number(),
    funnel: z.array(funnelRowSchema),
    followUps: z.array(z.object({
      eventId: z.string().uuid(),
      eventName: z.string(),
      organizerEmail: z.string(),
      lastActivityAt: z.string(),
      status: z.enum(["no_format", "incomplete", "ready_to_publish", "published"]),
      daysInactive: z.number(),
    })),
  }),
  actions: z.array(z.object({
    id: z.string(),
    audience: z.enum(["web", "app", "organizers"]),
    severity: z.enum(["info", "warning", "critical"]),
    title: z.string(),
    detail: z.string(),
  })),
});

export type AdminGrowthResponse = z.infer<typeof adminGrowthResponseSchema>;
