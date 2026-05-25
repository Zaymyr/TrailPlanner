import { describe, expect, it } from "vitest";

import { adminUsersSchema } from "./admin-types";

describe("adminUsersSchema", () => {
  it("accepts admin users whose email field is present but not RFC-valid", () => {
    const parsed = adminUsersSchema.safeParse({
      users: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          email: "guest-user-123",
          createdAt: "2026-05-01T10:00:00.000Z",
          role: "user",
          roles: ["user"],
          premiumGrant: null,
          trial: null,
          subscription: null,
          insights: {
            signInCount: null,
            activityWindowDays: null,
            planCount: 0,
            latestPlanName: null,
            favoriteProducts: [],
            onboardingCompleted: false,
          },
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});
