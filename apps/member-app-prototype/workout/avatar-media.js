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
