import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatYuan } from '../score/dayMoney';
import { formatStreakMultiplier } from '../score/streak';
import { DEFAULT_PARENT_PIN, saveParentPin, verifyParentPin } from '../storage/parentPin';
import { isFirebaseConfigured } from '../sync/firebaseConfig';
import { colors, radius } from '../theme';
import type { AppSettings } from '../types';

type Props = {
  settings: AppSettings;
  todayYuan: number;
  totalYuan: number;
  streakDays: number;
  streakMultiplier: number;
  accountEmail: string | null;
  googleReady?: boolean;
  syncBusy?: boolean;
  onChange: (next: AppSettings) => void;
  onGoogleSignIn: () => void;
  onRegister: (email: string, password: string) => void;
  onSignIn: (email: string, password: string) => void;
  onSaveDisplayName: (name: string) => void;
  onSignOut: () => void;
  onBack: () => void;
};

const TARGETS: { label: string; value: number }[] = [
  { label: '20分', value: 20 },
  { label: '30分', value: 30 },
  { label: '40分', value: 40 },
  { label: '60分', value: 60 },
];
const MONEY_CAPS: { label: string; value: number }[] = [
  { label: '¥5', value: 5 },
  { label: '¥10', value: 10 },
  { label: '¥15', value: 15 },
  { label: '¥20', value: 20 },
];
const MONEY_MINS: { label: string; value: number }[] = [
  { label: '20分', value: 20 },
  { label: '30分', value: 30 },
  { label: '40分', value: 40 },
  { label: '60分', value: 60 },
];
const WATER_FULL: { label: string; value: number }[] = [
  { label: '40分', value: 40 },
  { label: '60分', value: 60 },
  { label: '90分', value: 90 },
  { label: '120分', value: 120 },
];

