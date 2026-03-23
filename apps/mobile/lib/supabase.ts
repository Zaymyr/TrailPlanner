import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem(key: string): string | null {
    return SecureStore.getItem(key);
  },
  setItem(key: string, value: string): void {
    SecureStore.setItem(key, value);
  },
  removeItem(key: string): void {
    SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let supabaseInitError: string | null = null;
let supabase: any = null;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} catch(e: any) {
  supabaseInitError = e.message;
  console.error('Supabase init failed:', e.message);
}

export { supabase, supabaseInitError };
