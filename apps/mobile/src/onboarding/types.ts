export const INTEREST_OPTIONS = [
  'Camping',
  'Hiking',
  'Water adventures',
  'Road trips',
  'Food and culture',
  'Family adventures',
  'Wellness outdoors',
  'Beginner-friendly experiences',
] as const;

export type ExperienceLevel = 'new' | 'beginner' | 'intermediate' | 'experienced';

export type OnboardingForm = {
  firstName: string;
  lastName: string;
  displayName: string;
  homeCity: string;
  homeState: string;
  discoveryRadiusMiles: number;
  experienceLevel: ExperienceLevel;
  interests: string[];
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  accessibilityNeeds: string;
  dietaryNeeds: string;
  supportNotes: string;
  householdName: string;
};

export const INITIAL_ONBOARDING_FORM: OnboardingForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  homeCity: '',
  homeState: 'FL',
  discoveryRadiusMiles: 50,
  experienceLevel: 'new',
  interests: [],
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  accessibilityNeeds: '',
  dietaryNeeds: '',
  supportNotes: '',
  householdName: '',
};
