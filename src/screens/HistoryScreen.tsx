import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../format';
import {
  buildHistoryTree,
  type DayGroup,
  type MonthGroup,
  type WeekGroup,
} from '../history/aggregate';
import { shareDayReport, shareMonthReport, shareWeekReport } from '../history/shareReport';
import { ScoreChip } from '../components/ScoreBadge';
import { DEFAULT_DAILY_TARGET_MINUTES, scoreDay } from '../score/dayScore';
import {
  DEFAULT_DAILY_MONEY_CAP,
  DEFAULT_MONEY_MIN_MINUTES,
  formatYuan,
  moneyFromScore,
  sumEarnedYuan,
} from '../score/dayMoney';
import { colors, radius } from '../theme';
import type { PracticeSession } from '../types';

export type HistoryPath = {
  monthKey?: string;
  weekKey?: string;
};

type Props = {
  sessions: PracticeSession[];
  path: HistoryPath;
  dailyTargetMinutes?: number;
  dailyMoneyCap?: number;
  moneyMinMinutes?: number;
  displayName?: string;
  onPathChange: (path: HistoryPath) => void;
  onBack: () => void;
  onOpenDay: (session: PracticeSession) => void;
};

type Level =
  | { name: 'months' }
  | { name: 'weeks'; month: MonthGroup }
  | { name: 'days'; month: MonthGroup; week: WeekGroup };

function sessionsYuan(list: { session: PracticeSession }[]): number {
  return sumEarnedYuan(list.map((d) => d.session));
}

function monthYuan(month: MonthGroup): number {
  return sumEarnedYuan(month.weeks.flatMap((w) => w.days).map((d) => d.session));
}

