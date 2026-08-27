import Storage from 'expo-sqlite/kv-store';

import type { MemberGuideResult } from './assistant';

export type AskGoSavedExchange = {
  id: string;
  query: string;
  result: MemberGuideResult | null;
  error: string;
  loading: false;
};

export type AskGoHistoryThread = {
  id: string;
  cityKey: string;
  cityName: string;
  title: string;
  updatedAt: string;
  exchanges: AskGoSavedExchange[];
};

const HISTORY_KEY = 'ask-go:conversation-history:v1';
const MAX_THREADS = 12;

export async function loadAskGoHistory(): Promise<AskGoHistoryThread[]> {
  try {
    const raw = await Storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AskGoHistoryThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAskGoThread(thread: AskGoHistoryThread) {
  const current = await loadAskGoHistory();
  const next = [
    { ...thread, updatedAt: new Date().toISOString() },
    ...current.filter((item) => item.id !== thread.id),
  ].slice(0, MAX_THREADS);
  try {
    await Storage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // History should never block Ask Go.
  }
}

export async function getAskGoThread(id: string) {
  const current = await loadAskGoHistory();
  return current.find((thread) => thread.id === id) ?? null;
}
