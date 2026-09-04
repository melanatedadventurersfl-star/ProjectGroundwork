import type { AppIconName } from '../ui/AppIcon';

export type VendorWorkspaceGroup = 'GROW' | 'WORK' | 'BUSINESS' | 'PROFILE';

export type VendorWorkspaceItem = {
  key: string;
  title: string;
  subtitle: string;
  route: string;
  icon: AppIconName;
  accent: string;
  group: VendorWorkspaceGroup;
};

export const VENDOR_WORKSPACE_GROUPS: VendorWorkspaceGroup[] = ['GROW', 'WORK', 'BUSINESS', 'PROFILE'];

export const VENDOR_WORKSPACE_ITEMS: VendorWorkspaceItem[] = [
  { key: 'opportunities', title: 'Opportunities', subtitle: 'Find events and work that match your business', route: '/vendor/opportunities', icon: 'search', accent: '#E3B85C', group: 'GROW' },
  { key: 'leads', title: 'Leads', subtitle: 'New host inquiries and direct requests', route: '/vendor/leads', icon: 'message', accent: '#7FB7A3', group: 'GROW' },
  { key: 'applications', title: 'Applications', subtitle: 'Track submitted opportunities and decisions', route: '/vendor/applications', icon: 'briefcase', accent: '#8FA9E8', group: 'GROW' },
  { key: 'bookings', title: 'Bookings', subtitle: 'Confirmed events, requirements and event-day details', route: '/vendor/bookings', icon: 'calendar', accent: '#D98D70', group: 'WORK' },
  { key: 'calendar', title: 'Calendar', subtitle: 'Availability, bookings, deadlines and blocked dates', route: '/vendor/calendar', icon: 'calendar', accent: '#79B8A5', group: 'WORK' },
  { key: 'work', title: 'My Work', subtitle: 'Tasks, deadlines, assignments and event checklists', route: '/vendor/work', icon: 'tasks', accent: '#A990ED', group: 'WORK' },
  { key: 'messages', title: 'Messages', subtitle: 'Host, event-team and support conversations', route: '/vendor/messages', icon: 'message', accent: '#7BA8D8', group: 'WORK' },
  { key: 'quotes', title: 'Quotes', subtitle: 'Build proposals, packages and pricing for hosts', route: '/vendor/quotes', icon: 'reports', accent: '#D4A45A', group: 'BUSINESS' },
  { key: 'payments', title: 'Payments', subtitle: 'Deposits, balances, fees and payout tracking', route: '/vendor/payments', icon: 'trips', accent: '#74B889', group: 'BUSINESS' },
  { key: 'analytics', title: 'Analytics', subtitle: 'Views, inquiries, bookings, revenue and conversion', route: '/vendor/analytics', icon: 'reports', accent: '#E17E73', group: 'BUSINESS' },
  { key: 'services', title: 'Services & Packages', subtitle: 'Manage what you offer, pricing and add-ons', route: '/vendor/services', icon: 'storefront', accent: '#C98CCB', group: 'PROFILE' },
  { key: 'profile', title: 'Vendor Profile', subtitle: 'Manage your public marketplace storefront', route: '/vendor/profile', icon: 'profile', accent: '#E4B65E', group: 'PROFILE' },
  { key: 'portfolio', title: 'Portfolio', subtitle: 'Photos, videos and completed-event highlights', route: '/vendor/portfolio', icon: 'photos', accent: '#82A9D7', group: 'PROFILE' },
  { key: 'reviews', title: 'Reviews', subtitle: 'Feedback, ratings and repeat-booking reputation', route: '/vendor/reviews', icon: 'badge', accent: '#E0C768', group: 'PROFILE' },
  { key: 'documents', title: 'Documents', subtitle: 'Insurance, W-9s, permits, licenses and certificates', route: '/vendor/documents', icon: 'library', accent: '#7FB7A3', group: 'PROFILE' },
  { key: 'team', title: 'Team', subtitle: 'Employees, contractors, assignments and event shifts', route: '/vendor/team', icon: 'team', accent: '#B095DC', group: 'PROFILE' },
  { key: 'settings', title: 'Settings', subtitle: 'Availability rules, service area and business preferences', route: '/vendor/settings', icon: 'settings', accent: '#95A29A', group: 'PROFILE' },
];

export function findVendorWorkspaceItem(key: string) {
  return VENDOR_WORKSPACE_ITEMS.find((item) => item.key === key) ?? null;
}
