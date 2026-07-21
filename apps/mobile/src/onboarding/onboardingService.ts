import { supabase } from '../lib/supabase';
import type { OnboardingForm } from './types';

export async function loadOnboardingProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'first_name,last_name,display_name,home_city,home_state,discovery_radius_miles,experience_level,interests,communication_preferences,accessibility_needs,dietary_needs,support_notes,onboarding_step,onboarding_completed_at',
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
      communication_preferences: {
        push: form.pushEnabled,
        email: form.emailEnabled,
        sms: form.smsEnabled,
      },
      accessibility_needs: form.accessibilityNeeds.trim() || null,
      dietary_needs: form.dietaryNeeds.trim() || null,
      support_notes: form.supportNotes.trim() || null,
      onboarding_step: step,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function completeOnboarding(form: OnboardingForm) {
  const { error } = await supabase.rpc('complete_member_onboarding', {
    p_first_name: form.firstName,
    p_last_name: form.lastName,
    p_display_name: form.displayName,
    p_home_city: form.homeCity,
    p_home_state: form.homeState,
    p_discovery_radius_miles: form.discoveryRadiusMiles,
    p_experience_level: form.experienceLevel,
    p_interests: form.interests,
    p_communication_preferences: {
      push: form.pushEnabled,
      email: form.emailEnabled,
      sms: form.smsEnabled,
    },
    p_accessibility_needs: form.accessibilityNeeds,
    p_dietary_needs: form.dietaryNeeds,
    p_support_notes: form.supportNotes,
    p_household_name: form.householdName || null,
  });

  if (error) throw error;
}
