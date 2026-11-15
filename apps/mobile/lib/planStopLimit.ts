export function isPauseOverOrganizerLimit(
  pauseMinutes: number | null | undefined,
  maxStopMinutes: number | null | undefined,
) {
  return typeof pauseMinutes === 'number'
    && Number.isFinite(pauseMinutes)
    && typeof maxStopMinutes === 'number'
    && Number.isFinite(maxStopMinutes)
    && maxStopMinutes > 0
    && pauseMinutes > maxStopMinutes;
}
