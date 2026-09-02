import PostHog from 'posthog-react-native';

const POSTHOG_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() ||
  process.env.EXPO_PUBLIC_POSTHOG_TOKEN?.trim() ||
  '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() ?? 'https://us.i.posthog.com';

type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | AnalyticsValue[]
  | { [key: string]: AnalyticsValue };
type AnalyticsPropertiesInput = Record<string, AnalyticsValue | undefined>;

const MOBILE_UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

function removeUndefinedProperties(properties?: AnalyticsPropertiesInput) {
  if (!properties) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, AnalyticsValue>;
}

export const isPostHogEnabled = POSTHOG_KEY.length > 0;

export const posthog = new PostHog(POSTHOG_KEY || 'posthog_disabled', {
  host: POSTHOG_HOST,
  disabled: !isPostHogEnabled,
  captureAppLifecycleEvents: true,
  defaultOptIn: true,
  sendFeatureFlagEvent: false,
});

export function buildAnalyticsScreenName(segments: string[]) {
  const cleanedSegments = segments.filter(
    (segment) =>
      Boolean(segment) &&
      !(segment.startsWith('(') && segment.endsWith(')')),
  );

  return cleanedSegments.length > 0 ? cleanedSegments.join('/') : 'root';
}

export function buildAnalyticsScreenGroup(screenName: string) {
  if (screenName === 'root') return 'root';
  if (screenName.startsWith('onboarding')) return 'onboarding';
  if (screenName.startsWith('catalog') || screenName.startsWith('race')) return 'courses';
  if (screenName.startsWith('plan') || screenName.startsWith('nutrition')) return 'plan';
  if (screenName.startsWith('live')) return 'live';
  if (screenName.startsWith('profile') || screenName.startsWith('settings')) return 'account';
  if (screenName.startsWith('login') || screenName.startsWith('signup') || screenName.startsWith('auth')) return 'auth';
  return 'other';
}

export function buildMobileAcquisitionProperties(url: string | null | undefined) {
  if (!url) return { deep_link_channel: 'unknown' };

  try {
    const parsed = new URL(url);
    const utm = Object.fromEntries(
      MOBILE_UTM_KEYS.flatMap((key) => {
        const value = parsed.searchParams.get(key)?.trim().slice(0, 200);
        return value ? [[key, value]] : [];
      }),
    );
    const hasCampaign = Object.keys(utm).length > 0;

    return {
      ...utm,
      deep_link_channel: hasCampaign ? 'campaign' : 'deep_link',
      deep_link_scheme: parsed.protocol.replace(':', '').slice(0, 40),
      deep_link_host: parsed.hostname.toLowerCase().replace(/^www\./, '').slice(0, 200) || undefined,
    };
  } catch {
    return { deep_link_channel: 'invalid' };
  }
}

export function captureAnalyticsEvent(
  eventName: string,
  properties?: AnalyticsPropertiesInput,
) {
  if (!isPostHogEnabled) {
    return;
  }

  posthog.capture(eventName, removeUndefinedProperties({ ...properties, surface: 'app' }));
}

export function identifyAnalyticsUser(
  distinctId: string,
  properties?: AnalyticsPropertiesInput,
) {
  if (!isPostHogEnabled) {
    return;
  }

  posthog.identify(distinctId, removeUndefinedProperties(properties));
}

export function resetAnalytics() {
  if (!isPostHogEnabled) {
    return;
  }

  posthog.reset();
}

export function trackAnalyticsScreen(
  screenName: string,
  properties?: AnalyticsPropertiesInput,
) {
  if (!isPostHogEnabled) {
    return;
  }

  posthog.screen(screenName, removeUndefinedProperties({
    ...properties,
    screen_group: buildAnalyticsScreenGroup(screenName),
    surface: 'app',
  }));
}
