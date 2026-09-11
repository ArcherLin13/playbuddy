import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScoreBadge } from '../components/ScoreBadge';
import { SegmentPlayButton } from '../components/SegmentPlayButton';
import { formatClock, formatDate, formatDateTime, formatDuration } from '../format';
import { DEFAULT_DAILY_TARGET_MINUTES, scoreDay } from '../score/dayScore';
import {
  DEFAULT_DAILY_MONEY_CAP,
  DEFAULT_MONEY_MIN_MINUTES,
  moneyFromScore,
} from '../score/dayMoney';
import { colors, radius } from '../theme';
import type { PracticeSession } from '../types';

type Props = {
  session: PracticeSession;
  title?: string;
  dailyTargetMinutes?: number;
  dailyMoneyCap?: number;
  moneyMinMinutes?: number;
  onClose: () => void;
  onDelete?: () => void;
  onShare?: () => void;
};

export function SummaryScreen({
  session,
  title = '本次练习',
  dailyTargetMinutes = DEFAULT_DAILY_TARGET_MINUTES,
  dailyMoneyCap = DEFAULT_DAILY_MONEY_CAP,
  moneyMinMinutes = DEFAULT_MONEY_MIN_MINUTES,
  onClose,
  onDelete,
  onShare,
}: Props) {
  const [activeUri, setActiveUri] = useState<string | null>(null);
  const hasAudio = session.segments.some((s) => !!s.audioUri);
  const isDay = (session.boutCount ?? 1) > 1 || session.id.startsWith('day-');
  const score = useMemo(
    () => scoreDay(session, dailyTargetMinutes),
    [session, dailyTargetMinutes]
  );
  const earnedYuan = useMemo(
    () =>
      session.earnedYuan ??
      moneyFromScore(score.total, dailyMoneyCap, session.effectiveMs, moneyMinMinutes),
    [session.earnedYuan, session.effectiveMs, score.total, dailyMoneyCap, moneyMinMinutes]
  );

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable
          onPress={() => {
            setActiveUri(null);
            onClose();
          }}
          hitSlop={10}
          style={styles.navBtn}
        >
          <Text style={styles.navText}>完成</Text>
        </Pressable>
        <Text style={styles.brand}>{title}</Text>
        {onShare ? (
          <Pressable onPress={onShare} hitSlop={10} style={styles.navBtn}>
            <Text style={styles.navText}>分享</Text>
          </Pressable>
        ) : (
          <View style={styles.navBtnPlaceholder} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>有效练琴时间</Text>
        <Text style={styles.timer}>{formatDuration(session.effectiveMs)}</Text>
        <Text style={styles.sub}>
          {isDay ? formatDate(session.startedAt) : formatDateTime(session.startedAt)}
        </Text>
        <Text style={styles.wall}>
          {isDay
            ? `当天共练习 ${session.boutCount ?? 1} 次，合计墙钟 ${formatDuration(session.wallClockMs)}。以下为当天所有有效片段。`
            : `从开始到停止共 ${formatDuration(session.wallClockMs)}，其中只有有乐器声音的时间计入有效时长。`}
          {hasAudio ? ' 可点击下方「播放」回听。' : ''}
        </Text>

        <ScoreBadge
          score={score}
          earnedYuan={earnedYuan}
          dailyMoneyCap={dailyMoneyCap}
          moneyMinMinutes={moneyMinMinutes}
          effectiveMs={session.effectiveMs}
          baseYuan={session.baseYuan}
          streakDays={session.streakDays}
          streakMultiplier={session.streakMultiplier}
        />

        <Text style={styles.section}>有效片段</Text>
        {session.segments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>这次没有记录到有效练琴声音。</Text>
          </View>
        ) : (
          session.segments.map((seg, i) => (
            <View key={`${seg.startAt}-${i}`} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>第 {i + 1} 段</Text>
                <Text style={styles.rowSub}>
                  {formatClock(seg.startAt)} – {formatClock(seg.endAt)}
                </Text>
                <Text style={styles.rowTime}>{formatDuration(seg.durationMs)}</Text>
              </View>
              <SegmentPlayButton
                uri={seg.audioUri}
                activeUri={activeUri}
                onActiveChange={setActiveUri}
              />
            </View>
          ))
        )}

        {onDelete ? (
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>{isDay ? '删除这一天的记录' : '删除这条记录'}</Text>
          </Pressable>
        ) : null}
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
    marginBottom: 12,
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
  kicker: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  timer: {
    color: colors.cream,
    fontSize: 64,
    fontWeight: '300',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  sub: {
    color: colors.gold,
    textAlign: 'center',
    marginTop: 4,
  },
  wall: {
    color: colors.dim,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    fontSize: 13,
  },
  section: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 28,
    marginBottom: 10,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 13,
  },
  rowTime: {
    color: colors.gold,
    fontSize: 16,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 18,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
  },
  deleteBtn: {
    marginTop: 24,
    alignItems: 'center',
    padding: 14,
  },
  deleteText: {
    color: colors.speech,
    fontSize: 15,
  },
});
