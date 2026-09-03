import { supabase } from '../lib/supabase';
import type { EventDraft } from './creation';

export type EventContentSectionType = 'schedule' | 'meals' | 'policies' | 'operations' | 'gear' | 'guest_info' | 'marketing';

export type EventContent = {
  schedule: EventDraft['schedule'];
  meals: string[];
  policies: string[];
  operations: string[];
  gear: string[];
  guestInfo: string[];
  marketing: string[];
};

const emptyContent = (): EventContent => ({
  schedule: [],
  meals: [],
  policies: [],
  operations: [],
  gear: [],
  guestInfo: [],
  marketing: [],
});

const fieldForSection: Record<EventContentSectionType, keyof EventContent> = {
  schedule: 'schedule',
  meals: 'meals',
  policies: 'policies',
  operations: 'operations',
  gear: 'gear',
  guest_info: 'guestInfo',
  marketing: 'marketing',
};

export function contentFromDraft(draft: EventDraft): EventContent {
  return {
    schedule: draft.schedule ?? [],
    meals: draft.meals ?? [],
    policies: draft.policies ?? [],
    operations: draft.operations ?? [],
    gear: draft.gear ?? [],
    guestInfo: draft.guestInfo ?? [],
    marketing: draft.marketing ?? [],
  };
}

export async function loadEventContent(adventureId: string): Promise<EventContent> {
  const { data, error } = await supabase
    .from('host_event_content_sections')
    .select('section_type,content')
    .eq('adventure_id', adventureId);
  if (error) throw error;

  const result = emptyContent();
  for (const row of data ?? []) {
    const sectionType = row.section_type as EventContentSectionType;
    const field = fieldForSection[sectionType];
    if (!field || !Array.isArray(row.content)) continue;
    (result as any)[field] = row.content;
  }
  return result;
}

export async function saveEventContentSections(input: {
  adventureId: string;
  ownerProfileId: string;
  importId?: string;
  content: EventContent;
  sections?: EventContentSectionType[];
}) {
  const sections = input.sections ?? (Object.keys(fieldForSection) as EventContentSectionType[]);
  const rows = sections.flatMap((sectionType) => {
    const field = fieldForSection[sectionType];
    const content = input.content[field] as unknown[];
    if (!Array.isArray(content) || content.length === 0) return [];
    return [{
      owner_profile_id: input.ownerProfileId,
      adventure_id: input.adventureId,
      section_type: sectionType,
      content,
      source_import_id: input.importId ?? null,
      updated_at: new Date().toISOString(),
    }];
  });
  if (!rows.length) return;
  const { error } = await supabase
    .from('host_event_content_sections')
    .upsert(rows, { onConflict: 'adventure_id,section_type' });
  if (error) throw error;
}
