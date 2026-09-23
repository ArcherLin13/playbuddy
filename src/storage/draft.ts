import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PracticeSession } from '../types';

const KEY = 'playbuddy.practiceDraft.v1';

/** Unfinished bout checkpointed while monitoring (survives process kill). */
export type PracticeDraft = PracticeSession & {
  sessionId: string;
  savedAt: number;
};

export async function loadDraft(): Promise<PracticeDraft | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PracticeDraft;
    if (!parsed?.startedAt || typeof parsed.effectiveMs !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: PracticeDraft): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/** Load draft and remove it (caller persists into history). */
export async function takeDraft(): Promise<PracticeDraft | null> {
  const draft = await loadDraft();
  if (draft) await clearDraft();
  return draft;
}
