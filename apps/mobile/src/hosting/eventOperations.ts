import type { HostCampaign } from './campaigns';
import { getEventOperationsSummary } from './eventBuilder';
import { allTasksForCampaign, campaignDateAssessment, campaignProgress, isOverdue, needsScheduling, openTasksForCampaign } from './workModel';

export async function getUnifiedEventOperationsSummary(campaign: HostCampaign) {
  const legacy = await getEventOperationsSummary(campaign.id);
  const allTasks = allTasksForCampaign(campaign);
  const openTasks = openTasksForCampaign(campaign);
  const completeTaskCount = allTasks.filter((task) => task.status === 'complete').length;

  return {
    ...legacy,
    progress: campaignProgress(campaign),
    taskCount: allTasks.length,
    completeTaskCount,
    openTaskCount: openTasks.length,
    overdueTaskCount: openTasks.filter((task) => isOverdue({ ...task, campaign })).length,
    needsSchedulingCount: openTasks.filter((task) => needsScheduling({ ...task, campaign })).length,
    dateAssessment: campaignDateAssessment(campaign),
  };
}
