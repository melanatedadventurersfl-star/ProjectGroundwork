export function getFriendlyAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('network request failed')
    || normalized.includes('failed to fetch')
    || normalized.includes('fetch failed')
    || normalized.includes('unknownhost')
    || normalized.includes('521')
  ) {
    return 'We could not connect right now. Check your internet connection and try again.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'This email still needs to be confirmed before you can sign in.';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'That email or password does not match our records.';
  }

  if (normalized.includes('user already registered')) {
    return 'An account already exists for this email. Try signing in instead.';
  }

  return message || fallback;
}
