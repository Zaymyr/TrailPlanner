"use client";

import { inject } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Initialize Vercel Web Analytics on the client side
inject();

export function Analytics() {
  return <SpeedInsights />;
}
