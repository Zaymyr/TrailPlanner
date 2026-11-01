export function shouldSkipOtaUpdateCheck({
  isDevelopmentRuntime,
  updatesEnabled,
  appVariant,
}: {
  isDevelopmentRuntime: boolean;
  updatesEnabled: boolean;
  appVariant: unknown;
}): boolean {
  return isDevelopmentRuntime || !updatesEnabled || appVariant === 'development';
}

export function isUnsupportedDevelopmentUpdateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /checkForUpdateAsync.*not supported in development builds/i.test(message);
}
