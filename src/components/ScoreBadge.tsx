import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { formatStars, type DayScoreResult } from '../score/dayScore';
import { formatYuan, hardMoneyCap, meetsMoneyMinimum, minutesUntilMoney } from '../score/dayMoney';
import { formatStreakMultiplier } from '../score/streak';

type Props = {
  score: DayScoreResult;
  earnedYuan: number;
  dailyMoneyCap: number;
  moneyMinMinutes?: number;
  effectiveMs?: number;
  baseYuan?: number;
  streakDays?: number;
  streakMultiplier?: number;
};

export function ScoreBadge({
  score,
  earnedYuan,
  dailyMoneyCap,
  moneyMinMinutes = 15,
  effectiveMs = 0,
  baseYuan,
  streakDays = 0,
  streakMultiplier = 1,
}: Props) {
  const hardCap = hardMoneyCap(dailyMoneyCap);
  const atHardCap = earnedYuan >= hardCap && hardCap > 0;
  const hasStreakBonus = streakMultiplier > 1 && streakDays >= 2;
  const unlocked = meetsMoneyMinimum(effectiveMs, moneyMinMinutes);
  const remain = minutesUntilMoney(effectiveMs, moneyMinMinutes);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>今日练琴奖励</Text>
      <Text style={styles.money}>{formatYuan(earnedYuan)}</Text>
      <Text style={styles.capHint}>
        {!unlocked
          ? `有效满 ${moneyMinMinutes} 分钟才开始计钱，还差约 ${remain} 分钟`
          : atHardCap
            ? '已达连击加成封顶'
            : hasStreakBonus
              ? `基础 ${formatYuan(baseYuan ?? earnedYuan)} × 连击 ${formatStreakMultiplier(streakMultiplier)}`
              : `只看有效时长 · 1小时¥${dailyMoneyCap} · 2小时¥${Math.round(dailyMoneyCap * 3)}`}
      </Text>

      {streakDays > 0 ? (
        <Text style={styles.streak}>
          连续达标 {streakDays} 天
          {hasStreakBonus ? ` · ${formatStreakMultiplier(streakMultiplier)}` : ''}
        </Text>
      ) : (
        <Text style={styles.streakMuted}>
          {unlocked ? '明天继续达标，就能叠连击加成' : `先练满 ${moneyMinMinutes} 分钟有效时间`}
        </Text>
      )}

      <View style={styles.scoreRow}>
        <Text style={styles.total}>{score.total} 分</Text>
        <Text style={styles.stars}>{formatStars(score.stars)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{score.durationLabel}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.meta}>{score.focusLabel}</Text>
      </View>
      <Text style={styles.tip}>{score.tip}</Text>
      <Text style={styles.breakdown}>
        时长分 {score.durationScore}  ·  专注 ×{score.focusFactor.toFixed(2)}
      </Text>
    </View>
  );
}

type ChipProps = {
  total: number;
  stars: number;
  earnedYuan: number;
  streakDays?: number;
};

export function ScoreChip({ total, stars, earnedYuan, streakDays }: ChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipMoney}>{formatYuan(earnedYuan)}</Text>
      <Text style={styles.chipScore}>
        {total} · {formatStars(stars)}
        {streakDays && streakDays > 1 ? ` · ${streakDays}连` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  kicker: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 1,
  },
  money: {
    color: colors.gold,
    fontSize: 56,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  capHint: {
    color: colors.dim,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  streak: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  streakMuted: {
    color: colors.dim,
    fontSize: 12,
    marginTop: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  total: {
    color: colors.cream,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stars: {
    color: colors.gold,
    fontSize: 18,
    letterSpacing: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  meta: {
    color: colors.cream,
    fontSize: 14,
    fontWeight: '600',
  },
  dot: {
    color: colors.dim,
  },
  tip: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    fontSize: 13,
    paddingHorizontal: 8,
  },
  breakdown: {
    color: colors.dim,
    marginTop: 10,
    fontSize: 12,
  },
  chip: {
    alignItems: 'flex-end',
  },
  chipMoney: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
  },
  chipScore: {
    color: colors.goldDeep,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
