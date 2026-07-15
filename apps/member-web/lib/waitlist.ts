export type AccessStatus =
  | "waitlisted"
  | "under_review"
  | "approved"
  | "invited"
  | "activated"
  | "paused"
  | "declined";

export type WaitlistRegistrant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  experienceLevel: "new" | "beginner" | "comfortable" | "experienced";
  interests: string[];
  attendingSolo: boolean;
  referralSource?: string;
  notes?: string;
  communicationConsent: boolean;
  accessStatus: AccessStatus;
  cohort?: string;
  createdAt: string;
};

const STORAGE_KEY = "ma_waitlist_v01";

export function readWaitlist(): WaitlistRegistrant[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WaitlistRegistrant[];
  } catch {
    return [];
  }
}

export function addRegistrant(input: Omit<WaitlistRegistrant, "id" | "accessStatus" | "createdAt">) {
  const current = readWaitlist();
  const normalizedEmail = input.email.trim().toLowerCase();
  const duplicate = current.find((person) => person.email.toLowerCase() === normalizedEmail);
  if (duplicate) return { registrant: duplicate, duplicate: true };

  const registrant: WaitlistRegistrant = {
    ...input,
    email: normalizedEmail,
    id: crypto.randomUUID(),
    accessStatus: "waitlisted",
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([registrant, ...current]));
  return { registrant, duplicate: false };
}

export function updateAccessStatus(id: string, accessStatus: AccessStatus, cohort?: string) {
  const updated = readWaitlist().map((person) =>
    person.id === id ? { ...person, accessStatus, cohort: cohort ?? person.cohort } : person,
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
