export const INTEREST_OPTIONS = [
  'Hiking',
  'Camping',
  'Travel',
  'Overlanding',
  'Fishing',
  'Cycling',
  'Climbing',
  'Water adventures',
  'Photography',
  'Family adventures',
  'Food and culture',
  'Wellness outdoors',
  'Beginner-friendly experiences',
] as const;

export const INTENT_OPTIONS = [
  'Find people to adventure with',
  'Discover things happening nearby',
  'Learn how to get outdoors',
  'Find groups and communities',
  'Share my adventures',
  'Explore new places',
] as const;

export type ExperienceLevel = 'new' | 'beginner' | 'intermediate' | 'experienced';
export type HouseholdMode = 'skip' | 'create' | 'join';

export type OnboardingForm = {
  firstName: string;
  lastName: string;
  displayName: string;
  homeCity: string;
  homeState: string;
  discoveryRadiusMiles: number;
  experienceLevel: ExperienceLevel;
  interests: string[];
  intents: string[];
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  phoneNumber: string;
  smsConsent: boolean;
  accessibilityNeeds: string;
  dietaryNeeds: string;
  supportNotes: string;
  householdMode: HouseholdMode;
  householdName: string;
  householdInviteCode: string;
};

export const INITIAL_ONBOARDING_FORM: OnboardingForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  homeCity: '',
  homeState: '',
  discoveryRadiusMiles: 50,
  experienceLevel: 'new',
  interests: [],
  intents: [],
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  phoneNumber: '',
  smsConsent: false,
  accessibilityNeeds: '',
  dietaryNeeds: '',
  supportNotes: '',
  householdMode: 'skip',
  householdName: '',
  householdInviteCode: '',
};
