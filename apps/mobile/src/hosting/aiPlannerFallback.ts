import type { AiPlanState, AiPlannerTurn } from './aiPlanner';

type PlannerHistory = { role: 'user' | 'assistant'; text: string }[];

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function titleCase(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeState(value: string) {
  const cleaned = value.trim();
  if (/^[A-Za-z]{2}$/.test(cleaned)) return cleaned.toUpperCase();
  return STATE_NAMES[cleaned.toLowerCase()] ?? '';
}

function parseCityState(value: string) {
  const cleaned = value.trim().replace(/^in\s+/i, '');
  const commaMatch = cleaned.match(/^(.+?),\s*(.+)$/);
  if (commaMatch) {
    const state = normalizeState(commaMatch[2] ?? '');
    return { city: titleCase(commaMatch[1] ?? ''), state };
  }
  return { city: titleCase(cleaned), state: '' };
}

function parseExactDate(value: string) {
  const text = value.trim();
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else {
    const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}|\d{2}))?\b/);
    if (slash) {
      month = Number(slash[1]); day = Number(slash[2]);
      year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : new Date().getFullYear();
    } else {
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const monthMatch = text.toLowerCase().match(new RegExp(`\\b(${months.join('|')})\\s+(\\d{1,2})(?:,?\\s+(20\\d{2}))?\\b`));
      if (monthMatch) {
        month = months.indexOf(monthMatch[1] ?? '') + 1;
        day = Number(monthMatch[2]);
        year = monthMatch[3] ? Number(monthMatch[3]) : new Date().getFullYear();
      }
    }
  }

  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function parseTime(value: string) {
  const text = value.trim().toLowerCase();
  const ampm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return '';
    if (ampm[3] === 'pm' && hour !== 12) hour += 12;
    if (ampm[3] === 'am' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return twentyFour ? `${Number(twentyFour[1]).toString().padStart(2, '0')}:${twentyFour[2]}` : '';
}

function dateTime(date: string, time: string) {
  return date && time ? `${date}T${time}` : '';
}

function defaultSafetyNotes(category?: string) {
  const notes = ['Confirm current venue rules and conditions before the event.', 'Share a clear emergency contact and check-in process with the host team.'];
  if (category === 'Paddling') notes.push('Confirm participant equipment, flotation-device and water-condition requirements before launch.');
  if (category === 'Hiking') notes.push('Confirm route conditions, expected difficulty and turnaround plan before the event.');
  if (category === 'Camping') notes.push('Confirm campground rules, emergency access and overnight weather procedures before arrival.');
  return notes;
}

function backupSuggestion(category?: string) {
  if (category === 'Hiking') return 'Use a shorter or alternate route, or reschedule if trail access or conditions are unsuitable. Confirm the final choice before notifying attendees.';
  if (category === 'Paddling') return 'Use a land-based alternate activity or reschedule if water or weather conditions are unsuitable. Confirm conditions before notifying attendees.';
  if (category === 'Camping') return 'Keep an alternate site or cancellation plan ready if campground access or weather changes. Confirm availability before notifying attendees.';
  return 'Choose an alternate location, adjusted format or reschedule plan if conditions change. Confirm the final option before notifying attendees.';
}

function buildGaps(plan: AiPlanState) {
  return [
    !plan.title ? 'Event idea or title' : '',
    !plan.city ? 'City' : '',
    !plan.state ? 'State' : '',
    !plan.capacity && !plan.attendanceRange ? 'Expected attendance' : '',
    !plan.startsAt ? 'Date and start time' : '',
    !plan.endsAt ? 'End time' : '',
    !plan.venueName ? 'Venue or meeting point' : '',
    !plan.meetingInstructions ? 'Arrival instructions' : '',
    plan.paid === undefined ? 'Admission model' : '',
    plan.paid && !plan.priceCents ? 'Ticket price' : '',
    !plan.backupPlan ? 'Backup plan' : '',
  ].filter(Boolean);
}

function taskPacksFor(plan: AiPlanState) {
  const packs = ['safety', 'communications', 'event_day'];
  if (plan.category === 'Paddling') packs.push('waivers', 'equipment');
  if (plan.category === 'Camping') packs.push('food', 'equipment');
  if (plan.paid || (plan.components ?? []).includes('marketing')) packs.push('marketing');
  return unique(packs);
}

function reviewMessage(plan: AiPlanState) {
  const attendance = plan.capacity ? `${plan.capacity} people` : plan.attendanceRange || 'open';
  const admission = plan.paid === undefined ? 'open' : plan.paid ? `$${((plan.priceCents ?? 0) / 100).toFixed(2)}` : 'Free';
  return `Plan check: ${plan.title || 'Untitled event'} in ${[plan.city, plan.state].filter(Boolean).join(', ') || 'location open'}, attendance ${attendance}, admission ${admission}. I’ll keep any unresolved items open instead of guessing.`;
}

export function buildClientPlannerFallback(message: string, current: AiPlanState, history: PlannerHistory = []): AiPlannerTurn {
  void history;
  const lower = message.toLowerCase().trim();
  const plan: AiPlanState = {
    ...current,
    components: Array.isArray(current.components) ? [...current.components] : [],
    requirements: Array.isArray(current.requirements) ? [...current.requirements] : [],
    safetyNotes: Array.isArray(current.safetyNotes) ? [...current.safetyNotes] : [],
  };

  const natureWalk = lower.includes('nature walk') || lower.includes('nature hike') || lower.includes('hike');
  const paddling = lower.includes('kayak') || lower.includes('paddle') || lower.includes('canoe');
  const camping = lower.includes('camping') || lower.includes('campout') || lower.includes('camp out');

  const inlineLocation = lower.match(/\bin\s+([a-z .'-]+?)(?:,\s*([a-z]{2}|[a-z ]+))?(?:\s+(?:for|with|on|at|next|this)\b|$)/i);
  if (!plan.city && inlineLocation) {
    const parsed = parseCityState(`${inlineLocation[1] ?? ''}${inlineLocation[2] ? `, ${inlineLocation[2]}` : ''}`);
    plan.city = parsed.city || plan.city;
    plan.state = parsed.state || plan.state;
  }

  if (!plan.title && natureWalk) {
    plan.title = 'Nature Walk';
    plan.summary = 'A group nature walk.';
    plan.description = plan.summary;
    plan.category = 'Hiking';
    plan.difficulty = 'easy';
    plan.components = unique([...(plan.components ?? []), 'venue', 'schedule', 'activities', 'safety', 'communications', 'team']);
  } else if (!plan.title && paddling) {
    plan.title = 'Social Paddle';
    plan.summary = 'A relaxed group paddle.';
    plan.description = plan.summary;
    plan.category = 'Paddling';
    plan.difficulty = 'easy';
    plan.components = unique([...(plan.components ?? []), 'venue', 'safety', 'equipment', 'tickets', 'communications', 'team']);
  } else if (!plan.title && camping) {
    plan.title = 'Camping Trip';
    plan.summary = 'A group camping trip.';
    plan.description = plan.summary;
    plan.category = 'Camping';
    plan.difficulty = 'easy';
    plan.components = unique([...(plan.components ?? []), 'venue', 'schedule', 'activities', 'food', 'equipment', 'safety', 'communications', 'team']);
  }

  if (plan.title && !plan.safetyNotes?.length) plan.safetyNotes = defaultSafetyNotes(plan.category);

  let immediateMessage = '';
  let immediateOptions: string[] | null = null;

  if (plan.plannerStep === 'city') {
    const parsed = parseCityState(message);
    if (parsed.city) plan.city = parsed.city;
    if (parsed.state) plan.state = parsed.state;
    plan.plannerStep = plan.state ? undefined : 'state';
  } else if (plan.plannerStep === 'state') {
    const state = normalizeState(message);
    if (state) {
      plan.state = state;
      plan.plannerStep = undefined;
    } else {
      immediateMessage = 'Enter a state name or two-letter abbreviation, such as Florida or FL.';
      immediateOptions = [];
    }
  } else if (plan.plannerStep === 'venue' || plan.plannerStep === 'venue_choice') {
    if (lower !== 'i know the location' && lower !== 'recommend locations' && lower !== 'skip for now') {
      plan.venueName = message.trim();
      plan.plannerStep = undefined;
    }
  } else if (plan.plannerStep === 'arrival') {
    if (lower !== 'recommend for me' && lower !== 'skip for now') {
      plan.meetingInstructions = message.trim();
      plan.plannerStep = undefined;
    }
  } else if (plan.plannerStep === 'date') {
    const parsedDate = parseExactDate(message);
    if (parsedDate) {
      plan.plannerDate = parsedDate;
      const time = parseTime(message);
      if (time) {
        plan.startsAt = dateTime(parsedDate, time);
        plan.plannerStep = 'end_time';
      } else {
        plan.plannerStep = 'start_time';
      }
    } else {
      immediateMessage = 'Give me the exact date, for example October 17, 2026 or 10/17/2026.';
      immediateOptions = ['Not sure yet'];
    }
  } else if (plan.plannerStep === 'start_time') {
    const time = parseTime(message);
    if (time && plan.plannerDate) {
      plan.startsAt = dateTime(plan.plannerDate, time);
      plan.plannerStep = 'end_time';
    } else {
      immediateMessage = 'What start time should I use? Include AM or PM, for example 10 AM.';
      immediateOptions = [];
    }
  } else if (plan.plannerStep === 'end_time') {
    const time = parseTime(message);
    if (time && plan.plannerDate) {
      const candidate = dateTime(plan.plannerDate, time);
      if (!plan.startsAt || new Date(candidate).getTime() > new Date(plan.startsAt).getTime()) {
        plan.endsAt = candidate;
        plan.plannerStep = undefined;
      } else {
        immediateMessage = 'The end time needs to be after the start time. What end time should I use?';
        immediateOptions = [];
      }
    } else {
      immediateMessage = 'What end time should I use? Include AM or PM.';
      immediateOptions = [];
    }
  } else if (plan.plannerStep === 'price') {
    const price = message.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
    if (price) {
      plan.priceCents = Math.round(Number(price[1]) * 100);
      plan.plannerStep = undefined;
    } else {
      immediateMessage = 'What should one general-admission ticket cost?';
      immediateOptions = [];
    }
  } else if (plan.plannerStep === 'backup') {
    if (lower !== 'recommend a backup' && lower !== 'skip for now') {
      plan.backupPlan = message.trim();
      plan.plannerStep = undefined;
    }
  }

  const capacityMatch = lower.match(/\b(\d{1,4})\s*(?:people|guests|attendees|persons)?\b/);
  if (!plan.capacity && capacityMatch && !lower.includes('-') && !lower.includes('–') && !lower.includes('+')) plan.capacity = Number(capacityMatch[1]);
  if (!plan.attendanceRange && (lower.includes('10–25') || lower.includes('10-25'))) plan.attendanceRange = '10–25';
  if (!plan.attendanceRange && (lower.includes('25–50') || lower.includes('25-50'))) plan.attendanceRange = '25–50';
  if (!plan.attendanceRange && lower.includes('10 or fewer')) plan.attendanceRange = '10 or fewer';
  if (!plan.attendanceRange && lower.includes('50+')) plan.attendanceRange = '50+';

  const changeCity = message.match(/(?:change|set|make)\s+(?:the\s+)?city\s+(?:to\s+)?(.+)/i);
  if (changeCity) {
    const parsed = parseCityState(changeCity[1] ?? '');
    plan.city = parsed.city;
    plan.state = parsed.state || undefined;
  }
  const changeCapacity = message.match(/(?:change|set|make).{0,12}(?:capacity|attendance).{0,8}(\d{1,4})/i);
  if (changeCapacity) {
    plan.capacity = Number(changeCapacity[1]);
    plan.attendanceRange = undefined;
  }

  if (lower === 'this weekend' || lower === 'next weekend' || lower === 'not sure yet') {
    if (!plan.startsAt && plan.plannerStep !== 'state') {
      plan.datePreference = lower === 'not sure yet' ? 'Open' : titleCase(lower);
      plan.plannerStep = undefined;
    }
  }
  if (lower === 'i have a date' || lower === 'set date') {
    plan.plannerStep = 'date';
    immediateMessage = 'What exact date should I use?';
    immediateOptions = ['Not sure yet'];
  }
  if (lower === 'i know the location') {
    plan.plannerStep = 'venue';
    immediateMessage = 'What venue, park, trailhead or meeting point do you want to use?';
    immediateOptions = [];
  }
  if (lower === 'recommend locations') {
    if (!plan.city) {
      plan.plannerStep = 'city';
      immediateMessage = 'What city should I search for location recommendations in?';
      immediateOptions = [];
    } else if (!plan.state) {
      plan.plannerStep = 'state';
      immediateMessage = `What state is ${plan.city} in? You can enter the state name or two-letter abbreviation.`;
      immediateOptions = [];
    } else {
      plan.plannerStep = 'venue_choice';
      immediateMessage = `I’ll check verified location options in ${plan.city}, ${plan.state}.`;
      immediateOptions = ['I know the location', 'Skip for now'];
    }
  }
  if (lower === 'recommend for me' && !plan.meetingInstructions) {
    plan.meetingInstructions = `Meet at ${plan.venueName || 'the confirmed meeting point'} 15 minutes before the event start. Confirm parking, access details and the exact landmark before sending this to attendees.`;
    plan.plannerStep = undefined;
  }
  if (lower === 'tickets') {
    immediateMessage = 'Will this event be free or paid?';
    immediateOptions = ['Free', 'Paid'];
  }
  if (lower === 'free') {
    plan.paid = false;
    plan.priceCents = 0;
    plan.components = unique([...(plan.components ?? []), 'tickets']);
  }
  if (lower === 'paid') {
    plan.paid = true;
    plan.components = unique([...(plan.components ?? []), 'tickets']);
    plan.plannerStep = 'price';
    immediateMessage = 'What should one general-admission ticket cost?';
    immediateOptions = [];
  }
  if (lower === 'safety') {
    plan.safetyNotes = plan.safetyNotes?.length ? plan.safetyNotes : defaultSafetyNotes(plan.category);
    plan.components = unique([...(plan.components ?? []), 'safety']);
  }
  if (lower === 'communications') plan.components = unique([...(plan.components ?? []), 'communications']);
  if (lower === 'activities') plan.components = unique([...(plan.components ?? []), 'activities']);
  if (lower === 'recommend a backup') {
    plan.backupPlan = backupSuggestion(plan.category);
    plan.plannerStep = undefined;
  }
  if (lower === 'skip for now') {
    if (plan.plannerStep === 'venue' || plan.plannerStep === 'venue_choice' || !plan.venueName) plan.venueDeferred = true;
    else if (plan.plannerStep === 'arrival' || !plan.meetingInstructions) plan.arrivalDeferred = true;
    else if (plan.plannerStep === 'backup' || !plan.backupPlan) plan.backupDeferred = true;
    plan.plannerStep = undefined;
  }

  let nextMessage = immediateMessage;
  let options = immediateOptions ?? [];

  if (!nextMessage) {
    if (!plan.title) {
      nextMessage = 'What do you want to host?';
      options = ['Nature walk', 'Camping trip', 'Social paddle'];
    } else if (!plan.city) {
      plan.plannerStep = 'city';
      nextMessage = 'What city do you want to host it in?';
      options = [];
    } else if (!plan.state) {
      plan.plannerStep = 'state';
      nextMessage = `What state is ${plan.city} in? You can enter the state name or two-letter abbreviation.`;
      options = [];
    } else if (!plan.capacity && !plan.attendanceRange) {
      nextMessage = `${plan.title} is taking shape in ${plan.city}. About how many people are you planning for?`;
      options = ['10 or fewer', '10–25', '25–50', '50+', 'Not sure yet'];
    } else if (!plan.startsAt && !plan.datePreference) {
      nextMessage = 'What date are you considering? You can give me an exact date, choose a weekend, or leave it open for now.';
      options = ['This weekend', 'Next weekend', 'I have a date', 'Not sure yet'];
    } else if (!plan.endsAt && plan.startsAt) {
      plan.plannerStep = 'end_time';
      nextMessage = 'What time should the event end?';
      options = [];
    } else if (!plan.venueName && !plan.venueDeferred) {
      nextMessage = 'Do you already have a venue or meeting point, or should I recommend verified options?';
      options = ['Recommend locations', 'I know the location', 'Skip for now'];
    } else if (!plan.meetingInstructions && !plan.arrivalDeferred) {
      plan.plannerStep = 'arrival';
      nextMessage = 'What should guests know about arrival, parking or check-in?';
      options = ['Recommend for me', 'Skip for now'];
    } else if (plan.paid === undefined) {
      nextMessage = 'Will this event be free or paid?';
      options = ['Free', 'Paid'];
    } else if (plan.paid && !plan.priceCents) {
      plan.plannerStep = 'price';
      nextMessage = 'What should one general-admission ticket cost?';
      options = [];
    } else if (!plan.backupPlan && !plan.backupDeferred) {
      plan.plannerStep = 'backup';
      nextMessage = 'What is the backup plan if conditions, access or weather change?';
      options = ['Recommend a backup', 'Skip for now'];
    } else if (lower === 'review plan') {
      nextMessage = reviewMessage(plan);
      options = ['Set date', 'Location', 'Tickets', 'Safety', 'Communications'];
    } else {
      nextMessage = 'The plan is taking shape. What do you want to work on next?';
      options = ['Review plan', 'Set date', 'Location', 'Tickets', 'Safety', 'Communications'];
    }
  }

  if (lower === 'location' && !plan.venueName) {
    nextMessage = 'Do you already have a venue or meeting point, or should I recommend verified options?';
    options = ['Recommend locations', 'I know the location', 'Skip for now'];
  }

  const gaps = buildGaps(plan);
  const readiness = Math.max(10, Math.min(100, 100 - gaps.length * 9));

  return {
    message: nextMessage,
    plan,
    readiness,
    stage: readiness >= 95 ? 'ready' : readiness >= 75 ? 'confidence' : readiness >= 35 ? 'momentum' : 'possibility',
    gaps,
    options,
    recommendation: null,
    taskPacks: taskPacksFor(plan),
  };
}
