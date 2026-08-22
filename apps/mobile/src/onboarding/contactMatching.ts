import * as Contacts from 'expo-contacts/legacy';

import { supabase } from '../lib/supabase';

export type ContactMatch = {
  id: string;
  display_name: string | null;
  username: string | null;
  home_city: string | null;
  home_state: string | null;
  avatar_url: string | null;
  interests: string[] | null;
};

export type ContactMatchResult = {
  permission: 'granted' | 'denied';
  matches: ContactMatch[];
  contactCount: number;
};

function normalizeUsPhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export async function findContactMatches(): Promise<ContactMatchResult> {
  const permission = await Contacts.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return { permission: 'denied', matches: [], contactCount: 0 };
  }

  const result = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
  const normalized = Array.from(new Set(
    result.data.flatMap((contact) => contact.phoneNumbers ?? [])
      .map((phone) => normalizeUsPhone(phone.number))
      .filter((phone): phone is string => Boolean(phone)),
  ));

  if (!normalized.length) {
    return { permission: 'granted', matches: [], contactCount: result.data.length };
  }

  const { data, error } = await supabase.rpc('match_contacts_by_phone', { p_phone_numbers: normalized });
  if (error) throw error;

  return {
    permission: 'granted',
    matches: (data ?? []) as ContactMatch[],
    contactCount: result.data.length,
  };
}
