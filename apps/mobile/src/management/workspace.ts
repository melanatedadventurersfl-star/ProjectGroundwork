import type { AppIconName } from '../ui/AppIcon';

export type ManagementSection = {
  key: string;
  title: string;
  subtitle: string;
  icon: AppIconName;
  accent: string;
  liveRoute?: string;
  bullets: string[];
};

export const MANAGEMENT_SECTIONS: ManagementSection[] = [
  { key: 'work', title: 'My Work', subtitle: 'Tasks, assignments and deadlines across the organization', icon: 'tasks', accent: '#A990ED', liveRoute: '/host/work', bullets: ['Quick add and imported task lists', 'Assignments, due dates and blocked work', 'Templates and AI task suggestions'] },
  { key: 'team', title: 'Team', subtitle: 'Staff, hosts, contractors, volunteers and permissions', icon: 'team', accent: '#77B9A6', liveRoute: '/host/teams', bullets: ['Roles and permissions', 'Availability and assignments', 'Workload across events and operations'] },
  { key: 'calendar', title: 'Calendar', subtitle: 'Events, meetings, campaigns, deadlines and renewals', icon: 'calendar', accent: '#75AEE8', liveRoute: '/host/calendar', bullets: ['Cross-event deadlines', 'Internal meetings and milestones', 'Vendor, payment and campaign dates'] },
  { key: 'vendors', title: 'Vendors', subtitle: 'Your organization-wide vendor database', icon: 'directory', accent: '#75AEE8', liveRoute: '/host/vendors', bullets: ['Contacts and service categories', 'Contracts, insurance and pricing', 'History and preferred vendors'] },
  { key: 'opportunities', title: 'Opportunities', subtitle: 'Vending, partnerships, sponsorships and places to promote', icon: 'briefcase', accent: '#E7A05C', liveRoute: '/host/opportunities', bullets: ['Saved opportunities', 'Imported event and vendor links', 'Partnership and sponsorship pipeline'] },
  { key: 'communications', title: 'Communications', subtitle: 'Inquiries, templates and organization conversations', icon: 'notifications', accent: '#A990ED', liveRoute: '/host/communications', bullets: ['Host profile inquiries', 'Vendor and team communication', 'Saved and scheduled messages'] },
  { key: 'marketing', title: 'Marketing', subtitle: 'Campaign planning, content and performance', icon: 'megaphone', accent: '#E7A05C', liveRoute: '/host/campaigns', bullets: ['Content calendar', 'Campaign planning and promotion', 'Connected channel performance'] },
  { key: 'finances', title: 'Finances', subtitle: 'Money across the organization and every event', icon: 'reports', accent: '#84C992', liveRoute: '/host/finances', bullets: ['Revenue and expenses', 'Budgets, invoices and receipts', 'Cross-event profitability'] },
  { key: 'inventory', title: 'Inventory', subtitle: 'Equipment, supplies, rentals and storage', icon: 'settings', accent: '#8DA19A', liveRoute: '/host/inventory-hub', bullets: ['Quantities and condition', 'Storage location', 'Equipment assigned to events'] },
  { key: 'directories', title: 'Directories', subtitle: 'Venues, vendors, parks and saved resources', icon: 'library', accent: '#D7B45A', liveRoute: '/host/directories', bullets: ['Venue and campground research', 'Local business resources', 'Reusable saved contacts'] },
  { key: 'documents', title: 'Documents', subtitle: 'Contracts, waivers, permits and operational files', icon: 'upload', accent: '#75AEE8', bullets: ['Contracts and permits', 'Waivers and insurance', 'Menus, spreadsheets and uploaded task files'] },
  { key: 'templates', title: 'Templates & Library', subtitle: 'Reusable operating systems and building blocks', icon: 'library', accent: '#D7B45A', liveRoute: '/host/library', bullets: ['Task and event templates', 'Campaign and communication templates', 'Food plans and operating checklists'] },
  { key: 'reports', title: 'Reports', subtitle: 'Cross-event performance and operational trends', icon: 'reports', accent: '#84C992', bullets: ['Attendance and revenue trends', 'Vendor and campaign performance', 'Task completion and workload'] },
  { key: 'settings', title: 'Settings', subtitle: 'Organization details, permissions and integrations', icon: 'settings', accent: '#8DA19A', bullets: ['Organization information', 'Permissions and notifications', 'Connected accounts and integrations'] },
];

export const MANAGEMENT_WORKSPACES = [
  { title: 'Member App', route: '/(tabs)' },
  { title: 'Host Center', route: '/host' },
  { title: 'Management', route: '/management' },
  { title: 'Admin', route: '/admin' },
];

export function managementSection(key?: string) {
  return MANAGEMENT_SECTIONS.find((section) => section.key === key);
}
