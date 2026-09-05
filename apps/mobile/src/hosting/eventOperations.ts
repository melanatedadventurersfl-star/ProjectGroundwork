import type { HostCampaign } from './campaigns';
import { getEventOperationsSummary } from './eventBuilder';
import { campaignDateAssessment, campaignProgress, isOverdue, needsScheduling, openTasksForCampaign } from './workModel';

export async function getUnifiedEventOperationsSummary(campaign: HostCampaign) {
  const legacy = await getEventOperationsSummary(campaign.id);
  const openTasks = openTasksForCampaign(campaign);
  const completeTaskCount = campaign.tasks.length ? campaign.tasks.filter((task) => task.status === 'complete').length : 0;

  return {
    ...legacy,
    progress: campaignProgress(campaign),
    taskCount: openTasks.length + completeTaskCount,
    completeTaskCount,
    openTaskCount: openTasks.length,
    overdueTaskCount: openTasks.filter((task) => isOverdue({ ...task, campaign })).length,
    needsSchedulingCount: openTasks.filter((task) => needsScheduling({ ...task, campaign })).length,
    dateAssessment: campaignDateAssessment(campaign),
  };
}
