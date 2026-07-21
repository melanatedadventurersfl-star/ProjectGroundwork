export type EventStaffRole = 'lead' | 'check_in' | 'safety' | 'transport' | 'food' | 'activity' | 'general';
export type CheckInMethod = 'qr' | 'manual' | 'offline_sync';
export type IncidentSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'monitoring' | 'resolved' | 'escalated';

export type RosterEntry = {
  adventure_id: string;
  attendee_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  ticket_type_id: string;
  ticket_type_name: string;
  credential_code: string | null;
  checked_in_at: string | null;
  check_in_method: CheckInMethod | null;
};

export type ScheduleItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
};

export type HeadcountRecord = {
  id: string;
  label: string;
  expected_count: number | null;
  actual_count: number;
  recorded_at: string;
  notes: string | null;
};

export type IncidentRecord = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurred_at: string;
  location: string | null;
  description: string;
};