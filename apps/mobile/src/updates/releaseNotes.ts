export type ReleaseAudience = 'all' | 'member' | 'host' | 'admin';

export type ReleaseFeature = {
  id: string;
  title: string;
  body: string;
  audience?: ReleaseAudience[];
  ctaLabel?: string;
  href?: string;
};

export type ReleaseNotes = {
  id: string;
  title: string;
  subtitle: string;
  intro: string;
  dateLabel?: string;
  versionLabel?: string;
  features: ReleaseFeature[];
  footer?: string;
};

function isReleaseFeature(value: unknown): value is ReleaseFeature {
  if (!value || typeof value !== 'object') return false;
  const feature = value as Partial<ReleaseFeature>;
  return (
    typeof feature.id === 'string' &&
    typeof feature.title === 'string' &&
    typeof feature.body === 'string'
  );
}

function readManifest(raw?: string): ReleaseNotes | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReleaseNotes>;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.title !== 'string' ||
      typeof parsed.subtitle !== 'string' ||
      typeof parsed.intro !== 'string' ||
      !Array.isArray(parsed.features) ||
      !parsed.features.every(isReleaseFeature)
    ) return null;
    return parsed as ReleaseNotes;
  } catch {
    return null;
  }
}

const fallbackRelease: ReleaseNotes = {
  id: '2026-08-27-member-experience-wave',
  title: "What's New",
  subtitle: 'Smarter planning. A livelier community.',
  intro: 'Here are the biggest improvements now available in Go Melanated.',
  dateLabel: 'August 2026',
  features: [
    {
      id: 'ask-go',
      title: 'Ask Go got smarter',
      body: 'Have a real conversation, refine what you want, and get stronger nearby adventure recommendations and lightweight day plans.',
      ctaLabel: 'Try Ask Go',
      href: '/trail-guide/ask',
    },
    {
      id: 'outpost',
      title: 'Outpost feels more alive',
      body: 'Catch up on meaningful community activity, upcoming Outings, and the conversations that matter without digging through an endless feed.',
      ctaLabel: 'Open Outpost',
      href: '/(tabs)/community',
    },
    {
      id: 'communities',
      title: 'Communities are easier to discover',
      body: 'Official communities, joined groups, nearby options, and recent activity now have a clearer, richer home.',
      href: '/(tabs)/community',
    },
    {
      id: 'outings',
      title: 'Outings are easier to manage',
      body: 'Member-led Outings can now be edited after creation, including key details and outing photos.',
    },
    {
      id: 'updates',
      title: 'Updates are more reliable',
      body: 'Go Melanated now does a better job activating downloaded updates and recovering when a device tries to reopen an older cached version.',
    },
  ],
  footer: 'Plus smaller reliability, performance, and navigation improvements across the app.',
};

export const currentReleaseNotes =
  readManifest(process.env.EXPO_PUBLIC_RELEASE_MANIFEST) || fallbackRelease;
