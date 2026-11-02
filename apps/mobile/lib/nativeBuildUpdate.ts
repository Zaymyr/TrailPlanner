type NativeBuildUpdateConfig = {
  latestBuild?: unknown;
  updateUrl?: unknown;
};

type ExpoExtra = {
  nativeBuildUpdates?: {
    ios?: NativeBuildUpdateConfig;
  };
};

export type NativeBuildUpdateTarget = {
  latestBuild: number;
  updateUrl: string;
};

function parseBuildNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return /^https:\/\/[^\s]+$/i.test(normalized) ? normalized : null;
}

export function resolveIosNativeBuildUpdate({
  currentBuild,
  extra,
}: {
  currentBuild: unknown;
  extra: unknown;
}): NativeBuildUpdateTarget | null {
  const installedBuild = parseBuildNumber(currentBuild);
  if (installedBuild === null || !extra || typeof extra !== 'object') return null;

  const iosConfig = (extra as ExpoExtra).nativeBuildUpdates?.ios;
  const latestBuild = parseBuildNumber(iosConfig?.latestBuild);
  const updateUrl = parseHttpsUrl(iosConfig?.updateUrl);

  if (latestBuild === null || updateUrl === null || installedBuild >= latestBuild) return null;

  return { latestBuild, updateUrl };
}
