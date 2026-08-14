import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { clearOfflineHttpCache, offlineFirstFetch } from '../offline/offlineFetch';

export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  global: {
    fetch: offlineFirstFetch,
  },
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') void clearOfflineHttpCache();
});
