import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import { tapFeedback } from '../audio/audio.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius } from '../theme/layout.js';

/**
 * A small square button for the top bar, in the same chrome as MusicButton so a
 * row of them reads as one set.
 *
 * The glyphs are drawn, not emoji: a gear emoji is grey on one platform, blue on
 * another and twice the size on a third.
 */
export const Gear = ({ size = 20, color = colors.text }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <G transform="translate(12 12)">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <Rect key={angle} x={-1.8} y={-11} width={3.6} height={5} rx={1.2} fill={color} rotation={angle} />
      ))}
      <Circle r={6.6} fill="none" stroke={color} strokeWidth={2.8} />
    </G>
  </Svg>
);

export const Question = ({ size = 20, color = colors.text }) => (
  <Text style={[styles.glyph, { fontSize: size, color }]}>?</Text>
);

const IconButton = ({ onPress, accessibilityLabel, children, size = 44, style }) => (
  <Pressable
    onPress={() => {
      tapFeedback();
      onPress();
    }}
    hitSlop={8}
    style={({ pressed }) => [
      styles.button,
      { width: size, height: size, borderRadius: radius.md },
      pressed && styles.pressed,
      style,
    ]}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
  >
    {children}
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  glyph: { fontFamily: fonts.displayBold, lineHeight: 24 },
});

export default IconButton;
