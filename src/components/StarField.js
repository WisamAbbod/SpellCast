import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

/**
 * The drifting starfield behind every screen.
 *
 * One implementation, not three. The copies this replaces rebuilt their star
 * positions on every render (so stars teleported), never cleared their start
 * timeouts, and never stopped their animation loops on unmount.
 */

const Star = ({ x, y, size, delay, reducedMotion }) => {
  const opacity = useRef(new Animated.Value(reducedMotion ? 0.6 : 0.15)).current;
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : 0.6)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;

    const twinkle = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.95, duration: 1400 + size * 220, useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.18, duration: 1600 + size * 200, useNativeDriver: true,
        }),
      ]),
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 2100, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.55, duration: 2400, useNativeDriver: true }),
      ]),
    );

    const timeout = setTimeout(() => {
      twinkle.start();
      breathe.start();
    }, delay);

    return () => {
      clearTimeout(timeout);
      twinkle.stop();
      breathe.stop();
    };
  }, [delay, opacity, reducedMotion, scale, size]);

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: x, top: y, width: size, height: size, borderRadius: size / 2,
          opacity, transform: [{ scale }],
        },
      ]}
    />
  );
};

const StarField = ({ count = 46, reducedMotion = false }) => {
  const { width, height } = useWindowDimensions();

  // Positions depend on the window, not on every render.
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.6 + 1.4,
        delay: Math.random() * 2600,
      })),
    [count, width, height],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((star) => (
        <Star key={star.id} {...star} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  star: { position: 'absolute', backgroundColor: '#FFFFFF' },
});

export default StarField;
