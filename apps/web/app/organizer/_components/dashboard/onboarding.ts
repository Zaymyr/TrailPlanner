export const shouldOpenOrganizerOnboarding = ({
  isAdmin,
  status,
  hasCompletion,
  loadedEventId,
  selectedEventId,
  membershipEventId,
  completedAt,
}: {
  isAdmin: boolean;
  status: "idle" | "loading" | "saving" | "uploading";
  hasCompletion: boolean;
  loadedEventId: string | null;
  selectedEventId: string | null;
  membershipEventId: string | null;
  completedAt: string | null;
}) => Boolean(
  !isAdmin
  && status === "idle"
  && hasCompletion
  && loadedEventId
  && loadedEventId === selectedEventId
  && membershipEventId === selectedEventId
  && completedAt === null
);
