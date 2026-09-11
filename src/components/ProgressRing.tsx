import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  active?: boolean;
};

/**
 * Gold circular progress around the timer. progress 0–1 = empty → full ring.
 */
export function ProgressRing({
  progress,
  size = 260,
  strokeWidth = 10,
  children,
  active = false,
}: Props) {
  const p = Math.max(0, Math.min(1, progress));
  const anim = useRef(new Animated.Value(p)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: p,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [anim, p]);

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(226, 177, 90, 0.18)"
            strokeWidth={strokeWidth + 6}
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        // Start from top (12 o'clock)
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.cardBorder}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.85}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.gold}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
