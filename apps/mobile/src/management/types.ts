import type { CampaignTaskStatus, HostCampaign } from '../hosting/campaigns';

export type ManagementSectionId =
  | 'home'
  | 'calendar'
  | 'my-work'
  | 'events'
  | 'opportunities'
  | 'marketing'
  | 'operations'
  | 'directories'
  | 'library'
  | 'team'
  | 'reports'
  | 'admin';

export type ManagementProfile = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  platformRole: string;
};

export type ManagementTask = {
  id: string;
  title: string;
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  category: string;
  owner: string;
  assigneeProfileId: string | null;
  dueLabel: string;
  dueAt: string | null;
  status: CampaignTaskStatus;
  priority: 'critical' | 'high' | 'normal';
  blockedBy?: string;
};

export type ManagementMarketingItem = {
  id: string;
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  title: string;
  contentType: string;
  platforms: string[];
  plannedFor: string;
  status: 'idea' | 'draft' | 'ready' | 'scheduled' | 'published' | 'skipped';
};

export type ManagementCalendarItem = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  kind: 'event' | 'marketing' | 'task' | 'deadline';
  accent: string;
  route?: string;
};

export type ManagementDashboardData = {
  profile: ManagementProfile;
  campaigns: HostCampaign[];
  tasks: ManagementTask[];
  marketing: ManagementMarketingItem[];
  calendar: ManagementCalendarItem[];
};
