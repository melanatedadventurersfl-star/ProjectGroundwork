import { Platform } from 'react-native';

import { supabase } from './supabase';

export async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>) {
  if (Platform.OS === 'web' && name !== 'web-edge-proxy') {
    return supabase.functions.invoke<T>('web-edge-proxy', {
      body: { target: name, body },
    });
  }

  return supabase.functions.invoke<T>(name, { body });
}
