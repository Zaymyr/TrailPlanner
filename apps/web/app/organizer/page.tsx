import { OrganizerDashboard } from "./_components/OrganizerDashboard";

type OrganizerDashboardPageProps = {
  searchParams?: {
    eventId?: string | string[];
    importUrl?: string | string[];
  };
};

const firstSearchParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export default function OrganizerDashboardPage({ searchParams }: OrganizerDashboardPageProps) {
  return (
    <OrganizerDashboard
      requestedEventId={firstSearchParam(searchParams?.eventId)}
      requestedImportUrl={firstSearchParam(searchParams?.importUrl)}
    />
  );
}
