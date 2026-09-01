export type CampaignTaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'blocked' | 'review' | 'complete';

export type CampaignTask = {
  id: string;
  title: string;
  category: string;
  owner: string;
  dueLabel: string;
  status: CampaignTaskStatus;
  priority: 'critical' | 'high' | 'normal';
  blockedBy?: string;
};

export type CampaignMilestone = {
  id: string;
  title: string;
  weight: number;
  complete: boolean;
};

export type CampaignDecision = {
  id: string;
  title: string;
  owner: string;
  dueLabel: string;
  status: 'open' | 'decided';
};

export type HostCampaign = {
  id: string;
  title: string;
  shortTitle: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: 'planning' | 'live' | 'complete';
  accent: string;
  tasks: CampaignTask[];
  milestones: CampaignMilestone[];
  decisions: CampaignDecision[];
  metrics: {
    attendees: number;
    capacityLabel: string;
    scheduledMarketing: number;
    marketingNeedsAttention: number;
    budgetCommitted: number;
    budgetRemaining: number;
  };
};

const littleCampOfHorrors: HostCampaign = {
  id: 'little-camp-of-horrors-2026',
  title: 'The Great Melanated Little Camp of Horrors',
  shortTitle: 'Little Camp of Horrors 2026',
  location: 'Florida Sand Music Ranch · Brooksville, FL',
  startsAt: '2026-10-30T15:00:00-04:00',
  endsAt: '2026-11-01T12:00:00-05:00',
  status: 'planning',
  accent: '#E88633',
  tasks: [
    {
      id: 'decor-inventory',
      title: 'Confirm campground décor inventory',
      category: 'Decor & Production',
      owner: 'Jonathan + Shannette',
      dueLabel: 'Needs follow-up',
      status: 'waiting',
      priority: 'critical',
    },
    {
      id: 'decor-gaps',
      title: 'Identify décor gaps',
      category: 'Decor & Production',
      owner: 'Unassigned',
      dueLabel: 'After inventory',
      status: 'blocked',
      priority: 'high',
      blockedBy: 'Confirm campground décor inventory',
    },
    {
      id: 'ticket-policy',
      title: 'Finalize refund and transfer policy',
      category: 'Ticketing',
      owner: 'Jonathan',
      dueLabel: 'This week',
      status: 'not_started',
      priority: 'high',
    },
    {
      id: 'costume-categories',
      title: 'Finalize costume contest categories',
      category: 'Experience',
      owner: 'Shannette',
      dueLabel: 'Open decision',
      status: 'not_started',
      priority: 'normal',
    },
    {
      id: 'rule-drop',
      title: 'Prepare Tuesday Rule Drop',
      category: 'Marketing',
      owner: 'Jonathan',
      dueLabel: 'Tuesday',
      status: 'in_progress',
      priority: 'high',
    },
    {
      id: 'food-plan',
      title: 'Lock Saturday dinner menu',
      category: 'Food & Hospitality',
      owner: 'Jonathan + Shannette',
      dueLabel: 'Complete',
      status: 'complete',
      priority: 'normal',
    },
  ],
  milestones: [
    { id: 'venue', title: 'Venue locked', weight: 30, complete: true },
    { id: 'ticketing', title: 'Ticketing ready', weight: 20, complete: false },
    { id: 'experience', title: 'Experience locked', weight: 20, complete: false },
    { id: 'operations', title: 'Event ready', weight: 30, complete: false },
  ],
  decisions: [
    { id: 'costume', title: 'Costume contest categories', owner: 'Shannette', dueLabel: 'Sep 20', status: 'open' },
    { id: 'checkin', title: 'Final check-in window', owner: 'Jonathan', dueLabel: 'Before final attendee email', status: 'open' },
  ],
  metrics: {
    attendees: 0,
    capacityLabel: 'Ticket sync not connected',
    scheduledMarketing: 1,
    marketingNeedsAttention: 2,
    budgetCommitted: 500,
    budgetRemaining: 0,
  },
};

export const seededHostCampaigns: HostCampaign[] = [littleCampOfHorrors];

export function getHostCampaign(id: string) {
  return seededHostCampaigns.find((campaign) => campaign.id === id) ?? null;
}

export function getCampaignReadiness(campaign: HostCampaign) {
  const totalWeight = campaign.milestones.reduce((sum, milestone) => sum + milestone.weight, 0);
  if (!totalWeight) return 0;
  const completedWeight = campaign.milestones
    .filter((milestone) => milestone.complete)
    .reduce((sum, milestone) => sum + milestone.weight, 0);
  return Math.round((completedWeight / totalWeight) * 100);
}

export function getCampaignDaysUntil(campaign: HostCampaign, now = new Date()) {
  const event = new Date(campaign.startsAt);
  const diff = event.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
