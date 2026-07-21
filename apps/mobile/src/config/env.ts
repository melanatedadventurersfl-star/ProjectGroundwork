function requirePublicEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  supabaseUrl: requirePublicEnv('EXPO_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: requirePublicEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
} as const;
