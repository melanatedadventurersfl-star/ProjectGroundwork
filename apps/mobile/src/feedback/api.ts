import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

export type FeedbackCategory = 'problem' | 'idea' | 'confusing' | 'design' | 'other';

export type TesterFeedback = {
  id: string;
  category: FeedbackCategory;
  message: string;
  screen_path: string | null;
  status: 'new' | 'reviewing' | 'planned' | 'fixed' | 'closed';
  created_at: string;
};

function getBuildNumber() {
  const androidCode = Constants.expoConfig?.android?.versionCode;
  if (androidCode != null) return String(androidCode);
  return Constants.expoConfig?.ios?.buildNumber ?? null;
}

export async function submitTesterFeedback(input: {
  category: FeedbackCategory;
  message: string;
  screenPath?: string | null;
}) {
  const message = input.message.trim();
  if (!message) throw new Error('Tell us what you noticed.');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');

  const { data, error } = await supabase
    .from('tester_feedback')
    .insert({
      user_id: userData.user.id,
      category: input.category,
      message,
      screen_path: input.screenPath ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      build_number: getBuildNumber(),
      platform: Platform.OS,
      device_context: {
        osVersion: String(Platform.Version),
        runtimeVersion: Constants.expoConfig?.runtimeVersion ?? null,
      },
    })
    .select('id,category,message,screen_path,status,created_at')
    .single();

  if (error) throw error;
  return data as TesterFeedback;
}

export async function getMyTesterFeedback() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');

  const { data, error } = await supabase
    .from('tester_feedback')
    .select('id,category,message,screen_path,status,created_at')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as TesterFeedback[];
}
