import { listHostCampaigns } from '../hosting/campaigns';
import { supabase } from '../lib/supabase';
import type {
  ManagementCalendarItem,
  ManagementDashboardData,
  ManagementMarketingItem,
  ManagementProfile,
  ManagementTask,
} from './types';

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  platform_role: string | null;
};

type MarketingRow = {
  id: string;
  campaign_id: string;
  title: string;
  content_type: string;
  platforms: string[] | null;
  planned_for: string;
  status: ManagementMarketingItem['status'];
};

export async function getManagementDashboard(): Promise<ManagementDashboardData> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in to open Go Melanated Management.');

  const adminResult = await supabase.rpc('is_platform_admin');
  if (adminResult.error) throw adminResult.error;
  if (adminResult.data !== true) throw new Error('Management access is restricted to authorized accounts.');

  const [profileResult, campaigns] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name,username,avatar_url,platform_role')
      .eq('id', authData.user.id)
      .single(),
    listHostCampaigns(),
  ]);

  if (profileResult.error) throw profileResult.error;

  const profileRow = profileResult.data as ProfileRow;
  const profile: ManagementProfile = {
    id: profileRow.id,
    displayName: profileRow.display_name?.trim() || profileRow.username?.trim() || 'Administrator',
    username: profileRow.username,
    avatarUrl: profileRow.avatar_url,
    platformRole: profileRow.platform_role ?? 'admin',
  };

  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const campaignIds = campaigns.map((campaign) => campaign.id);
  let marketing: ManagementMarketingItem[] = [];

  if (campaignIds.length > 0) {
    const marketingResult = await supabase
      .from('host_campaign_marketing_items')
      .select('id,campaign_id,title,content_type,platforms,planned_for,status')
      .in('campaign_id', campaignIds)
      .order('planned_for', { ascending: true });

    if (marketingResult.error) {
      console.warn('[management] Marketing calendar is unavailable', marketingResult.error.message);
    }
    marketing = ((marketingResult.data ?? []) as MarketingRow[]).flatMap((row) => {
      const campaign = campaignById.get(row.campaign_id);
      if (!campaign) return [];
      return [{
        id: row.id,
        campaignId: row.campaign_id,
        campaignSlug: campaign.slug,
        campaignTitle: campaign.shortTitle,
        title: row.title,
        contentType: row.content_type,
        platforms: row.platforms ?? [],
        plannedFor: row.planned_for,
        status: row.status,
      }];
    });
  }

  const tasks: ManagementTask[] = campaigns.flatMap((campaign) => campaign.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    campaignId: campaign.id,
    campaignSlug: campaign.slug,
    campaignTitle: campaign.shortTitle,
    category: task.category,
    owner: task.owner,
    assigneeProfileId: task.assigneeProfileId,
    dueLabel: task.dueLabel,
    dueAt: task.dueAt,
    status: task.status,
    priority: task.priority,
    blockedBy: task.blockedBy,
  })));

  return {
    profile,
    campaigns,
    tasks,
    marketing,
    calendar: buildManagementCalendar(campaigns, tasks, marketing),
  };
}

function buildManagementCalendar(
  campaigns: ManagementDashboardData['campaigns'],
  tasks: ManagementTask[],
  marketing: ManagementMarketingItem[],
): ManagementCalendarItem[] {
  const items: ManagementCalendarItem[] = [];

  for (const campaign of campaigns) {
    items.push({
      id: `event-${campaign.id}`,
      date: campaign.startsAt,
      title: campaign.shortTitle,
      subtitle: campaign.location,
      kind: 'event',
      accent: campaign.accent,
      route: `/host/campaigns/${campaign.slug}`,
    });
  }

  for (const task of tasks) {
    if (!task.dueAt || task.status === 'complete') continue;
    items.push({
      id: `task-${task.id}`,
      date: task.dueAt,
      title: task.title,
      subtitle: task.campaignTitle,
      kind: task.priority === 'critical' ? 'deadline' : 'task',
      accent: task.priority === 'critical' ? '#E87964' : '#D7B45A',
      route: `/host/campaigns/${task.campaignSlug}/tasks/${task.id}`,
    });
  }

  for (const item of marketing) {
    items.push({
      id: `marketing-${item.id}`,
      date: item.plannedFor,
      title: item.title,
      subtitle: `${item.campaignTitle} · ${item.status}`,
      kind: 'marketing',
      accent: '#7BB4A3',
      route: `/host/campaigns/${item.campaignSlug}/marketing`,
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date));
}
