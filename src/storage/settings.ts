import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, type AppSettings } from '../types';

const KEY = 'playbuddy.settings.v1';

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const dailyTargetMinutes =
      typeof parsed.dailyTargetMinutes === 'number' && parsed.dailyTargetMinutes > 0
        ? Math.round(parsed.dailyTargetMinutes)
        : DEFAULT_SETTINGS.dailyTargetMinutes;
    const dailyMoneyCap =
      typeof parsed.dailyMoneyCap === 'number' && parsed.dailyMoneyCap >= 0
        ? parsed.dailyMoneyCap
        : DEFAULT_SETTINGS.dailyMoneyCap;
    const moneyMinMinutes =
      typeof parsed.moneyMinMinutes === 'number' && parsed.moneyMinMinutes >= 0
        ? Math.round(parsed.moneyMinMinutes)
        : DEFAULT_SETTINGS.moneyMinMinutes;
    const waterFullMinutes =
      typeof parsed.waterFullMinutes === 'number' && parsed.waterFullMinutes > 0
        ? Math.round(parsed.waterFullMinutes)
        : DEFAULT_SETTINGS.waterFullMinutes;
    return {
      instrument: 'violin',
      sensitivity: DEFAULT_SETTINGS.sensitivity,
      coachEnabled:
        typeof parsed.coachEnabled === 'boolean' ? parsed.coachEnabled : DEFAULT_SETTINGS.coachEnabled,
      outputVolume:
        typeof parsed.outputVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.outputVolume))
          : DEFAULT_SETTINGS.outputVolume,
      dailyTargetMinutes: Math.max(5, Math.min(180, dailyTargetMinutes)),
      dailyMoneyCap: Math.max(0, Math.min(100, Math.round(dailyMoneyCap * 10) / 10)),
      moneyMinMinutes: Math.max(5, Math.min(180, moneyMinMinutes)),
      waterFullMinutes: Math.max(10, Math.min(180, waterFullMinutes)),
      displayName:
        typeof parsed.displayName === 'string' ? parsed.displayName.trim().slice(0, 24) : '',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}
