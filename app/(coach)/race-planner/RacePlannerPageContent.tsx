"use client";

import { RacePlannerShell } from "./RacePlannerShell";

export function RacePlannerPageContent({ enableMobileNav = true }: { enableMobileNav?: boolean }) {
  return <RacePlannerShell enableMobileNav={enableMobileNav} />;
}
