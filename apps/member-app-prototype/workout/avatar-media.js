/*
 * GoWorkout avatar-specific exercise media manifest.
 *
 * V1 keeps training logic separate from visual identity. Add only reviewed,
 * app-owned, unbranded exercise assets here. Each exercise may contain one or
 * more avatar variants. The app automatically falls back to the existing
 * approved exercise demonstration until a variant reaches status "approved".
 *
 * Asset convention:
 *   ./assets/exercises/<exercise-id>/<avatar-id>/position-1.webp
 *   ./assets/exercises/<exercise-id>/<avatar-id>/position-2.webp
 *
 * Avatar IDs:
 *   masc-athletic  Malik
 *   masc-full      Drew
 *   fem-athletic   Nia
 *   fem-full       Maya
 */
window.EXERCISE_AVATAR_MEDIA = {};

window.EXERCISE_AVATAR_LIBRARY = {
  version: 1,
  usage: 'library-thumbnail',
  spriteUrl: './assets/avatar-library/batch-01.webp',
  columns: 5,
  rows: 4,
  exercises: {
    'db-bench': 0,
    'one-arm-row': 1,
    'db-shoulder-press': 2,
    'lat-pulldown': 3,
    'lateral-raise': 4
  },
  avatars: {
    'masc-athletic': 0,
    'masc-full': 1,
    'fem-athletic': 2,
    'fem-full': 3
  },
  review: {
    status: 'approved-for-library',
    scope: 'Thumbnail use only. Active exercise demonstrations continue to use the existing direct exercise media until higher-resolution avatar position pairs are reviewed.',
    branding: 'Unbranded clothing and footwear only.'
  }
};
