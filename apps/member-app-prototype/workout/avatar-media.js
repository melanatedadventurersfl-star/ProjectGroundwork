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
  rows: 4,
  exercises: {
    'db-bench': {spriteUrl:'./assets/avatar-library/batch-01.webp',column:0,columns:5},
    'one-arm-row': {spriteUrl:'./assets/avatar-library/batch-01.webp',column:1,columns:5},
    'db-shoulder-press': {spriteUrl:'./assets/avatar-library/batch-01.webp',column:2,columns:5},
    'lat-pulldown': {spriteUrl:'./assets/avatar-library/batch-01.webp',column:3,columns:5},
    'lateral-raise': {spriteUrl:'./assets/avatar-library/batch-01.webp',column:4,columns:5},
    'biceps-curl': {spriteUrl:'./assets/avatar-library/batch-02.webp',column:0,columns:5},
    'triceps-pushdown': {spriteUrl:'./assets/avatar-library/batch-02.webp',column:1,columns:5},
    'goblet-squat': {spriteUrl:'./assets/avatar-library/batch-02.webp',column:2,columns:5},
    'leg-press': {spriteUrl:'./assets/avatar-library/batch-02.webp',column:3,columns:5},
    'romanian-deadlift': {spriteUrl:'./assets/avatar-library/batch-02.webp',column:4,columns:5}
  },
  avatars: {
    'masc-athletic': 0,
    'masc-full': 1,
    'fem-athletic': 2,
    'fem-full': 3
  },
  review: {
    status: 'approved-for-library',
    coverage: '10 exercises x 4 avatars',
    scope: 'Thumbnail use only. Active exercise demonstrations continue to use the existing direct exercise media until higher-resolution avatar position pairs are reviewed.',
    branding: 'Unbranded clothing and footwear only.'
  }
};
