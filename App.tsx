import { useEffect, useState } from 'react';
import { Alert, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { usePracticeMonitor } from './src/hooks/usePracticeMonitor';
import { HomeScreen } from './src/screens/HomeScreen';
import { HistoryScreen, type HistoryPath } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import {
  attachRewards,
  dayKey,
  daySessionId,
  dayEffectiveMs,
  deleteSession,
  loadSessions,
  replaceSessions,
  rescoreAllSessions,
  saveSession,
  settlePendingSessions,
} from './src/storage/history';
import { clearDraft, takeDraft } from './src/storage/draft';
import { loadSettings, saveSettings } from './src/storage/settings';
import { setOutputVolume } from './src/audio/audioMode';
import { shareDayReport } from './src/history/shareReport';
import { ShareCardHost } from './src/history/ShareCardHost';
import { colors } from './src/theme';
import { DEFAULT_SETTINGS, type AppSettings, type PracticeSession } from './src/types';
import { formatDate } from './src/format';
import { sumPendingYuan, sumSettledYuan } from './src/score/dayMoney';
import { isFirebaseConfigured, isGoogleAuthConfigured } from './src/sync/firebaseConfig';
import {
  loadAccountDisplayName,
  registerWithEmail,
  saveAccountDisplayName,
  signInWithEmail,
  signOutAccount,
  subscribeAuth,
} from './src/sync/firebase';
import { completeGoogleSignIn, useGoogleAuthRequest } from './src/sync/googleAuth';
import { deleteCloudSession, syncPracticeRecords } from './src/sync/practiceSync';
import { notifyPracticeStarted, notifyPracticeStopped } from './src/notify/practiceNotify';

type Screen =
  | { name: 'home' }
  | { name: 'summary'; session: PracticeSession }
  | { name: 'history' }
  | { name: 'detail'; session: PracticeSession }
  | { name: 'settings' };

function applyRewards(list: PracticeSession[], s: AppSettings): PracticeSession[] {
  return list.map((sess) =>
    attachRewards(sess, s.dailyTargetMinutes, s.dailyMoneyCap, s.moneyMinMinutes, list)
  );
}

function authErrorMessage(e: unknown): string {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
  if (code.includes('email-already-in-use')) return '该邮箱已注册，请直接登录';
  if (code.includes('invalid-email')) return '邮箱格式不正确';
  if (code.includes('weak-password')) return '密码至少 6 位';
  if (code.includes('user-not-found') || code.includes('wrong-password'))
    return '邮箱或密码错误';
  if (code.includes('invalid-credential')) return '登录凭证无效（邮箱密码错误，或 Google Client ID 不对）';
  if (code.includes('invalid-id-token')) return 'Google 凭证无效，请检查 Web Client ID';
  if (code.includes('operation-not-allowed'))
    return '请在 Firebase 控制台启用对应登录方式（Google 或 电子邮件/密码）';
  if (code.includes('network-request-failed')) return '网络异常，请稍后重试';
  return e instanceof Error ? e.message : '操作失败';
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [historyPath, setHistoryPath] = useState<HistoryPath>({});
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const monitor = usePracticeMonitor(settings);
  const { ready: googleReady, promptAsync } = useGoogleAuthRequest();

  const runSync = async (local: PracticeSession[], s: AppSettings): Promise<PracticeSession[]> => {
    const result = await syncPracticeRecords(local);
    const withRewards = applyRewards(result.sessions, s);
    const saved = await replaceSessions(withRewards);
    await syncPracticeRecords(saved);
    return saved;
  };

  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      setSettings(s);
      setOutputVolume(s.outputVolume);
      const rescored = await rescoreAllSessions(
        s.dailyTargetMinutes,
        s.dailyMoneyCap,
        s.moneyMinMinutes
      );

      // Recover bout that was interrupted by kill / swipe-away.
      const draft = await takeDraft();
      if (draft && draft.effectiveMs >= 1_500) {
        try {
          const day = rescored.find(
            (s) => dayKey(s.startedAt) === dayKey(draft.startedAt)
          );
          // Already merged by a completed stop that failed to clear the draft.
          const alreadySaved =
            !!day &&
            (day.updatedAt ?? 0) >= draft.savedAt &&
            day.effectiveMs >= draft.effectiveMs - 500;
          if (!alreadySaved) {
            const recovered = await saveSession(
              {
                ...draft,
                boutCount: 1,
              },
              s.dailyTargetMinutes,
              s.dailyMoneyCap,
              s.moneyMinMinutes
            );
            setSessions(recovered);
            Alert.alert(
              '已恢复练习',
              `上次未正常结束的练琴已保存，有效时长 ${Math.round(draft.effectiveMs / 1000)} 秒。`
            );
            return;
          }
        } catch {
          /* fall through to rescored */
        }
      }
      setSessions(rescored);
    })();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return subscribeAuth((user) => {
      setAccountEmail(user?.email ?? null);
      if (!user) return;
      void (async () => {
        try {
          const s = await loadSettings();
          const name = await loadAccountDisplayName(user);
          const nextSettings =
            name && name !== s.displayName ? { ...s, displayName: name } : s;
          if (nextSettings !== s) {
            setSettings(nextSettings);
            await saveSettings(nextSettings);
          }
          const local = await loadSessions();
          const saved = await runSync(local, nextSettings);
          setSessions(saved);
        } catch {
          /* offline */
        }
      })();
    });
  }, []);

  const updateSettings = (next: AppSettings) => {
    const normalized = {
      ...next,
      instrument: 'violin' as const,
      sensitivity: DEFAULT_SETTINGS.sensitivity,
    };
    const rewardChanged =
      normalized.dailyTargetMinutes !== settings.dailyTargetMinutes ||
      normalized.dailyMoneyCap !== settings.dailyMoneyCap ||
      normalized.moneyMinMinutes !== settings.moneyMinMinutes;
    setSettings(normalized);
    setOutputVolume(normalized.outputVolume);
    void saveSettings(normalized);
    if (rewardChanged) {
      void rescoreAllSessions(
        normalized.dailyTargetMinutes,
        normalized.dailyMoneyCap,
        normalized.moneyMinMinutes
      ).then(setSessions);
    }
  };

  const toggle = async () => {
    if (monitor.running) {
      const session = await monitor.stop();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (session) {
        void notifyPracticeStopped(session.effectiveMs);
        const next = await saveSession(
          session,
          settings.dailyTargetMinutes,
          settings.dailyMoneyCap,
          settings.moneyMinMinutes
        );
        await clearDraft();
        setSessions(next);
        if (accountEmail && isFirebaseConfigured()) {
          void syncPracticeRecords(next).catch(() => undefined);
        }
        const saved =
          next.find((s) => s.id === daySessionId(session.startedAt)) ??
          next.find((s) => dayKey(s.startedAt) === dayKey(session.startedAt)) ??
          session;
        setScreen({ name: 'summary', session: saved });
      } else {
        void notifyPracticeStopped(0);
        await clearDraft();
      }
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await monitor.start();
    void notifyPracticeStarted();
  };

  const remove = (session: PracticeSession) => {
    Alert.alert('删除记录', '确定删除这一天的全部练琴记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const next = await deleteSession(session.id);
          setSessions(next);
          if (accountEmail && isFirebaseConfigured()) {
            void deleteCloudSession(session.id).catch(() => undefined);
          }
          setScreen({ name: 'history' });
        },
      },
    ]);
  };

  const shareDay = (session: PracticeSession) => {
    void shareDayReport(
      {
        id: session.id,
        key: dayKey(session.startedAt),
        label: formatDate(session.startedAt),
        startedAt: session.startedAt,
        effectiveMs: session.effectiveMs,
        boutCount: session.boutCount ?? 1,
        segmentCount: session.segments.length,
        session,
      },
      settings.dailyTargetMinutes,
      settings.dailyMoneyCap,
      settings.moneyMinMinutes,
      settings.displayName
    );
  };

  const doGoogleSignIn = async () => {
    if (!isGoogleAuthConfigured()) {
      Alert.alert(
        '未配置 Google',
        '请到 Firebase 控制台 → Authentication → Google，复制 Web 客户端 ID，填进 firebaseConfig.ts 的 GOOGLE_AUTH.webClientId。Google 登录需要开发构建；Expo Go 请用邮箱密码。'
      );
      return;
    }
    setSyncBusy(true);
    try {
      const user = await completeGoogleSignIn(promptAsync);
      if (!user) return;
      Alert.alert('登录成功', '正在按 Google 账号同步练琴记录');
    } catch (e) {
      Alert.alert('登录失败', authErrorMessage(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const doRegister = async (email: string, password: string) => {
    setSyncBusy(true);
    try {
      await registerWithEmail(email, password);
      Alert.alert('注册成功', '已登录，正在同步本机练琴记录到该账号');
    } catch (e) {
      Alert.alert('注册失败', authErrorMessage(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const doSignIn = async (email: string, password: string) => {
    setSyncBusy(true);
    try {
      await signInWithEmail(email, password);
      Alert.alert('登录成功', '正在按账号同步练琴记录');
    } catch (e) {
      Alert.alert('登录失败', authErrorMessage(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const doSaveDisplayName = async (name: string) => {
    setSyncBusy(true);
    try {
      const saved = await saveAccountDisplayName(name);
      const next = { ...settings, displayName: saved };
      setSettings(next);
      await saveSettings(next);
      Alert.alert('已保存', `显示名：${saved}`);
    } catch (e) {
      Alert.alert('保存失败', authErrorMessage(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const doSettlePending = () => {
    void (async () => {
      try {
        const result = await settlePendingSessions();
        setSessions(result.sessions);
        if (accountEmail && isFirebaseConfigured()) {
          void syncPracticeRecords(result.sessions).catch(() => undefined);
        }
        Alert.alert(
          '已标记发放',
          result.settledCount > 0
            ? `已结算 ${result.settledCount} 天，合计 ${result.settledYuan} 元`
            : '没有待发放金额'
        );
      } catch (e) {
        Alert.alert('失败', e instanceof Error ? e.message : '无法结算');
      }
    })();
  };

  const doSignOut = () => {
    Alert.alert('退出登录', '本机记录会保留，但不再与云端账号同步。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          void signOutAccount().then(() => setAccountEmail(null));
        },
      },
    ]);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        {screen.name === 'home' ? (
          <HomeScreen
            running={monitor.running}
            snapshot={monitor.snapshot}
            todaySavedMs={dayEffectiveMs(sessions)}
            waterFullMinutes={settings.waterFullMinutes}
            error={monitor.error}
            onToggle={toggle}
            onHistory={() => {
              setHistoryPath({});
              setScreen({ name: 'history' });
            }}
            onSettings={() => setScreen({ name: 'settings' })}
          />
        ) : null}
        {screen.name === 'summary' ? (
          <SummaryScreen
            session={screen.session}
            dailyTargetMinutes={settings.dailyTargetMinutes}
            dailyMoneyCap={settings.dailyMoneyCap}
            moneyMinMinutes={settings.moneyMinMinutes}
            onClose={() => setScreen({ name: 'home' })}
            onShare={() => shareDay(screen.session)}
          />
        ) : null}
        {screen.name === 'history' ? (
          <HistoryScreen
            sessions={sessions}
            path={historyPath}
            dailyTargetMinutes={settings.dailyTargetMinutes}
            dailyMoneyCap={settings.dailyMoneyCap}
            moneyMinMinutes={settings.moneyMinMinutes}
            displayName={settings.displayName}
            onPathChange={setHistoryPath}
            onBack={() => setScreen({ name: 'home' })}
            onOpenDay={(session) => setScreen({ name: 'detail', session })}
          />
        ) : null}
        {screen.name === 'detail' ? (
          <SummaryScreen
            session={screen.session}
            title="当天练习"
            dailyTargetMinutes={settings.dailyTargetMinutes}
            dailyMoneyCap={settings.dailyMoneyCap}
            moneyMinMinutes={settings.moneyMinMinutes}
            onClose={() => setScreen({ name: 'history' })}
            onDelete={() => remove(screen.session)}
            onShare={() => shareDay(screen.session)}
          />
        ) : null}
        {screen.name === 'settings' ? (
          <SettingsScreen
            settings={settings}
            todayYuan={
              sessions.find((s) => dayKey(s.startedAt) === dayKey(Date.now()))?.earnedYuan ?? 0
            }
            pendingYuan={sumPendingYuan(sessions)}
            settledYuan={sumSettledYuan(sessions)}
            streakDays={
              sessions.find((s) => dayKey(s.startedAt) === dayKey(Date.now()))?.streakDays ?? 0
            }
            streakMultiplier={
              sessions.find((s) => dayKey(s.startedAt) === dayKey(Date.now()))?.streakMultiplier ?? 1
            }
            accountEmail={accountEmail}
            googleReady={googleReady}
            syncBusy={syncBusy}
            onChange={updateSettings}
            onSettlePending={doSettlePending}
            onGoogleSignIn={() => void doGoogleSignIn()}
            onRegister={(email, password) => void doRegister(email, password)}
            onSignIn={(email, password) => void doSignIn(email, password)}
            onSaveDisplayName={(name) => void doSaveDisplayName(name)}
            onSignOut={doSignOut}
            onBack={() => setScreen({ name: 'home' })}
          />
        ) : null}
        <ShareCardHost />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
