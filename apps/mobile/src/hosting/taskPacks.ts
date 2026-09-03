import type { CampaignTaskPriority, HostCampaign } from './campaigns';
import { listEventComponents } from './eventBuilder';

export type TaskPackKey = 'marketing' | 'food' | 'vendors' | 'venue' | 'operations' | 'communications' | 'safety' | 'inventory';
export type TaskPackItem = {
  key: string;
  title: string;
  category: string;
  priority?: CampaignTaskPriority;
  completionSignals?: string[];
};
export type TaskPack = {
  key: TaskPackKey;
  title: string;
  shortTitle: string;
  description: string;
  accent: string;
  icon: string;
  items: TaskPackItem[];
};
export type TaskPackItemState = 'missing' | 'open' | 'complete';
export type AssessedTaskPackItem = TaskPackItem & {
  state: TaskPackItemState;
  existingTaskId?: string;
  reason?: string;
};

export const TASK_PACKS: TaskPack[] = [
  {
    key: 'marketing', title: 'Build Campaign', shortTitle: 'Marketing', description: 'Campaign, content and promotion', accent: '#A990ED', icon: '📣',
    items: [
      { key: 'goal', title: 'Define campaign goal', category: 'Marketing', priority: 'high', completionSignals: ['campaign goal', 'marketing goal'] },
      { key: 'audience', title: 'Confirm target audience', category: 'Marketing', completionSignals: ['target audience', 'audience'] },
      { key: 'dates', title: 'Confirm campaign dates', category: 'Marketing', priority: 'high', completionSignals: ['campaign dates', 'marketing dates'] },
      { key: 'theme', title: 'Create campaign theme', category: 'Marketing', completionSignals: ['campaign theme'] },
      { key: 'launch-post', title: 'Create launch post', category: 'Marketing', priority: 'high', completionSignals: ['launch post', 'launch assets'] },
      { key: 'social-calendar', title: 'Create social media schedule', category: 'Marketing', completionSignals: ['social media schedule', 'marketing calendar', 'content calendar'] },
      { key: 'email', title: 'Create email campaign', category: 'Marketing', completionSignals: ['email campaign'] },
      { key: 'graphics', title: 'Create event graphics', category: 'Marketing', completionSignals: ['event graphics', 'marketing graphics'] },
      { key: 'video', title: 'Create short-form video', category: 'Marketing', completionSignals: ['short-form video', 'promo video'] },
      { key: 'final-push', title: 'Schedule final-week reminder', category: 'Marketing', priority: 'high', completionSignals: ['final-week reminder', 'final ticket push'] },
      { key: 'conversion', title: 'Track ticket conversion', category: 'Marketing', completionSignals: ['ticket conversion', 'conversion tracking'] },
    ],
  },
  {
    key: 'food', title: 'Build Food Plan', shortTitle: 'Food', description: 'Meals, prep and service', accent: '#E7A05C', icon: '🍴',
    items: [
      { key: 'headcount', title: 'Confirm meal headcount', category: 'Food', priority: 'high', completionSignals: ['meal headcount', 'food headcount'] },
      { key: 'menu', title: 'Finalize menu', category: 'Food', priority: 'high', completionSignals: ['finalize menu', 'finalize event menu', 'menu finalized', 'final menu'] },
      { key: 'dietary', title: 'Review dietary restrictions', category: 'Food', completionSignals: ['dietary restrictions', 'dietary needs'] },
      { key: 'quantities', title: 'Calculate ingredient quantities', category: 'Food', completionSignals: ['ingredient quantities', 'food quantities'] },
      { key: 'shopping-list', title: 'Create shopping list', category: 'Food', completionSignals: ['shopping list', 'grocery list'] },
      { key: 'prep', title: 'Assign meal prep responsibilities', category: 'Food', completionSignals: ['meal prep responsibilities', 'assign meal prep'] },
      { key: 'equipment', title: 'Confirm cooking equipment', category: 'Food', completionSignals: ['cooking equipment', 'cooking and serving equipment'] },
      { key: 'storage', title: 'Confirm food storage and cold holding', category: 'Food', priority: 'high', completionSignals: ['food storage', 'cold holding'] },
      { key: 'serving', title: 'Confirm serving supplies', category: 'Food', completionSignals: ['serving supplies'] },
      { key: 'cleanup', title: 'Confirm cleanup supplies', category: 'Food', completionSignals: ['cleanup supplies'] },
      { key: 'purchase', title: 'Schedule grocery purchase', category: 'Food', completionSignals: ['grocery purchase', 'shopping date'] },
    ],
  },
  {
    key: 'vendors', title: 'Build Vendor Plan', shortTitle: 'Vendors', description: 'Source, contact and confirm', accent: '#75AEE8', icon: '🏪',
    items: [
      { key: 'needs', title: 'Confirm vendor needs', category: 'Vendors', priority: 'high', completionSignals: ['vendor needs', 'vendor requirements'] },
      { key: 'search', title: 'Find possible vendors', category: 'Vendors', completionSignals: ['find possible vendors', 'vendor search'] },
      { key: 'shortlist', title: 'Create vendor shortlist', category: 'Vendors', completionSignals: ['vendor shortlist'] },
      { key: 'contact', title: 'Contact shortlisted vendors', category: 'Vendors', priority: 'high', completionSignals: ['contact shortlisted vendors', 'vendor outreach'] },
      { key: 'quotes', title: 'Collect and compare vendor quotes', category: 'Vendors', completionSignals: ['vendor quotes', 'compare vendor quotes'] },
      { key: 'contracts', title: 'Confirm vendor contracts and deposits', category: 'Vendors', priority: 'high', completionSignals: ['vendor contracts', 'vendor deposits'] },
      { key: 'arrival', title: 'Confirm vendor arrival and setup details', category: 'Vendors', completionSignals: ['vendor arrival', 'vendor setup details'] },
    ],
  },
  {
    key: 'venue', title: 'Build Venue Plan', shortTitle: 'Venue', description: 'Search, compare and book', accent: '#77B9A6', icon: '📍',
    items: [
      { key: 'requirements', title: 'Confirm venue requirements', category: 'Venue', priority: 'high', completionSignals: ['venue requirements'] },
      { key: 'search', title: 'Find possible venues', category: 'Venue', priority: 'critical', completionSignals: ['find possible venues', 'venue search'] },
      { key: 'shortlist', title: 'Create venue shortlist', category: 'Venue', completionSignals: ['venue shortlist'] },
      { key: 'contact', title: 'Contact shortlisted venues', category: 'Venue', priority: 'high', completionSignals: ['contact shortlisted venues', 'venue outreach'] },
      { key: 'compare', title: 'Compare venue pricing and restrictions', category: 'Venue', completionSignals: ['venue pricing', 'compare venue'] },
      { key: 'availability', title: 'Confirm venue availability', category: 'Venue', priority: 'critical', completionSignals: ['venue availability'] },
      { key: 'contract', title: 'Review venue contract and deposit', category: 'Venue', priority: 'high', completionSignals: ['venue contract', 'venue deposit'] },
    ],
  },
  {
    key: 'operations', title: 'Build Operations Plan', shortTitle: 'Operations', description: 'Setup, staffing and event-day work', accent: '#D7B45A', icon: '🧭',
    items: [
      { key: 'roster', title: 'Confirm final attendee roster', category: 'Operations', priority: 'high', completionSignals: ['final attendee roster'] },
      { key: 'staff', title: 'Confirm staff assignments', category: 'Operations', priority: 'critical', completionSignals: ['staff assignments', 'team responsibilities'] },
      { key: 'checkin', title: 'Prepare guest check-in materials', category: 'Operations', priority: 'high', completionSignals: ['check-in materials', 'check in materials'] },
      { key: 'loadin', title: 'Finalize load-in and setup plan', category: 'Operations', completionSignals: ['load-in', 'setup plan'] },
      { key: 'breakdown', title: 'Finalize breakdown and cleanup assignments', category: 'Operations', completionSignals: ['breakdown', 'cleanup assignments'] },
    ],
  },
  {
    key: 'communications', title: 'Build Guest Communications', shortTitle: 'Guest Comms', description: 'Attendee messages and reminders', accent: '#C884C9', icon: '✉️',
    items: [
      { key: 'schedule', title: 'Review attendee communication schedule', category: 'Communications', completionSignals: ['communication schedule'] },
      { key: 'final-info', title: 'Send final attendee information', category: 'Communications', priority: 'high', completionSignals: ['final attendee information', 'day-before details'] },
      { key: 'day-of', title: 'Prepare event-day attendee message', category: 'Communications', completionSignals: ['event morning', 'event-day attendee message'] },
      { key: 'thanks', title: 'Prepare post-event thank-you', category: 'Communications', completionSignals: ['post-event thank you', 'post-event thank-you'] },
    ],
  },
  {
    key: 'safety', title: 'Build Safety Plan', shortTitle: 'Safety', description: 'Insurance, waivers and emergency planning', accent: '#EA806E', icon: '🛡️',
    items: [
      { key: 'permits', title: 'Confirm permits and insurance', category: 'Safety', priority: 'critical', completionSignals: ['permits and insurance'] },
      { key: 'waivers', title: 'Confirm waiver requirements', category: 'Safety', priority: 'high', completionSignals: ['waiver requirements', 'waivers'] },
      { key: 'emergency', title: 'Finalize emergency plan', category: 'Safety', priority: 'high', completionSignals: ['emergency plan'] },
      { key: 'contacts', title: 'Confirm emergency contacts', category: 'Safety', completionSignals: ['emergency contacts'] },
    ],
  },
  {
    key: 'inventory', title: 'Build Supply Plan', shortTitle: 'Inventory', description: 'Equipment, supplies and shortages', accent: '#8DA19A', icon: '📦',
    items: [
      { key: 'list', title: 'Build equipment list', category: 'Inventory', completionSignals: ['equipment list'] },
      { key: 'shortages', title: 'Resolve equipment shortages', category: 'Inventory', priority: 'high', completionSignals: ['equipment shortages'] },
      { key: 'final-check', title: 'Complete equipment and supply check', category: 'Inventory', priority: 'high', completionSignals: ['equipment and supply check', 'inventory check'] },
    ],
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function settingsContainSignal(settings: unknown, signals: string[]) {
  if (!settings || signals.length === 0) return false;
  const text = normalize(JSON.stringify(settings));
  return signals.some((signal) => text.includes(normalize(signal)));
}

function relatedTask(campaign: HostCampaign, pack: TaskPack, item: TaskPackItem) {
  const exactKey = `pack-${pack.key}-${item.key}`;
  const signals = [item.title, ...(item.completionSignals ?? [])].map(normalize);
  return campaign.tasks.find((task) => {
    if (task.taskKey === exactKey) return true;
    const title = normalize(task.title);
    return signals.some((signal) => title === signal || title.includes(signal) || signal.includes(title));
  });
}

export async function assessTaskPack(campaign: HostCampaign, pack: TaskPack): Promise<AssessedTaskPackItem[]> {
  const components = await listEventComponents(campaign.id).catch(() => []);
  const component = components.find((entry) => entry.component_key === pack.key || (pack.key === 'inventory' && entry.component_key === 'equipment'));
  const componentSettings = component?.settings ?? null;

  return pack.items.map((item) => {
    const existing = relatedTask(campaign, pack, item);
    if (existing?.status === 'complete') return { ...item, state: 'complete', existingTaskId: existing.id, reason: 'Completed task' };
    if (existing) return { ...item, state: 'open', existingTaskId: existing.id, reason: 'Already in My Work' };
    if (settingsContainSignal(componentSettings, item.completionSignals ?? [])) return { ...item, state: 'complete', reason: 'Already filled out in event setup' };
    return { ...item, state: 'missing' };
  });
}

export function taskPackByKey(key: string | undefined) {
  return TASK_PACKS.find((pack) => pack.key === key) ?? null;
}

export function categoryMatchesPack(category: string, pack: TaskPack) {
  const normalized = normalize(category);
  if (pack.key === 'inventory') return normalized.includes('inventory') || normalized.includes('equipment');
  if (pack.key === 'operations') return normalized.includes('operations') || normalized.includes('team');
  if (pack.key === 'communications') return normalized.includes('communication');
  return normalized.includes(normalize(pack.shortTitle)) || normalized.includes(normalize(pack.key));
}
