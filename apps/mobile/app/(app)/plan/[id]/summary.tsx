import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyPlanSummaryRoute() {
  const { id, share } = useLocalSearchParams<{ id: string; share?: string }>();

  return (
    <Redirect
      href={{
        pathname: '/(app)/plan/[id]/edit',
        params: { id, tab: 'recap', ...(share ? { share } : {}) },
      }}
    />
  );
}
