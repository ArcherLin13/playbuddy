import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'practice';
const RUNNING_ID = 'practice-running';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '练琴提醒',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
  });
}

export async function ensureNotifyPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function notifyPracticeStarted(): Promise<void> {
  const ok = await ensureNotifyPermission();
  if (!ok) return;

  await Notifications.dismissNotificationAsync(RUNNING_ID).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    identifier: RUNNING_ID,
    content: {
      title: '练琴伙伴',
      body: '开始练琴啦，专心拉琴～',
      sound: true,
      sticky: Platform.OS === 'android',
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

export async function notifyPracticeStopped(effectiveMs: number): Promise<void> {
  const ok = await ensureNotifyPermission();
  await Notifications.dismissNotificationAsync(RUNNING_ID).catch(() => undefined);
  if (!ok) return;

  const minutes = Math.max(0, Math.round(effectiveMs / 60_000));
  const body =
    minutes > 0 ? `本次有效练琴约 ${minutes} 分钟，已保存` : '本次练习已结束并保存';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '练琴结束',
      body,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}
