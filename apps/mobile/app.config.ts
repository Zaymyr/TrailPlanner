import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  const androidGoogleServicesFile =
    process.env.GOOGLE_SERVICES_JSON?.trim() ??
    process.env.EXPO_ANDROID_GOOGLE_SERVICES_FILE?.trim();
  const iosGoogleServicesFile =
    process.env.GOOGLE_SERVICE_INFO_PLIST?.trim() ??
    process.env.EXPO_IOS_GOOGLE_SERVICES_FILE?.trim();
  const googleSigninPlugin: [string, any][] = googleIosUrlScheme
    ? [[
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: googleIosUrlScheme,
        },
      ]]
    : [];

  return {
    ...config,
    name: 'Pace Yourself',
    slug: 'pace-yourself-app',
    owner: 'pace-yourself',
    scheme: 'paceyourself',
    version: '1.1.0',
    updates: {
      url: 'https://u.expo.dev/c713a8a0-cd94-4f6e-9468-063c9c20da6c',
    },
    // CNG / prebuild with EAS Update still uses a manual runtimeVersion string here.
    // Keep this aligned with the runtime shipped in the current store build so OTA updates
    // continue to reach installed binaries until a new native build is released.
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
      'expo-secure-store',
      [
        'expo-notifications',
        {
          color: '#22c55e',
        },
      ],
      ...googleSigninPlugin,
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
