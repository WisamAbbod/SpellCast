import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

/**
 * The drifting field behind every screen: stars, fireflies, snow or bubbles.
 *
 * One implementation, not four. This began as StarField, whose three copies each
 * rebuilt their positions on every render (so stars teleported), never cleared
 * their start timeouts, and never stopped their loops on unmount. All of that
 * stays fixed here; only the choice of motion is new.
 *
 * Every motion animates opacity and transform ONLY, so useNativeDriver holds
 * throughout and each particle costs at most two driven values - the same as the
 * original twinkle. `fall` and `rise` need just one, because their opacity is
 * interpolated from the same progress value that moves them.
 */

const TWINKLE_STAGGER_MS = 2600;

const Particle = ({
  x, y, size, phase, duration, swayX, driftY,
  motion, tint, glow, height, reducedMotion,
}) => {
  // Two values at most, and only the ones this motion actually drives.
  const opacity = useRef(new Animated.Value(reducedMotion ? 0.6 : 0.15)).current;
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : 0.6)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;

    const loops = [];

    if (motion === 'twinkle') {
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.95, duration: 1400 + size * 220, useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.18, duration: 1600 + size * 200, useNativeDriver: true,
            }),
          ]),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue: 1, duration: 2100, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.55, duration: 2400, useNativeDriver: true }),
          ]),
        ),
      );
    } else if (motion === 'drift') {
      // A firefly blinks out completely rather than dimming, which is what
      // separates it from a star.
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.9, duration: 900 + size * 300, useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.04, duration: 1300 + size * 260, useNativeDriver: true,
            }),
          ]),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(progress, {
              toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
            }),
            Animated.timing(progress, {
              toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
            }),
          ]),
        ),
      );
    } else {
      // fall and rise: one linear traversal, looped. Opacity comes off the same
      // value, so nothing pops in or out at the edges of the screen.
      loops.push(
        Animated.loop(
          Animated.timing(progress, {
            toValue: 1, duration, easing: Easing.linear, useNativeDriver: true,
          }),
        ),
      );
    }

    // Staggered starts are what keep the field from pulsing in unison. For a
    // traversal that means spreading over a whole cycle, not a fixed window.
    const stagger = motion === 'twinkle' || motion === 'drift'
      ? phase * TWINKLE_STAGGER_MS
      : phase * duration;

    const timeout = setTimeout(() => loops.forEach((loop) => loop.start()), stagger);

    return () => {
      clearTimeout(timeout);
      loops.forEach((loop) => loop.stop());
    };
  }, [duration, motion, opacity, phase, progress, reducedMotion, scale, size]);

  const transform = [];
  let animatedOpacity = opacity;

  if (motion === 'drift') {
    transform.push(
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, swayX] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] }) },
    );
  } else if (motion === 'fall' || motion === 'rise') {
    const travel = motion === 'fall'
      ? [-size * 2, height + size * 2]
      : [height + size * 2, -size * 2];

    transform.push(
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: travel }) },
      {
        translateX: progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, swayX, 0],
        }),
      },
    );
    animatedOpacity = reducedMotion
      ? opacity
      : progress.interpolate({
          inputRange: [0, 0.1, 0.85, 1],
          outputRange: [0, 0.85, 0.75, 0],
        });
  } else {
    transform.push({ scale });
  }

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint,
          opacity: animatedOpacity,
          transform,
        },
      ]}
    >
      {/* A halo, not a shadow: shadowRadius is iOS-only and elevation will not
          take a colour, so the only cross-platform glow is a second circle. It
          inherits the parent's opacity, so it blinks with the firefly. */}
      {glow && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -size,
            top: -size,
            width: size * 3,
            height: size * 3,
            borderRadius: size * 1.5,
            backgroundColor: tint,
            opacity: 0.16,
          }}
        />
      )}
    </Animated.View>
  );
};

const ParticleField = ({
  count = 46,
  motion = 'twinkle',
  tint = '#FFFFFF',
  sizeScale = 1,
  glow = false,
  reducedMotion = false,
}) => {
  const { width, height } = useWindowDimensions();

  // Positions depend on the window, not on every render.
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        x: Math.random() * width,
        // A traversal starts off-screen and is placed by its transform; only a
        // stationary motion needs a random y. Under reduced motion nothing
        // moves, so everything needs one.
        y:
          reducedMotion || motion === 'twinkle' || motion === 'drift'
            ? Math.random() * height
            : 0,
        size: (Math.random() * 2.6 + 1.4) * sizeScale,
        phase: Math.random(),
        duration: 6200 + Math.random() * 7000,
        swayX: (Math.random() * 2 - 1) * 26,
        driftY: (Math.random() * 2 - 1) * 20,
      })),
    [count, width, height, sizeScale, motion, reducedMotion],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          {...particle}
          motion={motion}
          tint={tint}
          glow={glow}
          height={height}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  particle: { position: 'absolute' },
});

export default ParticleField;
