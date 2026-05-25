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

export function captureAnalyticsEvent(
  eventName: string,
  properties?: AnalyticsPropertiesInput,
) {
  if (!isPostHogEnabled) {
    return;
  }

  posthog.capture(eventName, removeUndefinedProperties(properties));
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

  posthog.screen(screenName, removeUndefinedProperties(properties));
}
