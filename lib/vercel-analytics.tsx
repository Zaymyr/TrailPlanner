"use client";

import type { ReactElement } from "react";

/**
 * Lightweight stub to avoid bundling @vercel/analytics in environments
 * where the package is unavailable.
 */
export function inject(): void {
  // Intentionally empty
}

export function Analytics(): ReactElement | null {
  return null;
}
