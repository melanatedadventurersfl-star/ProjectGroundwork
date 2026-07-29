const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  supabaseUrl: requirePublicEnv('EXPO_PUBLIC_SUPABASE_URL', supabaseUrl),
  supabasePublishableKey: requirePublicEnv(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    supabasePublishableKey,
  ),
} as const;
