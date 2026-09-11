import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export type ShareCardData =
  | {
      kind: 'day';
      durationLabel: string;
      dateLabel?: string;
      nameLabel?: string;
      score?: number;
      starsLabel?: string;
      durationTag?: string;
      focusTag?: string;
    }
  | {
      kind: 'period';
      periodLabel: string;
      rangeLabel?: string;
      nameLabel?: string;
      dayCount: number;
      totalHours: string;
      avgHours: string;
    };

export const SHARE_CARD_WIDTH = 720;
export const SHARE_CARD_HEIGHT = 960;

type Props = {
  data: ShareCardData;
};

export function ShareCard({ data }: Props) {
  return (
    <View style={styles.root} collapsable={false}>
      <LinearGradient
        colors={['#2A1F16', '#16110D', '#0E0B09']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.frame}>
        <Text style={styles.brand}>练琴伙伴</Text>
        {data.nameLabel ? <Text style={styles.nameLabel}>{data.nameLabel}</Text> : null}
        <View style={styles.rule} />

        {data.kind === 'day' ? (
          <View style={styles.dayBody}>
            {data.dateLabel ? <Text style={styles.dateLabel}>{data.dateLabel}</Text> : null}
            <Text style={styles.kicker}>有效练琴</Text>
            <Text style={styles.heroDuration}>{data.durationLabel}</Text>
            {typeof data.score === 'number' ? (
              <View style={styles.scoreBlock}>
                <Text style={styles.scoreValue}>{data.score} 分</Text>
                {data.starsLabel ? <Text style={styles.scoreStars}>{data.starsLabel}</Text> : null}
                {data.durationTag || data.focusTag ? (
                  <Text style={styles.scoreTags}>
                    {[data.durationTag, data.focusTag].filter(Boolean).join('  ·  ')}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.periodBody}>
            <Text style={styles.periodTitle}>{data.periodLabel}</Text>
            {data.rangeLabel ? <Text style={styles.range}>{data.rangeLabel}</Text> : null}

            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{data.dayCount}</Text>
              <Text style={styles.statLabel}>练了多少天</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statRow}>
              <View style={styles.statHalf}>
                <Text style={styles.statValueSm}>{data.totalHours}</Text>
                <Text style={styles.statLabel}>一共</Text>
              </View>
              <View style={styles.statHalfDivider} />
              <View style={styles.statHalf}>
                <Text style={styles.statValueSm}>{data.avgHours}</Text>
                <Text style={styles.statLabel}>平均每天</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer}>只计有效练琴时间</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    left: 120,
    width: 480,
    height: 320,
    borderRadius: 240,
    backgroundColor: 'rgba(226, 177, 90, 0.16)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -120,
    right: -40,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(196, 138, 42, 0.1)',
  },
  frame: {
    flex: 1,
    paddingHorizontal: 56,
    paddingTop: 72,
    paddingBottom: 56,
  },
  brand: {
    color: colors.gold,
    fontSize: 42,
    fontWeight: '700',
  },
  nameLabel: {
    marginTop: 12,
    color: colors.cream,
    fontSize: 32,
    fontWeight: '700',
  },
  rule: {
    marginTop: 22,
    width: 56,
    height: 3,
    backgroundColor: colors.goldDeep,
    borderRadius: 2,
  },
  dayBody: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  dateLabel: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 18,
  },
  kicker: {
    color: colors.muted,
    fontSize: 28,
    marginBottom: 18,
  },
  heroDuration: {
    color: colors.cream,
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 78,
  },
  scoreBlock: {
    marginTop: 48,
    alignItems: 'flex-start',
  },
  scoreValue: {
    color: colors.gold,
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
  },
  scoreStars: {
    color: colors.gold,
    fontSize: 28,
    marginTop: 8,
  },
  scoreTags: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 22,
  },
  periodBody: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  periodTitle: {
    color: colors.cream,
    fontSize: 40,
    fontWeight: '700',
  },
  range: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 22,
  },
  statBlock: {
    marginTop: 56,
  },
  statValue: {
    color: colors.gold,
    fontSize: 88,
    fontWeight: '700',
    lineHeight: 100,
  },
  statValueSm: {
    color: colors.cream,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
  },
  statLabel: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 22,
  },
  divider: {
    marginVertical: 36,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(226, 177, 90, 0.28)',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statHalf: {
    flex: 1,
  },
  statHalfDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(226, 177, 90, 0.28)',
    marginHorizontal: 24,
  },
  footer: {
    color: colors.dim,
    fontSize: 18,
    textAlign: 'center',
  },
});