export function SettingsScreen({
  settings,
  todayYuan,
  totalYuan,
  streakDays,
  streakMultiplier,
  accountEmail,
  googleReady = false,
  syncBusy = false,
  onChange,
  onGoogleSignIn,
  onRegister,
  onSignIn,
  onSaveDisplayName,
  onSignOut,
  onBack,
}: Props) {
  const [moneyUnlocked, setMoneyUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [nameDraft, setNameDraft] = useState(settings.displayName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    setNameDraft(settings.displayName);
  }, [settings.displayName, accountEmail]);

  const unlockMoney = async () => {
    const ok = await verifyParentPin(pinInput);
    if (!ok) {
      Alert.alert('密码错误', `请输入家长密码（初始为 ${DEFAULT_PARENT_PIN}）`);
      setPinInput('');
      return;
    }
    setMoneyUnlocked(true);
    setPinInput('');
  };

  const lockMoney = () => {
    setMoneyUnlocked(false);
    setNewPin('');
    setConfirmPin('');
  };

  const changePin = async () => {
    if (newPin.replace(/\D/g, '').length < 4) {
      Alert.alert('无效密码', '新密码至少 4 位数字');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('两次输入不一致', '请重新确认新密码');
      return;
    }
    try {
      await saveParentPin(newPin);
      setNewPin('');
      setConfirmPin('');
      Alert.alert('已更新', '家长密码已修改');
    } catch (e) {
      Alert.alert('失败', e instanceof Error ? e.message : '无法保存密码');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.navBtn}>
          <Text style={styles.navText}>返回</Text>
        </Pressable>
        <Text style={styles.brand}>设置</Text>
        <View style={styles.navBtnPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.moneyBar}>
          <View style={styles.moneyItem}>
            <Text style={styles.moneyLabel}>今日可领</Text>
            <Text style={styles.moneyValue}>{formatYuan(todayYuan)}</Text>
            <Text style={styles.moneySub}>
              {streakDays > 1
                ? `连击 ${streakDays} 天 ${formatStreakMultiplier(streakMultiplier)}`
                : `满 ${settings.moneyMinMinutes} 分钟起薪`}
            </Text>
          </View>
          <View style={styles.moneyDivider} />
          <View style={styles.moneyItem}>
            <Text style={styles.moneyLabel}>累计存钱</Text>
            <Text style={styles.moneyValue}>{formatYuan(totalYuan)}</Text>
            <Text style={styles.moneySub}>给家长核对发放</Text>
          </View>
        </View>

        <Text style={styles.section}>呼唤练琴</Text>
        <Text style={styles.help}>停练提醒 + 连续练琴鼓励。</Text>
        <View style={styles.coachCard}>
          <View style={styles.coachRow}>
            <Text style={styles.coachTitle}>{settings.coachEnabled ? '已开启' : '已关闭'}</Text>
            <Switch
              value={settings.coachEnabled}
              onValueChange={(coachEnabled) => onChange({ ...settings, coachEnabled })}
              trackColor={{ false: colors.cardBorder, true: colors.goldDeep }}
              thumbColor={settings.coachEnabled ? colors.gold : colors.muted}
            />
          </View>
          <View style={styles.volumeDivider} />
          <View style={styles.volumeRow}>
            <Text style={styles.volumeLabel}>音量</Text>
            <Pressable
              onPress={() =>
                onChange({
                  ...settings,
                  outputVolume: Math.max(0, Math.round((settings.outputVolume - 0.1) * 10) / 10),
                })
              }
              style={styles.volBtn}
            >
              <Text style={styles.volBtnText}>−</Text>
            </Pressable>
            <Text style={styles.volValue}>{Math.round(settings.outputVolume * 100)}%</Text>
            <Pressable
              onPress={() =>
                onChange({
                  ...settings,
                  outputVolume: Math.min(1, Math.round((settings.outputVolume + 0.1) * 10) / 10),
                })
              }
              style={styles.volBtn}
            >
              <Text style={styles.volBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.section}>账号同步</Text>
        <Text style={styles.help}>
          同一账号登录的设备会自动同步练琴记录。可自定义显示名。录音只保存在本机。Google
          需开发构建；Expo Go 请用下方邮箱密码测试。
        </Text>
        {!firebaseReady ? (
          <View style={styles.lockCard}>
            <Text style={styles.help}>尚未填入 Firebase 配置。</Text>
          </View>
        ) : accountEmail ? (
          <View style={styles.lockCard}>
            <Text style={styles.moneyLabel}>已登录 · 自动同步</Text>
            <Text style={styles.accountEmail}>{accountEmail}</Text>
            <Text style={styles.help}>
              登录后、每次练完都会自动上传。显示名（孩子昵称等）会同步到各设备。
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              autoCapitalize="words"
              maxLength={24}
              placeholder="例如：小明"
              placeholderTextColor={colors.dim}
              style={styles.nameInput}
            />
            <Pressable
              onPress={() => onSaveDisplayName(nameDraft)}
              disabled={syncBusy}
              style={[styles.unlockBtn, syncBusy && styles.navDisabled]}
            >
              <Text style={styles.unlockText}>保存名字</Text>
            </Pressable>
            <Pressable onPress={onSignOut} style={styles.lockBtn}>
              <Text style={styles.lockBtnText}>退出登录</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.lockCard}>
            <Pressable
              onPress={onGoogleSignIn}
              disabled={syncBusy || !googleReady}
              style={[styles.unlockBtn, (syncBusy || !googleReady) && styles.navDisabled]}
            >
              <Text style={styles.unlockText}>
                {syncBusy ? '登录中…' : '使用 Google 登录'}
              </Text>
            </Pressable>
            {!googleReady ? (
              <Text style={styles.help}>
                Google 需填 Web Client ID，并用开发构建。Expo Go 请用下方邮箱。
              </Text>
            ) : (
              <Text style={styles.help}>开发构建可用 Google；Expo Go 请用邮箱。</Text>
            )}

            <Text style={styles.subSection}>邮箱密码（Expo Go 测试）</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="邮箱"
              placeholderTextColor={colors.dim}
              style={styles.nameInput}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="密码（至少 6 位）"
              placeholderTextColor={colors.dim}
              style={styles.nameInput}
            />
            <Pressable
              onPress={() => onSignIn(email, password)}
              disabled={syncBusy}
              style={[styles.unlockBtn, syncBusy && styles.navDisabled]}
            >
              <Text style={styles.unlockText}>登录并同步</Text>
            </Pressable>
            <Pressable
              onPress={() => onRegister(email, password)}
              disabled={syncBusy}
              style={styles.lockBtn}
            >
              <Text style={styles.lockBtnText}>注册新账号</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.section}>家长区 · 零花钱规则</Text>
        {!moneyUnlocked ? (
          <View style={styles.lockCard}>
            <Text style={styles.help}>
              修改目标时长、进度环满圈、起薪线和封顶金额需要家长密码。初始密码：{DEFAULT_PARENT_PIN}
            </Text>
            <TextInput
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="输入家长密码"
              placeholderTextColor={colors.dim}
              style={styles.pinInput}
            />
            <Pressable onPress={() => void unlockMoney()} style={styles.unlockBtn}>
              <Text style={styles.unlockText}>解锁</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <View style={styles.unlockRow}>
              <Text style={styles.unlockedHint}>已解锁</Text>
              <Pressable onPress={lockMoney} style={styles.lockBtn}>
                <Text style={styles.lockBtnText}>重新锁定</Text>
              </Pressable>
            </View>

            <Text style={styles.subSection}>每日有效练琴目标</Text>
            <Text style={styles.help}>
              评分按「时长分 × 专注系数」计算。默认 40 分钟；一天多次练习会合并后重新打分。
            </Text>
            <View style={styles.row}>
              {TARGETS.map((item) => {
                const active = settings.dailyTargetMinutes === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => onChange({ ...settings, dailyTargetMinutes: item.value })}
                    style={[styles.chip, active && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.subSection}>起薪有效时长</Text>
            <Text style={styles.help}>
              当天有效练琴未满此时间，零花钱为 ¥0。默认 30 分钟；达标后才按评分计钱。
            </Text>
            <View style={styles.row}>
              {MONEY_MINS.map((item) => {
                const active = settings.moneyMinMinutes === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => onChange({ ...settings, moneyMinMinutes: item.value })}
                    style={[styles.chip, active && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.subSection}>进度环满圈时长</Text>
            <Text style={styles.help}>
              首页金色圆环走满一圈对应的有效练琴时间。默认 60 分钟。
            </Text>
            <View style={styles.row}>
              {WATER_FULL.map((item) => {
                const active = settings.waterFullMinutes === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => onChange({ ...settings, waterFullMinutes: item.value })}
                    style={[styles.chip, active && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.subSection}>每日零花钱封顶</Text>
            <Text style={styles.help}>
              过起薪线后按评分折算。连续达标可乘系数，最高为基础封顶的 1.5 倍。
            </Text>
            <View style={styles.row}>
              {MONEY_CAPS.map((item) => {
                const active = settings.dailyMoneyCap === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => onChange({ ...settings, dailyMoneyCap: item.value })}
                    style={[styles.chip, active && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.subSection}>修改家长密码</Text>
            <TextInput
              value={newPin}
              onChangeText={setNewPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="新密码（至少 4 位）"
              placeholderTextColor={colors.dim}
              style={styles.pinInput}
            />
            <TextInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="再输入一次新密码"
              placeholderTextColor={colors.dim}
              style={styles.pinInput}
            />
            <Pressable onPress={() => void changePin()} style={styles.unlockBtn}>
              <Text style={styles.unlockText}>保存新密码</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>计时与评分</Text>
          <Text style={styles.cardBody}>
            只有检测到小提琴声音才累加有效时间。说话、唱歌和环境噪音不计时。用最近 5
            秒滑动窗口综合判断；安静超过 1 分钟会结束当前有效片段。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 22,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginBottom: 8,
  },
  brand: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '700',
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
  },
  navBtnPlaceholder: {
    width: 56,
  },
  navText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    paddingBottom: 40,
  },
  moneyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  moneyItem: {
    flex: 1,
    alignItems: 'center',
  },
  moneyDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.cardBorder,
    marginHorizontal: 8,
  },
  moneyLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  moneyValue: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  moneySub: {
    color: colors.dim,
    fontSize: 11,
    marginTop: 2,
  },
  accountEmail: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '600',
    marginVertical: 8,
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  coachCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 28,
    overflow: 'hidden',
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  coachTitle: {
    flex: 1,
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  volumeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginHorizontal: 14,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  volumeLabel: {
    flex: 1,
    color: colors.cream,
    fontSize: 15,
    fontWeight: '600',
  },
  volBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  volBtnText: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  volValue: {
    color: colors.gold,
    width: 56,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    fontSize: 18,
  },
  section: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  subSection: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  help: {
    color: colors.dim,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  chip: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipText: {
    color: colors.cream,
    fontWeight: '600',
  },
  chipTextOn: {
    color: colors.bg,
  },
  lockCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 28,
  },
  pinInput: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 16,
    letterSpacing: 4,
  },
  unlockBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  navDisabled: {
    opacity: 0.45,
  },
  unlockText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: 15,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  unlockedHint: {
    color: colors.playing,
    fontWeight: '700',
  },
  lockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  lockBtnText: {
    color: colors.gold,
    fontWeight: '600',
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    marginTop: 8,
  },
  cardTitle: {
    color: colors.gold,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardBody: {
    color: colors.muted,
    lineHeight: 21,
    fontSize: 13,
  },
});
