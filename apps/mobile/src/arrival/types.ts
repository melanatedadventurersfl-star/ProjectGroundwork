import type { RosterEntry } from '../operations/types';

export type ArrivalScanMethod = 'qr' | 'manual';
export type ArrivalValidationStatus = 'valid' | 'already_checked_in' | 'wrong_event' | 'invalid_ticket';
export type ArrivalReconciliationStatus = 'pending' | 'valid' | 'duplicate' | 'failed';

export type LocalArrivalScan = {
  id: string;
  adventureId: string;
  attendeeId: string;
  attendeeName: string;
  method: ArrivalScanMethod;
  credentialCode: string | null;
  deviceId: string;
  scannedAt: string;
  reconciliationStatus: ArrivalReconciliationStatus;
  duplicateCount: number;
  lastError: string | null;
};

export type ArrivalValidation = {
  status: ArrivalValidationStatus;
  attendee: RosterEntry | null;
  otherAdventureId?: string | null;
};

export type ServerArrivalScan = {
  id: string;
  adventure_id: string;
  attendee_id: string;
  device_id: string;
  scan_method: ArrivalScanMethod;
  scanned_at: string;
  reconciliation_status: 'pending' | 'valid' | 'duplicate';
};
