import { ExpoConfig, ConfigContext } from 'expo/config';
import { withAppBuildGradle } from '@expo/config-plugins';

// enableBundleCompression was removed from ReactExtension in React Native 0.76+
// This plugin removes it from the generated build.gradle to prevent build failures.
function withoutBundleCompression(c: ExpoConfig): ExpoConfig {
  return withAppBuildGradle(c, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /\s*enableBundleCompression\s*=\s*[^\n]*\n?/g,
      '\n'
    );
    return config;
  });
}

export default ({ config }: ConfigContext): ExpoConfig =>
  withoutBundleCompression({
  ...config,
  name: 'Pace Yourself',
  slug: 'pace-yourself-app',
  owner: 'pace-yourself',
  scheme: 'paceyourself',
  version: '1.0.0',
  updates: {
    url: 'https://u.expo.dev/c713a8a0-cd94-4f6e-9468-063c9c20da6c',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    backgroundColor: '#0f172a',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.paceyourself.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Pace Yourself uses your location to track race progress and trigger nutrition alerts based on distance.',
      UIBackgroundModes: ['location', 'fetch'],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    package: 'com.paceyourself.app',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        color: '#22c55e',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Pace Yourself uses your location to track race progress and trigger nutrition alerts based on distance.',
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "c713a8a0-cd94-4f6e-9468-063c9c20da6c"
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
