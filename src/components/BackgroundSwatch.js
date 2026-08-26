import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Scenery from './Scenery.js';
import { colors } from '../theme/colors.js';
import { radius } from '../theme/layout.js';

/**
 * A background, small.
 *
 * The same three layers Screen.js draws, at card size, so the shop shows what a
 * place actually looks like rather than a swatch of its darkest colour. The
 * particles are static dots: animating a dozen of these behind a scrolling list
 * would cost more than it shows.
 */
const DOTS = [
  { left: '16%', top: '22%', size: 3 },
  { left: '38%', top: '13%', size: 2 },
  { left: '63%', top: '28%', size: 2.5 },
  { left: '82%', top: '16%', size: 2 },
  { left: '27%', top: '44%', size: 2 },
  { left: '72%', top: '48%', size: 3 },
];

const BackgroundSwatch = ({ background, height = 76, style }) => (
  <View style={[styles.frame, { height }, style]}>
    <LinearGradient
      colors={background.gradient}
      start={background.start}
      end={background.end}
      style={StyleSheet.absoluteFill}
    />

    {!!background.overlay && (
      <LinearGradient
        colors={background.overlay.colors}
        start={background.overlay.start}
        end={background.overlay.end}
        style={StyleSheet.absoluteFill}
      />
    )}

    <Scenery bands={background.scenery} />

    {DOTS.map((dot, index) => (
      <View
        key={index}
        style={{
          position: 'absolute',
          left: dot.left,
          top: dot.top,
          width: dot.size * background.particles.sizeScale,
          height: dot.size * background.particles.sizeScale,
          borderRadius: dot.size,
          backgroundColor: background.particles.tint,
          opacity: 0.75,
        }}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    // Required, or the scenery bands paint outside the rounded corners.
    overflow: 'hidden',
  },
});

export default BackgroundSwatch;
