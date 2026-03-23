import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/(app)/plans');
      else router.replace('/(auth)/login');
    });
  }, []);

  return null;
}
