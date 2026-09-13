import type { AdventureDetail } from '../adventures/types';
import type { RosterEntry, ScheduleItem } from '../operations/types';

export type SafetyCheckInStatus = 'starting' | 'okay' | 'back' | 'need_help';
export type SafetySessionStatus = 'active' | 'completed' | 'cancelled';
export type OfflineActionKind = 'safety_session_start' | 'safety_session_update' | 'safety_check_in';
export type RosterSweepStatus = 'returned' | 'still_out' | 'left_early' | 'needs_follow_up';

export type GeoPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: string;
};

export type LocalSafetySession = {
  id: string;
  adventureId: string;
  profileId: string;
  status: SafetySessionStatus;
  startedAt: string;
  expectedReturnAt: string | null;
  endedAt: string | null;
  safePointLatitude: number | null;
  safePointLongitude: number | null;
  lastCheckIn: SafetyCheckInStatus | null;
  lastCheckInAt: string | null;
};

export type SafetyBreadcrumb = GeoPoint & {
  id: number;
  sessionId: string;
};

export type PendingOfflineAction = {
  id: string;
  kind: OfflineActionKind;
  payload: string;
  priority: number;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

export type OfflineAnnouncement = {
  id: string;
  title: string;
  body: string;
  priority: string;
  starts_at: string;
  expires_at: string | null;
};

export type OfflineEventPack = {
  version: 1;
  adventure: AdventureDetail;
  schedule: ScheduleItem[];
  announcements: OfflineAnnouncement[];
  roster: RosterEntry[];
  downloadedAt: string;
};

export type RosterSweepRecord = {
  adventureId: string;
  attendeeId: string;
  status: RosterSweepStatus;
  updatedAt: string;
};