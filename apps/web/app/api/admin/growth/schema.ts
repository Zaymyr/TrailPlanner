import { z } from "zod";

export const growthRangeSchema = z.enum(["today", "yesterday", "last7", "last30", "custom"]);

const analyticsStatusSchema = z.enum(["available", "not_configured", "error"]);
const nullableMetricSchema = z.number().nullable();
const funnelRowSchema = z.object({
  step: z.string(),
  count: nullableMetricSchema,
  conversionFromPrevious: nullableMetricSchema,
});
const retentionSchema = z.object({
  eligible: nullableMetricSchema,
  returned: nullableMetricSchema,
  rate: nullableMetricSchema,
});
const trendPointSchema = z.object({
  date: z.string(),
  newAccounts: z.number(),
  activatedUsers: z.number(),
  activePlanUsers: z.number(),
  newPlans: z.number(),
  webVisitors: nullableMetricSchema,
  webPlansGenerated: nullableMetricSchema,
  appActiveUsers: nullableMetricSchema,
  appPlanCreators: nullableMetricSchema,
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
  web: z.object({
    status: analyticsStatusSchema,
    uniqueVisitors: nullableMetricSchema,
    onboardingStarted: nullableMetricSchema,
    plansGenerated: nullableMetricSchema,
    signupsCompleted: nullableMetricSchema,
    appDownloadClicks: nullableMetricSchema,
    funnel: z.array(funnelRowSchema),
  }),
  app: z.object({
    status: analyticsStatusSchema,
    newUsers: nullableMetricSchema,
    activeUsers: nullableMetricSchema,
    onboardingCompleted: nullableMetricSchema,
    planCreatedUsers: nullableMetricSchema,
    planSavedUsers: nullableMetricSchema,
    planSharedUsers: nullableMetricSchema,
    retention: z.object({
      j1: retentionSchema,
      j7: retentionSchema,
      j30: retentionSchema,
    }),
  }),
  organizers: z.object({
    analyticsStatus: analyticsStatusSchema,
    landingVisitors: nullableMetricSchema,
    ctaVisitors: nullableMetricSchema,
    dashboardVisitors: nullableMetricSchema,
    newOrganizers: z.number(),
    organizersWithContentChanges: z.number(),
    returningOrganizers: z.number(),
    eventsCreated: z.number(),
    editionsCreated: z.number(),
    formatsCreated: z.number(),
    publishedRacebooks: z.number(),
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