export function HistoryScreen({
  sessions,
  path,
  dailyTargetMinutes = DEFAULT_DAILY_TARGET_MINUTES,
  dailyMoneyCap = DEFAULT_DAILY_MONEY_CAP,
  moneyMinMinutes = DEFAULT_MONEY_MIN_MINUTES,
  displayName = '',
  onPathChange,
  onBack,
  onOpenDay,
}: Props) {
  const months = useMemo(() => buildHistoryTree(sessions), [sessions]);
  const [level, setLevel] = useState<Level>(() => resolveLevel(months, path));

  useEffect(() => {
    setLevel(resolveLevel(months, path));
  }, [months, path.monthKey, path.weekKey]);

  const setLevelAndPath = (next: Level) => {
    setLevel(next);
    if (next.name === 'months') onPathChange({});
    else if (next.name === 'weeks') onPathChange({ monthKey: next.month.key });
    else onPathChange({ monthKey: next.month.key, weekKey: next.week.key });
  };

  const title =
    level.name === 'months'
      ? '练习记录'
      : level.name === 'weeks'
        ? level.month.label
        : level.week.label;

  const goBack = () => {
    if (level.name === 'days') setLevelAndPath({ name: 'weeks', month: level.month });
    else if (level.name === 'weeks') setLevelAndPath({ name: 'months' });
    else onBack();
  };

  const headerShare = async () => {
    if (level.name === 'weeks') await shareMonthReport(level.month, displayName);
    else if (level.name === 'days') await shareWeekReport(level.week, displayName);
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.navBtn}>
          <Text style={styles.navText}>返回</Text>
        </Pressable>
        <Text style={styles.brand} numberOfLines={1}>
          {title}
        </Text>
        {level.name === 'months' ? (
          <View style={styles.navBtnPlaceholder} />
        ) : (
          <Pressable onPress={() => void headerShare()} hitSlop={10} style={styles.navBtn}>
            <Text style={styles.navText}>分享</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.breadcrumb}>
        {level.name === 'months'
          ? '按月 → 按周 → 按天'
          : level.name === 'weeks'
            ? `${level.month.label} · 有效 ${formatDuration(level.month.effectiveMs)}`
            : `${level.week.label} · ${level.week.rangeLabel}`}
      </Text>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? (
          <Text style={styles.empty}>还没有练琴记录。开始一次练习后会出现在这里。</Text>
        ) : null}

        {level.name === 'months'
          ? months.map((month) => (
              <Row
                key={month.id}
                title={month.label}
                sub={`${month.dayCount} 天  ·  ${month.boutCount} 次  ·  ${month.segmentCount} 段`}
                time={formatDuration(month.effectiveMs)}
                money={formatYuan(monthYuan(month))}
                onPress={() => setLevelAndPath({ name: 'weeks', month })}
                onShare={() => void shareMonthReport(month, displayName)}
              />
            ))
          : null}

        {level.name === 'weeks'
          ? level.month.weeks.map((week) => (
              <Row
                key={week.id}
                title={week.label}
                sub={`${week.rangeLabel}  ·  ${week.dayCount} 天  ·  ${week.boutCount} 次`}
                time={formatDuration(week.effectiveMs)}
                money={formatYuan(sessionsYuan(week.days))}
                onPress={() => setLevelAndPath({ name: 'days', month: level.month, week })}
                onShare={() => void shareWeekReport(week, displayName)}
              />
            ))
          : null}

        {level.name === 'days'
          ? level.week.days.map((day) => (
              <DayRow
                key={day.id}
                day={day}
                dailyTargetMinutes={dailyTargetMinutes}
                dailyMoneyCap={dailyMoneyCap}
                moneyMinMinutes={moneyMinMinutes}
                onPress={() => onOpenDay(day.session)}
                onShare={() =>
                  void shareDayReport(
                    day,
                    dailyTargetMinutes,
                    dailyMoneyCap,
                    moneyMinMinutes,
                    displayName
                  )
                }
              />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

function resolveLevel(months: MonthGroup[], path: HistoryPath): Level {
  if (!path.monthKey) return { name: 'months' };
  const month = months.find((m) => m.key === path.monthKey);
  if (!month) return { name: 'months' };
  if (!path.weekKey) return { name: 'weeks', month };
  const week = month.weeks.find((w) => w.key === path.weekKey);
  if (!week) return { name: 'weeks', month };
  return { name: 'days', month, week };
}

function Row({
  title,
  sub,
  time,
  money,
  onPress,
  onShare,
}: {
  title: string;
  sub: string;
  time: string;
  money?: string;
  onPress: () => void;
  onShare: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </Pressable>
      <View style={styles.dayAside}>
        {money ? <Text style={styles.rowMoney}>{money}</Text> : null}
        <Text style={styles.rowTime}>{time}</Text>
      </View>
      <Pressable onPress={onShare} style={styles.shareBtn}>
        <Text style={styles.shareText}>分享</Text>
      </Pressable>
    </View>
  );
}

function DayRow({
  day,
  dailyTargetMinutes,
  dailyMoneyCap,
  moneyMinMinutes,
  onPress,
  onShare,
}: {
  day: DayGroup;
  dailyTargetMinutes: number;
  dailyMoneyCap: number;
  moneyMinMinutes: number;
  onPress: () => void;
  onShare: () => void;
}) {
  const score = scoreDay(day.session, dailyTargetMinutes);
  const earnedYuan =
    day.session.earnedYuan ??
    moneyFromScore(score.total, dailyMoneyCap, day.effectiveMs, moneyMinMinutes);
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} style={styles.rowMain}>
        <Text style={styles.rowTitle}>{day.label}</Text>
        <Text style={styles.rowSub}>
          {day.boutCount} 次练习  ·  {day.segmentCount} 个有效片段
          {day.session.settled ? '  ·  已发放' : ''}
        </Text>
      </Pressable>
      <View style={styles.dayAside}>
        <ScoreChip
          total={score.total}
          stars={score.stars}
          earnedYuan={earnedYuan}
          streakDays={day.session.streakDays}
        />
        <Text style={styles.rowTime}>{formatDuration(day.effectiveMs)}</Text>
      </View>
      <Pressable onPress={onShare} style={styles.shareBtn}>
        <Text style={styles.shareText}>分享</Text>
      </Pressable>
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
    marginBottom: 4,
    gap: 8,
  },
  brand: {
    flex: 1,
    color: colors.cream,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
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
  breadcrumb: {
    color: colors.dim,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    paddingBottom: 40,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.muted,
    marginTop: 6,
    fontSize: 12,
  },
  rowTime: {
    color: colors.gold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  rowMoney: {
    color: colors.gold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  dayAside: {
    alignItems: 'flex-end',
    gap: 4,
  },
  shareBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  shareText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    color: colors.muted,
    lineHeight: 22,
    marginTop: 40,
    textAlign: 'center',
  },
});
