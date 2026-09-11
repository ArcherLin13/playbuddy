import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlayButton } from '../components/PlayButton';
import { LevelMeter } from '../components/LevelMeter';
import { ProgressRing } from '../components/ProgressRing';
import { formatDuration } from '../format';
import { colors, radius } from '../theme';
import type { SoundKind } from '../types';
import type { MonitorSnapshot } from '../hooks/usePracticeMonitor';

type Props = {
  running: boolean;
  snapshot: MonitorSnapshot;
  /** 今日已保存的有效时长（不含当前未结束的这一次） */
  todaySavedMs?: number;
  /** 进度环满圈对应的有效分钟数 */
  waterFullMinutes?: number;
  error: string | null;
  onToggle: () => void;
  onHistory: () => void;
  onSettings: () => void;
};

export function HomeScreen({
  running,
  snapshot,
  todaySavedMs = 0,
  waterFullMinutes = 60,
  error,
  onToggle,
  onHistory,
  onSettings,
}: Props) {
  const status = statusCopy(running ? snapshot.kind : 'idle');
  const dayMs = todaySavedMs + (running ? snapshot.effectiveMs : 0);
  const fullMs = Math.max(10, waterFullMinutes) * 60_000;
  const progress = Math.max(0, Math.min(1, dayMs / fullMs));

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable
          onPress={onHistory}
          hitSlop={10}
          disabled={running}
          style={[styles.navBtn, running && styles.navDisabled]}
        >
          <Text style={styles.navText}>历史</Text>
        </Pressable>
        <Text style={styles.brand}>练琴伙伴</Text>
        <Pressable
          onPress={onSettings}
          hitSlop={10}
          disabled={running}
          style={[styles.navBtn, running && styles.navDisabled]}
        >
          <Text style={styles.navText}>设置</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text style={styles.kicker}>今日有效练琴</Text>
        <ProgressRing progress={progress} active={running && snapshot.kind === 'playing'}>
          <Text style={styles.timer}>{formatDuration(dayMs)}</Text>
        </ProgressRing>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <View style={[styles.dot, { backgroundColor: status.dot }]} />
          <Text style={styles.badgeText}>{status.label}</Text>
        </View>
        <View style={styles.meterWrap}>
          <LevelMeter level={snapshot.level} active={running} />
        </View>
        {running && snapshot.coachLine ? (
          <Text style={styles.coachLine}>{snapshot.coachLine}</Text>
        ) : null}
      </View>

      <View style={styles.control}>
        <PlayButton playing={running} onPress={onToggle} />
        <Text style={styles.hint}>{running ? '点击停止' : '点击开始'}</Text>
      </View>

      {!running ? (
        <Text style={styles.footer}>
          只有检测到乐器声音才会计时。说话、噪音和超过 1 分钟的安静都不算有效练琴。
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function statusCopy(kind: SoundKind | 'idle'): { label: string; bg: string; dot: string } {
  switch (kind) {
    case 'playing':
      return { label: '正在拉琴', bg: 'rgba(125,190,116,0.18)', dot: colors.playing };
    case 'speech':
      return { label: '说话/唱歌，不计时', bg: 'rgba(217,137,106,0.18)', dot: colors.speech };
    case 'noise':
      return { label: '环境噪音，不计时', bg: 'rgba(139,144,160,0.18)', dot: colors.noise };
    case 'silence':
      return { label: '安静中', bg: 'rgba(58,49,41,0.9)', dot: colors.muted };
    default:
      return { label: '等待开始', bg: 'rgba(58,49,41,0.9)', dot: colors.gold };
  }
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
  },
  brand: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
  },
  navDisabled: {
    opacity: 0.35,
  },
  navText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 18,
  },
  timer: {
    color: colors.cream,
    fontSize: 52,
    fontVariant: ['tabular-nums'],
    fontWeight: '300',
    letterSpacing: 1,
  },
  badge: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    color: colors.cream,
    fontSize: 14,
  },
  meterWrap: {
    marginTop: 22,
  },
  coachLine: {
    marginTop: 10,
    color: colors.gold,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  control: {
    alignItems: 'center',
    marginBottom: 18,
  },
  hint: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 14,
  },
  footer: {
    color: colors.dim,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  error: {
    color: colors.speech,
    textAlign: 'center',
    marginBottom: 16,
  },
});
