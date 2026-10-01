import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { ASTRO_COLORS } from '../../theme/astronaut.js';

/**
 * The bits that fly off the astronaut: jet puffs, sparkles, sleep, sweat.
 *
 * They live outside the rig on purpose. A puff that stayed attached to the
 * backpack would spin with it through a backflip; one left behind in the world
 * is what makes the flip read as movement through space.
 *
 * Positions are in rig units (120 across), scaled by `unit`. All motion is
 * transform and opacity, on the native driver.
 */

const native = { useNativeDriver: true };

/** A burst of exhaust from the nozzle, fired whenever `burst` changes. */
export const Puffs = ({ burst, unit }) => {
  const puffs = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        progress: new Animated.Value(0),
        dx: (i - 2.5) * 5 + (Math.random() - 0.5) * 4,
        dy: 14 + Math.random() * 12,
        size: 5 + Math.random() * 4,
      })),
    [],
  );

  useEffect(() => {
    if (!burst) return undefined;
    const animation = Animated.stagger(
      30,
      puffs.map((puff) => {
        puff.progress.setValue(0);
        return Animated.timing(puff.progress, {
          toValue: 1, duration: 650, easing: Easing.out(Easing.quad), ...native,
        });
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [burst, puffs]);

  if (!burst) return null;
  return puffs.map((puff, i) => (
    <Animated.View
      key={i}
      pointerEvents="none"
      style={[
        styles.puff,
        {
          left: (60 - puff.size / 2) * unit,
          top: 104 * unit,
          width: puff.size * unit,
          height: puff.size * unit,
          borderRadius: (puff.size / 2) * unit,
          opacity: puff.progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] }),
          transform: [
            { translateX: puff.progress.interpolate({ inputRange: [0, 1], outputRange: [0, puff.dx * unit] }) },
            { translateY: puff.progress.interpolate({ inputRange: [0, 1], outputRange: [0, puff.dy * unit] }) },
            { scale: puff.progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) },
          ],
        },
      ]}
    />
  ));
};

/** Stars thrown off a big moment. */
export const Sparkles = ({ burst, unit }) => {
  const sparks = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const angle = (i / 7) * Math.PI * 2 + 0.3;
        return {
          progress: new Animated.Value(0),
          dx: Math.cos(angle) * 46,
          dy: Math.sin(angle) * 40,
          spin: (i % 2 ? 1 : -1) * 180,
        };
      }),
    [],
  );

  useEffect(() => {
    if (!burst) return undefined;
    const animation = Animated.parallel(
      sparks.map((spark) => {
        spark.progress.setValue(0);
        return Animated.timing(spark.progress, {
          toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), ...native,
        });
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [burst, sparks]);

  if (!burst) return null;
  return sparks.map((spark, i) => (
    <Animated.Text
      key={i}
      pointerEvents="none"
      style={[
        styles.spark,
        {
          left: 54 * unit,
          top: 34 * unit,
          fontSize: 14 * unit,
          opacity: spark.progress.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: spark.progress.interpolate({ inputRange: [0, 1], outputRange: [0, spark.dx * unit] }) },
            { translateY: spark.progress.interpolate({ inputRange: [0, 1], outputRange: [0, spark.dy * unit] }) },
            { rotate: spark.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spark.spin}deg`] }) },
            { scale: spark.progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.3, 0.8] }) },
          ],
        },
      ]}
    >
      ✦
    </Animated.Text>
  ));
};

/**
 * A slow stream of z's rising off the helmet while it sleeps. Each loops on a
 * staggered clock so there is always one on its way up.
 */
export const Snores = ({ active, unit }) => {
  const zs = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) return undefined;
    const loops = zs.map((value, i) =>
      Animated.sequence([
        Animated.delay(i * 900),
        Animated.loop(
          Animated.timing(value, { toValue: 1, duration: 2700, easing: Easing.linear, ...native }),
        ),
      ]),
    );
    const animation = Animated.parallel(loops);
    animation.start();
    return () => {
      animation.stop();
      zs.forEach((value) => value.setValue(0));
    };
  }, [active, zs]);

  if (!active) return null;
  return zs.map((value, i) => (
    <Animated.Text
      key={i}
      pointerEvents="none"
      style={[
        styles.snore,
        {
          left: 82 * unit,
          top: 18 * unit,
          fontSize: (9 + i * 2) * unit,
          opacity: value.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.6, 0] }),
          transform: [
            { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, 16 * unit] }) },
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -26 * unit] }) },
            { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '14deg'] }) },
          ],
        },
      ]}
    >
      z
    </Animated.Text>
  ));
};

/** Sweat drops flicking off the helmet when time is nearly up. */
export const Sweat = ({ active, unit }) => {
  const drops = useRef([0, 1].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) return undefined;
    const animation = Animated.parallel(
      drops.map((value, i) =>
        Animated.sequence([
          Animated.delay(i * 330),
          Animated.loop(
            Animated.timing(value, { toValue: 1, duration: 660, easing: Easing.in(Easing.quad), ...native }),
          ),
        ]),
      ),
    );
    animation.start();
    return () => {
      animation.stop();
      drops.forEach((value) => value.setValue(0));
    };
  }, [active, drops]);

  if (!active) return null;
  return drops.map((value, i) => {
    const side = i === 0 ? -1 : 1;
    return (
      <Animated.View
        key={i}
        pointerEvents="none"
        style={[
          styles.drop,
          {
            left: (side < 0 ? 26 : 90) * unit,
            top: 26 * unit,
            width: 5 * unit,
            height: 7 * unit,
            borderRadius: 3 * unit,
            opacity: value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, side * 10 * unit] }) },
              { translateY: value.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -5 * unit, 10 * unit] }) },
            ],
          },
        ]}
      />
    );
  });
};

const styles = StyleSheet.create({
  puff: { position: 'absolute', backgroundColor: '#D8DBEF' },
  spark: { position: 'absolute', color: ASTRO_COLORS.glove },
  snore: { position: 'absolute', color: ASTRO_COLORS.glow, fontWeight: '700' },
  drop: { position: 'absolute', backgroundColor: ASTRO_COLORS.cyan },
});

