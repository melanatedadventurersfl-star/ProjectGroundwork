import type { AppIconName } from '../ui/AppIcon';

export type HostWorkspaceItem = {
  key: string;
  title: string;
  subtitle: string;
  route: string;
  icon: AppIconName;
  accent: string;
};

export const HOST_WORKSPACE_ITEMS: HostWorkspaceItem[] = [
  { key: 'events', title: 'Events', subtitle: 'Build, prepare, run and close out events', route: '/host/events', icon: 'adventure', accent: '#D7B45A' },
  { key: 'work', title: 'My Work', subtitle: 'Tasks and deadlines tied to active events', route: '/host/work', icon: 'tasks', accent: '#A990ED' },
  { key: 'calendar', title: 'Calendar', subtitle: 'Event dates, deadlines and schedules', route: '/host/calendar', icon: 'calendar', accent: '#75AEE8' },
  { key: 'guests', title: 'Guests & Attendees', subtitle: 'Attendance, check-in and participant readiness', route: '/host/events', icon: 'connections', accent: '#77B9A6' },
  { key: 'team', title: 'Team', subtitle: 'Event crews, roles and assignments', route: '/host/teams', icon: 'team', accent: '#77B9A6' },
  { key: 'vendors', title: 'Vendors', subtitle: 'Vendors attached to active events', route: '/host/vendors', icon: 'storefront', accent: '#75AEE8' },
  { key: 'communications', title: 'Communications', subtitle: 'Guest, vendor and event messages', route: '/host/communications', icon: 'message', accent: '#A990ED' },
  { key: 'marketing', title: 'Marketing', subtitle: 'Campaigns and promotion for your events', route: '/host/campaigns', icon: 'megaphone', accent: '#E7A05C' },
  { key: 'finances', title: 'Finances', subtitle: 'Event revenue, expenses and projected profit', route: '/host/finances', icon: 'reports', accent: '#84C992' },
  { key: 'inventory', title: 'Inventory', subtitle: 'Equipment and supplies assigned to events', route: '/host/inventory-hub', icon: 'settings', accent: '#8DA19A' },
  { key: 'documents', title: 'Documents', subtitle: 'Waivers, contracts and event files', route: '/host/library', icon: 'upload', accent: '#75AEE8' },
  { key: 'templates', title: 'Templates & Library', subtitle: 'Reusable event building blocks', route: '/host/library', icon: 'library', accent: '#D7B45A' },
  { key: 'profile', title: 'Host Profile', subtitle: 'Edit what members see about you', route: '/host/profile', icon: 'profile', accent: '#D7B45A' },
  { key: 'settings', title: 'Settings', subtitle: 'Host preferences and event defaults', route: '/host/profile', icon: 'settings', accent: '#8DA19A' },
];

export const HOST_WORKSPACES = [
  { title: 'Member App', route: '/(tabs)' },
  { title: 'Host Center', route: '/host' },
  { title: 'Management', route: '/management' },
  { title: 'Admin', route: '/admin', adminOnly: true },
] as const;
