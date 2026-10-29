function toValidTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Returns true only when an official revision is valid and newer than the last explicit review. */
export function isPlanSourceRevisionPending(
  currentRevision: string | null | undefined,
  reviewedRevision: string | null | undefined,
) {
  const currentTimestamp = toValidTimestamp(currentRevision);
  if (currentTimestamp === null) return false;

  const reviewedTimestamp = toValidTimestamp(reviewedRevision);
  return reviewedTimestamp === null || currentTimestamp > reviewedTimestamp;
}
