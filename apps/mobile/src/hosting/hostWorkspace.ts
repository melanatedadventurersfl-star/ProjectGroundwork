import type { AppIconName } from '../ui/AppIcon';

export type HostWorkspaceGroup = 'EVENTS' | 'WORK' | 'BUSINESS' | 'RESOURCES';

export type HostWorkspaceItem = {
  key: string;
  title: string;
  subtitle: string;
  route: string;
  icon: AppIconName;
  accent: string;
  group: HostWorkspaceGroup;
};

export const HOST_WORKSPACE_ITEMS: HostWorkspaceItem[] = [
  { key: 'events', title: 'Events', subtitle: 'Build, prepare, run and close out events', route: '/host/events', icon: 'adventure', accent: '#D7B45A', group: 'EVENTS' },
  { key: 'guests', title: 'Guests & Attendees', subtitle: 'Attendance, check-in and participant readiness', route: '/host/events', icon: 'connections', accent: '#77B9A6', group: 'EVENTS' },
  { key: 'calendar', title: 'Calendar', subtitle: 'Events, deadlines, meetings and schedules', route: '/host/calendar', icon: 'calendar', accent: '#75AEE8', group: 'EVENTS' },

  { key: 'work', title: 'My Work', subtitle: 'Tasks and deadlines across events and operations', route: '/host/work', icon: 'tasks', accent: '#A990ED', group: 'WORK' },
  { key: 'team', title: 'Team', subtitle: 'Staff, hosts, contractors, volunteers and roles', route: '/host/teams', icon: 'team', accent: '#77B9A6', group: 'WORK' },
  { key: 'opportunities', title: 'Opportunities', subtitle: 'Vending, partnerships and sponsorships', route: '/host/opportunities', icon: 'briefcase', accent: '#E7A05C', group: 'WORK' },

  { key: 'vendors', title: 'Vendors', subtitle: 'Organization-wide vendor directory and relationships', route: '/host/vendors', icon: 'storefront', accent: '#75AEE8', group: 'BUSINESS' },
  { key: 'communications', title: 'Communications', subtitle: 'Host inquiries, team, vendor and member messages', route: '/host/communications', icon: 'message', accent: '#A990ED', group: 'BUSINESS' },
  { key: 'marketing', title: 'Marketing', subtitle: 'Campaigns, content, promotion and performance', route: '/host/campaigns', icon: 'megaphone', accent: '#E7A05C', group: 'BUSINESS' },
  { key: 'finances', title: 'Finances', subtitle: 'Money across events and organization operations', route: '/host/finances', icon: 'reports', accent: '#84C992', group: 'BUSINESS' },
  { key: 'inventory', title: 'Inventory', subtitle: 'Equipment, supplies, rentals and assignments', route: '/host/inventory-hub', icon: 'settings', accent: '#8DA19A', group: 'BUSINESS' },
  { key: 'directories', title: 'Directories', subtitle: 'Venues, vendors and reusable business resources', route: '/host/directories', icon: 'directory', accent: '#D7B45A', group: 'BUSINESS' },
  { key: 'documents', title: 'Documents', subtitle: 'Waivers, contracts and organization files', route: '/host/library', icon: 'upload', accent: '#75AEE8', group: 'BUSINESS' },

  { key: 'templates', title: 'Templates & Library', subtitle: 'Reusable event and operations building blocks', route: '/host/library', icon: 'library', accent: '#D7B45A', group: 'RESOURCES' },
  { key: 'reports', title: 'Reports', subtitle: 'Cross-event performance and operational history', route: '/host/finances', icon: 'reports', accent: '#84C992', group: 'RESOURCES' },
  { key: 'profile', title: 'Host Profile', subtitle: 'Edit what members see about you', route: '/host/profile', icon: 'profile', accent: '#D7B45A', group: 'RESOURCES' },
  { key: 'settings', title: 'Settings', subtitle: 'Host preferences, defaults and integrations', route: '/host/profile', icon: 'settings', accent: '#8DA19A', group: 'RESOURCES' },
];

export const HOST_WORKSPACE_GROUPS: HostWorkspaceGroup[] = ['EVENTS', 'WORK', 'BUSINESS', 'RESOURCES'];

export const HOST_WORKSPACES = [
  { title: 'Member App', route: '/(tabs)' },
  { title: 'Host Center', route: '/host' },
  { title: 'Admin', route: '/admin' },
] as const;
