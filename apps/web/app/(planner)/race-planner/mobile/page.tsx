import { Suspense } from "react";
import { RacePlannerPageContent } from "../RacePlannerPageContent";

export default function RacePlannerMobilePage() {
  return (
    <Suspense fallback={null}>
      <RacePlannerPageContent enableMobileNav />
    </Suspense>
  );
}
