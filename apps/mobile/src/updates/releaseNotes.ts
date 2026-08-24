export type ReleaseNotes = {
  id: string;
  title: string;
  intro: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-08-24-community-and-trailhead-v1',
  title: "What's New",
  intro: 'A fresh round of Go Melanated improvements is ready. Here are the changes you can actually see and use.',
  items: [
    'Campfires used for meetups are now called Outings, making the difference between community conversation spaces and real-world plans clearer.',
    'Trailhead now focuses more closely on Your Next Adventure and upcoming Outings connected to your community and Trail Family.',
    'Outpost posting and discovery have been improved, including newer posts surfacing first and more useful feed filtering.',
    'Profiles, Trail Guide screens, and community surfaces received layout and readability improvements.',
    'Invites, reporting, blocking, permissions, support, attendance, and other member flows received reliability fixes and polish.',
  ],
};
