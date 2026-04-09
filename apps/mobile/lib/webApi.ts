const normalizeBaseUrl = (value: string | undefined) => {
  const trimmed = value?.trim() ?? '';
  return trimmed.replace(/\/+$/, '');
};

const DEFAULT_WEB_BASE_URL = 'https://pace-yourself.com';

export const WEB_API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_WEB_URL ?? DEFAULT_WEB_BASE_URL,
);
