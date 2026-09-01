import { supabase } from '../lib/supabase';
import type { OnboardingForm } from './types';

function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return digits.length === 10 ? `+1${digits}` : null;
}

function communicationPreferences(form: OnboardingForm) {
  return {
    push: form.pushEnabled,
    email: form.emailEnabled,
    sms: form.smsEnabled,
    discovery_intents: form.intents,
    adventure_preferences: form.adventurePreferences,
    travel_range: form.travelRange,
    location_permission_status: form.locationPermissionStatus,
    onboarding_version: 3,
  };
}

export async function loadOnboardingProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'first_name,last_name,display_name,avatar_url,home_city,home_state,discovery_radius_miles,experience_level,interests,communication_preferences,phone_number,sms_consent_at,accessibility_needs,dietary_needs,support_notes,onboarding_step,onboarding_completed_at',
    )
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function saveOnboardingProgress(
  userId: string,
  step: number,
  form: OnboardingForm,
) {
  const phoneNumber = normalizeUsPhone(form.phoneNumber);
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: form.firstName.trim() || null,
      last_name: form.lastName.trim() || null,
      display_name: form.displayName.trim() || null,
      home_city: form.homeCity.trim() || null,
      home_state: form.homeState.trim() || null,
      discovery_radius_miles: form.discoveryRadiusMiles,
      experience_level: form.experienceLevel,
      interests: form.interests,
      communication_preferences: communicationPreferences(form),
      phone_number: phoneNumber,
      sms_consent_at: form.smsEnabled && form.smsConsent ? new Date().toISOString() : null,
      accessibility_needs: form.accessibilityNeeds.trim() || null,
      dietary_needs: form.dietaryNeeds.trim() || null,
      support_notes: form.supportNotes.trim() || null,
      onboarding_step: step,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function completeOnboarding(form: OnboardingForm) {
  const { error } = await supabase.rpc('complete_member_onboarding_v2', {
    p_first_name: form.firstName,
    p_last_name: form.lastName,
    p_display_name: form.displayName,
    p_home_city: form.homeCity,
    p_home_state: form.homeState,
    p_discovery_radius_miles: form.discoveryRadiusMiles,
    p_experience_level: form.experienceLevel,
    p_interests: form.interests,
    p_communication_preferences: communicationPreferences(form),
    p_phone_number: normalizeUsPhone(form.phoneNumber),
    p_sms_consent: form.smsEnabled && form.smsConsent,
    p_accessibility_needs: form.accessibilityNeeds,
    p_dietary_needs: form.dietaryNeeds,
    p_support_notes: form.supportNotes,
    p_household_action: form.householdMode,
    p_household_name: form.householdMode === 'create' ? form.householdName : null,
    p_household_invite_code: form.householdMode === 'join' ? form.householdInviteCode : null,
  });

  if (error) throw error;
}
