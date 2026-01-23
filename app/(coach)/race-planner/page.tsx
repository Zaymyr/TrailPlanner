import { Suspense } from "react";
import { RacePlannerPageContent } from "./RacePlannerPageContent";

export default function RacePlannerPage() {
  return (
    <Suspense fallback={null}>
      <RacePlannerPageContent />
    </Suspense>
  );
}
