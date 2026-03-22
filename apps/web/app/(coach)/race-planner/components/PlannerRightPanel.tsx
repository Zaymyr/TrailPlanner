"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { PlanManager, type PlanManagerProps } from "../../../../components/race-planner/PlanManager";

type PlannerRightPanelProps = {
  planManagerProps: PlanManagerProps;
};

export function PlannerRightPanel({ planManagerProps }: PlannerRightPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{planManagerProps.copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PlanManager {...planManagerProps} />
        </CardContent>
      </Card>
    </div>
  );
}
