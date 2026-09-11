import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = 'playbuddy.parentPin.v1';
export const DEFAULT_PARENT_PIN = '1234';

export async function loadParentPin(): Promise<string> {
  const raw = await AsyncStorage.getItem(PIN_KEY);
  if (!raw || raw.length < 4) return DEFAULT_PARENT_PIN;
  return raw;
}

export async function saveParentPin(pin: string): Promise<void> {
  const cleaned = pin.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length < 4) throw new Error('密码至少 4 位数字');
  await AsyncStorage.setItem(PIN_KEY, cleaned);
}

export async function verifyParentPin(input: string): Promise<boolean> {
  const pin = await loadParentPin();
  return input.replace(/\D/g, '') === pin;
}
