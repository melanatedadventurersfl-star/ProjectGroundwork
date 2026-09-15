import type { PlannerBrainAction, PlannerBrainPatchField, PlannerBrainResponse } from './aiPlannerBrain';

export type PlannerEvalExpectation = {
  fields?: PlannerBrainPatchField[];
  action?: PlannerBrainAction;
  messageIncludes?: string[];
  messageExcludes?: string[];
};

export type PlannerEvalCase = {
  id: string;
  description: string;
  currentDate: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  message: string;
  expectation: PlannerEvalExpectation;
};

export const AI_PLANNER_EVAL_CASES: PlannerEvalCase[] = [
  {
    id: 'relative-tomorrow',
    description: 'A one-word relative date should resolve instead of repeating the date question.',
    currentDate: '2026-09-15',
    history: [{ role: 'assistant', text: 'What date and time are you thinking?' }],
    message: 'Tomorrow',
    expectation: { fields: ['plannerDate'], messageIncludes: ['September 16'], messageExcludes: ['What date and time'] },
  },
  {
    id: 'movie-night-multi-fact',
    description: 'A novel event concept should preserve identity and extract attendance.',
    currentDate: '2026-09-15',
    history: [],
    message: 'I am planning a movie night for maybe 30 people.',
    expectation: { fields: ['title', 'category', 'capacity'], messageExcludes: ['Networking Event'] },
  },
  {
    id: 'movie-night-relative-date',
    description: 'Event identity, attendance and relative date can arrive together.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Movie night tomorrow for about 20 people.',
    expectation: { fields: ['title', 'category', 'plannerDate', 'capacity'], messageExcludes: ['Networking Event'] },
  },
  {
    id: 'time-range-after-date',
    description: 'A time range should attach to the previously established date.',
    currentDate: '2026-09-15',
    history: [{ role: 'assistant', text: 'September 16 is set. What time?' }],
    message: '6 to 9 PM',
    expectation: { fields: ['startsAt', 'endsAt'] },
  },
  {
    id: 'attendance-correction',
    description: 'Explicit attendance correction should replace old attendance and trigger consequences.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Actually make it 150 people.',
    expectation: { fields: ['capacity'] },
  },
  {
    id: 'venue-type-advice',
    description: 'Venue strategy questions should be answered without automatically searching real places.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Half the guests are flying in. What kind of venue would make sense?',
    expectation: { action: 'continue', messageIncludes: ['airport'] },
  },
  {
    id: 'venue-real-search',
    description: 'Explicit real venue discovery should request the venue tool.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Find me some upscale venues near the airport.',
    expectation: { action: 'venue_search' },
  },
  {
    id: 'venue-refine',
    description: 'Refining prior search results should request a venue refinement.',
    currentDate: '2026-09-15',
    history: [{ role: 'assistant', text: 'I found five venue options.' }],
    message: 'Show me something more upscale with better parking.',
    expectation: { action: 'venue_refine' },
  },
  {
    id: 'marketing-context',
    description: 'Short section replies should be interpreted in section context.',
    currentDate: '2026-09-15',
    history: [{ role: 'assistant', text: 'How do you plan to promote it?' }],
    message: 'Through Facebook and email.',
    expectation: { action: 'continue' },
  },
  {
    id: 'marketing-delegation',
    description: 'Delegation should create a useful plan instead of marking a section complete with no content.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Handle marketing for me.',
    expectation: { action: 'continue', messageIncludes: ['marketing'] },
  },
  {
    id: 'pricing-question',
    description: 'Planning questions should receive useful reasoning rather than a canned path.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Would charging $35 make sense for this?',
    expectation: { action: 'continue', messageIncludes: ['$35'] },
  },
  {
    id: 'retract-downtown',
    description: 'A host can retract a previous venue preference.',
    currentDate: '2026-09-15',
    history: [{ role: 'user', text: 'I want somewhere downtown.' }],
    message: 'Forget downtown. Near the airport would be better.',
    expectation: { fields: ['venueSearchRefinement'] },
  },
  {
    id: 'location-is-area-not-venue',
    description: 'A city answer should remain an event area rather than become a venue.',
    currentDate: '2026-09-15',
    history: [{ role: 'assistant', text: 'What city or area should I plan around?' }],
    message: 'Jacksonville',
    expectation: { fields: ['city'], messageExcludes: ['Jacksonville is set as the venue'] },
  },
  {
    id: 'free-admission',
    description: 'Natural free-admission language should update registration.',
    currentDate: '2026-09-15',
    history: [],
    message: 'This one will be free.',
    expectation: { fields: ['paid'] },
  },
  {
    id: 'paid-price',
    description: 'Paid admission and a price can arrive together.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Tickets will be $25 each.',
    expectation: { fields: ['paid', 'priceCents'] },
  },
  {
    id: 'tentative-time',
    description: 'Approximate language should remain tentative.',
    currentDate: '2026-09-15',
    history: [{ role: 'assistant', text: 'What time?' }],
    message: 'Probably around 6 PM.',
    expectation: { fields: ['startsAt'] },
  },
  {
    id: 'compound-schedule-location',
    description: 'One message can update schedule and location.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Next Friday from 7 to 10 in Jacksonville, Florida.',
    expectation: { fields: ['plannerDate', 'startsAt', 'endsAt', 'city', 'state'] },
  },
  {
    id: 'question-no-state-change',
    description: 'The planner can answer without inventing plan fields.',
    currentDate: '2026-09-15',
    history: [],
    message: 'What should guests wear to an upscale casual mixer?',
    expectation: { action: 'continue' },
  },
  {
    id: 'security-advice',
    description: 'Security advice should reason from context and avoid unsupported requirements.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Do I need security for this?',
    expectation: { action: 'continue', messageIncludes: ['security'] },
  },
  {
    id: 'private-event',
    description: 'Visibility changes should be understood conversationally.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Keep this event private.',
    expectation: { fields: ['visibility'] },
  },
  {
    id: 'virtual-event',
    description: 'Virtual format should be structured without asking for a physical venue.',
    currentDate: '2026-09-15',
    history: [],
    message: 'This will be completely virtual on Zoom.',
    expectation: { fields: ['virtualEvent'] },
  },
  {
    id: 'hybrid-event',
    description: 'Hybrid event format should remain distinct from fully virtual.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Make it hybrid instead.',
    expectation: { fields: ['hybridEvent'] },
  },
  {
    id: 'no-forced-question',
    description: 'A direct recommendation can end without forcing another intake question.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Give me three ways to make this feel more premium.',
    expectation: { action: 'continue' },
  },
  {
    id: 'create-workspace-intent',
    description: 'Natural creation intent should map to workspace creation.',
    currentDate: '2026-09-15',
    history: [],
    message: 'That works. Go ahead and create the event workspace.',
    expectation: { action: 'create_workspace' },
  },
  {
    id: 'review-intent',
    description: 'Natural review language should map to review.',
    currentDate: '2026-09-15',
    history: [],
    message: 'What are we still missing?',
    expectation: { action: 'review' },
  },
  {
    id: 'vendor-reasoning',
    description: 'Vendor questions should be answered without assuming every event needs vendors.',
    currentDate: '2026-09-15',
    history: [],
    message: 'What vendors would I realistically need for a small movie night?',
    expectation: { action: 'continue', messageIncludes: ['vendor'] },
  },
  {
    id: 'staffing-reasoning',
    description: 'Staffing should scale with event context.',
    currentDate: '2026-09-15',
    history: [],
    message: 'How many people should I have helping if 120 guests show up?',
    expectation: { action: 'continue' },
  },
  {
    id: 'guest-flow',
    description: 'The planner should reason about check-in and guest flow.',
    currentDate: '2026-09-15',
    history: [],
    message: 'I do not want a line at check-in. How should we handle arrivals?',
    expectation: { action: 'continue' },
  },
  {
    id: 'contradictory-change',
    description: 'A correction should replace a prior date instead of retaining both.',
    currentDate: '2026-09-15',
    history: [{ role: 'user', text: 'October 31 works.' }],
    message: 'Actually move it to November 7.',
    expectation: { fields: ['plannerDate'] },
  },
  {
    id: 'tenant-neutrality',
    description: 'Business event advice must not inject outdoor-group assumptions.',
    currentDate: '2026-09-15',
    history: [],
    message: 'Help me plan an employee awards dinner.',
    expectation: { fields: ['title', 'category'], messageExcludes: ['camping', 'trail', 'paddle'] },
  },
  {
    id: 'unknown-concept',
    description: 'A new event concept should still be understood without a hard-coded category.',
    currentDate: '2026-09-15',
    history: [],
    message: 'I want to host a silent disco brunch for 80 people.',
    expectation: { fields: ['title', 'category', 'capacity'], messageExcludes: ['Networking Event'] },
  },
  {
    id: 'reason-from-constraint',
    description: 'The planner should connect a guest constraint to venue strategy.',
    currentDate: '2026-09-15',
    history: [],
    message: 'A lot of guests use wheelchairs. What should that change about the plan?',
    expectation: { action: 'continue', messageIncludes: ['access'] },
  },
];

export function scorePlannerEval(response: PlannerBrainResponse, expectation: PlannerEvalExpectation) {
  const fields = new Set(response.patches.map((patch) => patch.field));
  const lowerMessage = response.message.toLowerCase();
  const missingFields = (expectation.fields ?? []).filter((field) => !fields.has(field));
  const missingText = (expectation.messageIncludes ?? []).filter((text) => !lowerMessage.includes(text.toLowerCase()));
  const forbiddenText = (expectation.messageExcludes ?? []).filter((text) => lowerMessage.includes(text.toLowerCase()));
  const actionMismatch = expectation.action && response.action !== expectation.action ? `${response.action} != ${expectation.action}` : '';
  return {
    passed: !missingFields.length && !missingText.length && !forbiddenText.length && !actionMismatch,
    missingFields,
    missingText,
    forbiddenText,
    actionMismatch,
  };
}
