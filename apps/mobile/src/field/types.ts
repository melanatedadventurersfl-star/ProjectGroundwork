import type { HeadcountRecord, IncidentRecord, RosterEntry, ScheduleItem } from '../operations/types';
import type { OfflineHostMessage } from '../offline/safetyTypes';

export type HostFieldSnapshot = {
  adventureId: string;
  roster: RosterEntry[];
  schedule: ScheduleItem[];
  headcounts: HeadcountRecord[];
  incidents: IncidentRecord[];
  messages: OfflineHostMessage[];
  savedAt: string;
};

export type FieldSyncState = {
  synced: number;
  pending: number;
  lastError: string | null;
};
