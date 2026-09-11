import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  playing: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function PlayButton({ playing, onPress, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? '停止' : '开始'}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outer,
        playing && styles.outerPlaying,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.inner, playing && styles.innerPlaying]}>
        {playing ? <View style={styles.stop} /> : <View style={styles.triangle} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  outerPlaying: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
  },
  inner: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerPlaying: {
    backgroundColor: colors.danger,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.55,
  },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 8,
    borderStyle: 'solid',
    borderTopWidth: 18,
    borderBottomWidth: 18,
    borderLeftWidth: 30,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.bg,
  },
  stop: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.cream,
  },
});
