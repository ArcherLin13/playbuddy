import AsyncStorage from '@react-native-async-storage/async-storage';

const HOME_KEY = 'playbuddy.syncHomeId.v1';

/** 12-char home code, shown as XXXX-XXXX-XXXX */
export function formatHomeCode(raw: string): string {
  const s = raw.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const parts = [s.slice(0, 4), s.slice(4, 8), s.slice(8, 12)].filter(Boolean);
  return parts.join('-').toUpperCase();
}

export function normalizeHomeCode(input: string): string {
  return input.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12);
}

export function createHomeCode(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function loadHomeId(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(HOME_KEY);
  if (!raw) return null;
  const n = normalizeHomeCode(raw);
  return n.length >= 12 ? n : null;
}

export async function saveHomeId(code: string): Promise<string> {
  const n = normalizeHomeCode(code);
  if (n.length < 12) throw new Error('同步码需要 12 位');
  await AsyncStorage.setItem(HOME_KEY, n);
  return n;
}

export async function clearHomeId(): Promise<void> {
  await AsyncStorage.removeItem(HOME_KEY);
}
