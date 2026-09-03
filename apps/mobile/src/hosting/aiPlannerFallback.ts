import type { AiPlanState, AiPlannerTurn } from './aiPlanner';

function unique(values: string[]) {
  return [...new Set(values)];
}

export function buildClientPlannerFallback(message: string, current: AiPlanState): AiPlannerTurn {
  const lower = message.toLowerCase();
  const plan: AiPlanState = {
    ...current,
    state: current.state || 'FL',
    components: Array.isArray(current.components) ? [...current.components] : [],
    requirements: Array.isArray(current.requirements) ? [...current.requirements] : [],
    safetyNotes: Array.isArray(current.safetyNotes) ? [...current.safetyNotes] : [],
  };

  if (!plan.city && lower.includes('jacksonville')) plan.city = 'Jacksonville';
  if (!plan.city && lower.includes('ocala')) plan.city = 'Ocala';

  const natureWalk = lower.includes('nature walk') || lower.includes('nature hike') || lower.includes('hike');
  const paddling = lower.includes('kayak') || lower.includes('paddle') || lower.includes('canoe');
  const camping = lower.includes('camping') || lower.includes('campout') || lower.includes('camp out');

  if (!plan.title && natureWalk) {
    plan.title = plan.city ? `Nature Walk in ${plan.city}` : 'Nature Walk';
    plan.summary = plan.city ? `A group nature walk in ${plan.city}.` : 'A group nature walk.';
    plan.description = plan.summary;
    plan.category = 'Hiking';
    plan.difficulty = 'easy';
    plan.components = unique([...(plan.components ?? []), 'venue', 'schedule', 'activities', 'safety', 'communications', 'team']);
  } else if (!plan.title && paddling) {
    plan.title = plan.city ? `${plan.city} Social Paddle` : 'Social Paddle';
    plan.summary = plan.city ? `A relaxed group paddle near ${plan.city}.` : 'A relaxed group paddle.';
    plan.description = plan.summary;
    plan.category = 'Paddling';
    plan.difficulty = 'easy';
    plan.components = unique([...(plan.components ?? []), 'venue', 'safety', 'equipment', 'tickets', 'communications', 'team']);
  } else if (!plan.title && camping) {
    plan.title = plan.city ? `Camping Trip in ${plan.city}` : 'Camping Trip';
    plan.summary = plan.city ? `A group camping trip near ${plan.city}.` : 'A group camping trip.';
    plan.description = plan.summary;
    plan.category = 'Camping';
    plan.difficulty = 'easy';
    plan.components = unique([...(plan.components ?? []), 'venue', 'schedule', 'activities', 'food', 'equipment', 'safety', 'communications', 'team']);
  }

  const capacityMatch = lower.match(/\b(\d{1,4})\s*(people|guests|attendees|persons)?\b/);
  if (!plan.capacity && capacityMatch) plan.capacity = Number(capacityMatch[1]);
  if (!plan.capacity && lower.includes('10 or fewer')) plan.capacity = 10;
  if (!plan.capacity && (lower.includes('10–25') || lower.includes('10-25'))) plan.capacity = 25;
  if (!plan.capacity && (lower.includes('25–50') || lower.includes('25-50'))) plan.capacity = 50;
  if (!plan.capacity && lower.includes('50+')) plan.capacity = 60;

  const gaps = [
    !plan.title ? 'Event idea or title' : '',
    !plan.capacity ? 'Expected attendance' : '',
    !plan.startsAt ? 'Date and start time' : '',
    !plan.endsAt ? 'End time' : '',
    !plan.city ? 'City' : '',
    !plan.venueName ? 'Venue or meeting point' : '',
    !plan.meetingInstructions ? 'Arrival instructions' : '',
  ].filter(Boolean);

  const readiness = Math.max(10, Math.min(95, 100 - gaps.length * 12));
  let nextMessage = 'Tell me a little more about the event you want to host.';
  let options = ['Nature walk', 'Camping trip', 'Social meetup'];

  if (plan.title && !plan.capacity) {
    nextMessage = `${plan.title} is taking shape${plan.city ? ` in ${plan.city}` : ''}. About how many people are you planning for?`;
    options = ['10 or fewer', '10–25', '25–50', '50+', 'Not sure yet'];
  } else if (!plan.startsAt) {
    nextMessage = 'What date or weekend are you considering?';
    options = ['This weekend', 'Next weekend', 'I have a date', 'Not sure yet'];
  } else if (!plan.venueName) {
    nextMessage = 'Do you already have a venue or meeting point, or should I recommend options?';
    options = ['Recommend locations', 'I know the location', 'Skip for now'];
  } else if (!plan.meetingInstructions) {
    nextMessage = 'What should guests know about arrival or check-in?';
    options = ['Recommend for me', 'I’ll add instructions', 'Skip for now'];
  }

  const taskPacks = plan.category === 'Paddling'
    ? ['safety', 'waivers', 'equipment', 'communications', 'marketing', 'event_day']
    : plan.category === 'Camping'
      ? ['food', 'safety', 'equipment', 'communications', 'marketing', 'event_day']
      : ['safety', 'communications', 'marketing', 'event_day'];

  return {
    message: nextMessage,
    plan,
    readiness,
    stage: readiness >= 95 ? 'ready' : readiness >= 75 ? 'confidence' : readiness >= 35 ? 'momentum' : 'possibility',
    gaps,
    options,
    recommendation: null,
    taskPacks,
  };
}
