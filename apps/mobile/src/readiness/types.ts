export type ReadinessCategory =
  | 'registration'
  | 'waiver'
  | 'transportation'
  | 'meal'
  | 'packing'
  | 'emergency'
  | 'payment'
  | 'other';

export type ReadinessStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked' | 'waived';

export type AdventureQueueItem = {
  order_id: string;
  adventure_id: string;
  title: string;
  summary: string | null;
  starts_at: string;
  ends_at: string;
  city: string;
  state: string;
  venue_name: string | null;
  order_status: string;
  required_count: number;
  completed_required_count: number;
  blocker_count: number;
  readiness_score: number;
  next_due_at: string | null;
};

export type ReadinessItem = {
  id: string;
  order_id: string;
  adventure_id: string;
  category: ReadinessCategory;
  title: string;
  description: string | null;
  due_at: string | null;
  status: ReadinessStatus;
  is_required: boolean;
  blocks_check_in: boolean;
  completion_note: string | null;
};
