export type NotificationKind =
  | 'readiness'
  | 'announcement'
  | 'emergency'
  | 'registration'
  | 'payment'
  | 'community'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export type MemberNotification = {
  id: string;
  adventure_id: string | null;
  kind: NotificationKind;
  priority: NotificationPriority;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};