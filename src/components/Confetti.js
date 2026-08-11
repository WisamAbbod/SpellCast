import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme/colors.js';

/**
 * Celebration particles, hand-rolled on Animated.
 *
 * No dependency: a confetti library would be a package, a native module concern
 * and a maintenance risk for ~40 lines of transforms.
 */

const PALETTE = [colors.primary, colors.accent, colors.gold, colors.success, '#FF8FB1'];

const Piece = ({ startX, delay, drift, size, color, spin, duration, height }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-40, height] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${spin}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: startX,
          width: size,
          height: size * 1.6,
          backgroundColor: color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
};

const Confetti = ({ count = 26, burstKey = 0, enabled = true }) => {
  const { width, height } = useWindowDimensions();

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: `${burstKey}-${index}`,
        startX: Math.random() * width,
        delay: Math.random() * 220,
        drift: (Math.random() - 0.5) * 160,
        size: 5 + Math.random() * 6,
        color: PALETTE[index % PALETTE.length],
        spin: 220 + Math.random() * 520,
        duration: 1200 + Math.random() * 900,
      })),
    [burstKey, count, width],
  );

  if (!enabled || burstKey === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece) => (
        <Piece key={piece.id} {...piece} height={height + 80} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderRadius: 2 },
});

export default Confetti;
