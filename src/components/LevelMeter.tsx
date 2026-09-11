import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  level: number;
  active?: boolean;
};

export function LevelMeter({ level, active = true }: Props) {
  const bars = 16;
  const lit = Math.round(Math.max(0, Math.min(1, level)) * bars);
  return (
    <View style={styles.row}>
      {Array.from({ length: bars }, (_, i) => {
        const on = active && i < lit;
        const hot = i > bars - 4;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              on && { backgroundColor: hot ? colors.speech : colors.gold, opacity: 1 },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 18,
  },
  bar: {
    width: 7,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    opacity: 0.55,
  },
});
