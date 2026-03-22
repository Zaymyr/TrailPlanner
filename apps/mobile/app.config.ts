import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Pace Yourself',
  slug: 'pace-yourself',
  scheme: 'paceyourself',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
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
});
