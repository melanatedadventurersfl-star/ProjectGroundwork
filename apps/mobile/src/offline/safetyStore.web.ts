import type {
  LocalSafetySession,
  OfflineEventPack,
  PendingOfflineAction,
  RosterSweepRecord,
  RosterSweepStatus,
  SafetyBreadcrumb,
} from './safetyTypes';

const KEYS = {
  eventPacks: 'ma.offlineSafety.eventPacks',
  sessions: 'ma.offlineSafety.sessions',
  breadcrumbs: 'ma.offlineSafety.breadcrumbs',
  queue: 'ma.offlineSafety.queue',
  rosterSweep: 'ma.offlineSafety.rosterSweep',
} as const;

function storage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function read<T>(key: string, fallback: T): T {
  const target = storage();
  if (!target) return fallback;
  const raw = target.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  storage()?.setItem(key, JSON.stringify(value));
}

function makeId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function saveEventPack(pack: OfflineEventPack) {
  const packs = read<Record<string, OfflineEventPack>>(KEYS.eventPacks, {});
  packs[pack.adventure.id] = pack;
  write(KEYS.eventPacks, packs);
}

export async function getEventPack(adventureId: string): Promise<OfflineEventPack | null> {
  return read<Record<string, OfflineEventPack>>(KEYS.eventPacks, {})[adventureId] ?? null;
}

export async function removeEventPack(adventureId: string) {
  const packs = read<Record<string, OfflineEventPack>>(KEYS.eventPacks, {});
  delete packs[adventureId];
  write(KEYS.eventPacks, packs);
}

export async function saveSafetySession(session: LocalSafetySession) {
  const sessions = read<Record<string, LocalSafetySession>>(KEYS.sessions, {});
  sessions[session.id] = session;
  write(KEYS.sessions, sessions);
}

export async function getActiveSafetySession(adventureId: string): Promise<LocalSafetySession | null> {
  const sessions = Object.values(read<Record<string, LocalSafetySession>>(KEYS.sessions, {}));
  return sessions
    .filter((session) => session.adventureId === adventureId && session.status === 'active')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
}

export async function updateLocalSafetySession(
  session: LocalSafetySession,
  patch: Partial<LocalSafetySession>,
) {
  const next = { ...session, ...patch };
  await saveSafetySession(next);
  return next;
}

export async function addBreadcrumb(input: {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt?: string;
}) {
  const all = read<SafetyBreadcrumb[]>(KEYS.breadcrumbs, []);
  const nextId = all.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  all.push({
    id: nextId,
    sessionId: input.sessionId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy ?? null,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  });
  write(KEYS.breadcrumbs, all);
}

export async function getBreadcrumbs(sessionId: string): Promise<SafetyBreadcrumb[]> {
  return read<SafetyBreadcrumb[]>(KEYS.breadcrumbs, []).filter((item) => item.sessionId === sessionId);
}

export async function queueOfflineAction(
  kind: PendingOfflineAction['kind'],
  payload: unknown,
  priority = 50,
) {
  const queue = read<PendingOfflineAction[]>(KEYS.queue, []);
  const id = makeId();
  queue.push({
    id,
    kind,
    payload: JSON.stringify(payload),
    priority,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  });
  write(KEYS.queue, queue);
  return id;
}

export async function listPendingOfflineActions(limit = 25): Promise<PendingOfflineAction[]> {
  return read<PendingOfflineAction[]>(KEYS.queue, [])
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
}

export async function completeOfflineAction(id: string) {
  write(KEYS.queue, read<PendingOfflineAction[]>(KEYS.queue, []).filter((item) => item.id !== id));
}

export async function failOfflineAction(id: string, error: string) {
  const queue = read<PendingOfflineAction[]>(KEYS.queue, []);
  const item = queue.find((entry) => entry.id === id);
  if (item) {
    item.attempts += 1;
    item.lastError = error.slice(0, 500);
    write(KEYS.queue, queue);
  }
}

export async function countPendingOfflineActions() {
  return read<PendingOfflineAction[]>(KEYS.queue, []).length;
}

export async function setRosterSweepStatus(
  adventureId: string,
  attendeeId: string,
  status: RosterSweepStatus,
) {
  const records = read<RosterSweepRecord[]>(KEYS.rosterSweep, []);
  const updatedAt = new Date().toISOString();
  const next: RosterSweepRecord = { adventureId, attendeeId, status, updatedAt };
  const index = records.findIndex((record) => record.adventureId === adventureId && record.attendeeId === attendeeId);
  if (index >= 0) records[index] = next;
  else records.push(next);
  write(KEYS.rosterSweep, records);
  return next;
}

export async function getRosterSweep(adventureId: string): Promise<RosterSweepRecord[]> {
  return read<RosterSweepRecord[]>(KEYS.rosterSweep, []).filter((record) => record.adventureId === adventureId);
}

export { makeId as createOfflineUuid };
