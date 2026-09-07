export type OutpostCreateActionId =
  | 'post-community'
  | 'create-outing'
  | 'create-hosted-event'
  | 'admin-tools';

export type OutpostCreateAction = {
  id: OutpostCreateActionId;
  label: string;
  helper: string;
  icon: string;
  route: string;
};

type ResolveOutpostCreateActionsInput = {
  joinedCommunityCount: number;
  isHost: boolean;
  isAdmin: boolean;
};

export function resolveOutpostCreateActions({
  joinedCommunityCount,
  isHost,
  isAdmin,
}: ResolveOutpostCreateActionsInput): OutpostCreateAction[] {
  const actions: OutpostCreateAction[] = [];

  if (joinedCommunityCount > 0) {
    actions.push({
      id: 'post-community',
      label: 'Post to a Community',
      helper: 'Share with a Community you already joined.',
      icon: 'create-outline',
      route: '/community/create-in-community',
    });
  }

  if (isHost || isAdmin) {
    actions.push({
      id: 'create-outing',
      label: 'Create an Outing',
      helper: 'Plan a local outing people can join.',
      icon: 'trail-sign-outline',
      route: '/local-events/create',
    });
    actions.push({
      id: 'create-hosted-event',
      label: 'Create a Hosted Event',
      helper: 'Open the Host Center event builder.',
      icon: 'calendar-outline',
      route: '/host/create-scratch',
    });
  }

  if (isAdmin) {
    actions.push({
      id: 'admin-tools',
      label: 'Admin Tools',
      helper: 'Open administrative creation and management tools.',
      icon: 'shield-checkmark-outline',
      route: '/admin',
    });
  }

  return actions;
}
