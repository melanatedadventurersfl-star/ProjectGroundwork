export type ReleaseNotes = {
  id: string;
  title: string;
  intro: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-08-19-build-status-fingerprint-v1',
  title: "What's New",
  intro: 'It is now much easier to tell exactly which Melanated build is running on your device.',
  items: [
    'Admin Build Status now shows the installed app version, native build number, source commit, build timestamp, profile, update channel, runtime, and update ID.',
    'The Build Status screen can check the live update channel and clearly report Latest Build, Update Available, or Check Failed.',
    'When an update is available, admins can download it and restart directly from Build Status.',
    'The Admin Profile now carries a compact running-build fingerprint so screenshots immediately identify the code version being viewed.',
    'Outpost continues to prioritize Trailmates, joined groups, relevant community activity, and audience-aware posts in For You.',
  ],
};
