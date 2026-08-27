export type ReleaseNotes = {
  id: string;
  title: string;
  intro: string;
  items: string[];
};

function readItems(raw?: string) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

const generatedItems = readItems(process.env.EXPO_PUBLIC_RELEASE_NOTES_ITEMS);

export const currentReleaseNotes: ReleaseNotes = {
  id: process.env.EXPO_PUBLIC_RELEASE_NOTES_ID || '2026-08-27-latest-mobile-wave',
  title: process.env.EXPO_PUBLIC_RELEASE_NOTES_TITLE || "What's New",
  intro: process.env.EXPO_PUBLIC_RELEASE_NOTES_INTRO || 'The latest Go Melanated update includes new ways to discover, connect, plan, and keep the app current.',
  items: generatedItems || [
    'Ask Go has been rebuilt as a more conversational outdoor guide with stronger recommendations, better fallback results, and a premium adventure-planning experience.',
    'Outpost now uses a more useful personalized digest, with richer community activity, upcoming Outings, and a restored modern Communities experience.',
    'Member-led Outings can now be edited after creation, including details and outing photos.',
    'Update handling is more resilient when a downloaded OTA bundle gets stuck on an older cached version.',
    'Performance, dependency security, linting, and app reliability received another round of cleanup and hardening.',
  ],
};
