import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleServicesFile =
    process.env.GOOGLE_SERVICES_JSON?.trim() ??
    process.env.EXPO_ANDROID_GOOGLE_SERVICES_FILE?.trim();
  const iosGoogleServicesFile =
    process.env.GOOGLE_SERVICE_INFO_PLIST?.trim() ??
    process.env.EXPO_IOS_GOOGLE_SERVICES_FILE?.trim();

  return {
    ...config,
    name: 'Pace Yourself',
    slug: 'pace-yourself-app',
    owner: 'pace-yourself',
    scheme: 'paceyourself',
    version: '1.1.1',
    updates: {
      url: 'https://u.expo.dev/c713a8a0-cd94-4f6e-9468-063c9c20da6c',
    },
    // Keep the shared/iOS runtime aligned with the current iOS store build. Android
    // overrides it below because the API 36 native build must not share OTA updates
    // with the previous Android runtime.
    runtimeVersion: '1.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.png',
      backgroundColor: '#f7efe8',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.paceyourself.app',
      ...(iosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesFile } : {}),
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleAllowMixedLocalizations: true,
        UIBackgroundModes: ['processing'],
      },
    },
    android: {
      runtimeVersion: '1.1.1',
      versionCode: 1,
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.paceyourself.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#f7efe8',
      },
      ...(androidGoogleServicesFile ? { googleServicesFile: androidGoogleServicesFile } : {}),
      package: 'com.paceyourself.app',
      blockedPermissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
      ],
    },
    plugins: [
      'expo-router',
      'expo-apple-authentication',
      'expo-background-task',
      'expo-localization',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#22c55e',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'c713a8a0-cd94-4f6e-9468-063c9c20da6c',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  };
};
