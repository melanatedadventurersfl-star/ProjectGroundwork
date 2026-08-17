export type ReleaseNotes = {
  id: string;
  title: string;
  intro: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-08-17-whats-new-v1',
  title: "What's New",
  intro: 'A few fresh trail markers just landed.',
  items: [
    'New Explorer shoreline backgrounds that respond to time and weather.',
    'A cleaner Trailhead layout with improved adventure hierarchy.',
    "A new What's New message so future updates explain themselves when they arrive.",
    'Stability fixes for the Trailhead image and update pipeline.',
  ],
};
