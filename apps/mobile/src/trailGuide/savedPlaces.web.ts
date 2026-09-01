const keyForUser = (userId: string) => `go_melanated_saved_places:${userId}`;

function readIds(userId: string) {
  if (typeof localStorage === 'undefined') return [] as string[];
  try {
    const parsed = JSON.parse(localStorage.getItem(keyForUser(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(userId: string, ids: string[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(keyForUser(userId), JSON.stringify(ids));
}

export function isTrailGuidePlaceSaved(userId: string, placeId: string) {
  return readIds(userId).includes(placeId);
}

export function setTrailGuidePlaceSaved(userId: string, placeId: string, shouldSave: boolean) {
  const ids = readIds(userId).filter((id) => id !== placeId);
  if (shouldSave) ids.unshift(placeId);
  writeIds(userId, ids);
}

export function getSavedTrailGuidePlaceIds(userId: string) {
  return readIds(userId);
}
