import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSettings } from '../hooks/useSettings.js';
import { saveSettings } from '../storage/settings.js';
import { tapFeedback } from '../audio/audio.js';
import { colors } from '../theme/colors.js';
import { radius } from '../theme/layout.js';

/**
 * Silence everything, from wherever you are.
 *
 * Settings still has separate music and effects controls; this is the blunt one
 * for when the phone needs to be quiet now. It sets a single `muted` flag that
 * the audio layer checks first, so unmuting restores exactly the mix the player
 * had rather than switching both channels back on.
 *
 * The glyph is drawn rather than an emoji: emoji speakers render at wildly
 * different sizes and colours across platforms, and this one has to sit next to
 * the pause button without looking like a different app.
 */
const MuteButton = ({ size = 44, style }) => {
  const { muted } = useSettings();

  const toggle = () => {
    tapFeedback();
    saveSettings({ muted: !muted });
  };

  const barHeights = [0.34, 0.58, 0.82, 0.5];

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: radius.md },
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: muted }}
      accessibilityLabel={muted ? 'Sound is off. Turn sound on.' : 'Sound is on. Turn sound off.'}
    >
      <View style={styles.bars}>
        {barHeights.map((height, index) => (
          <View
            key={height}
            style={[
              styles.bar,
              {
                height: Math.round(size * 0.44 * height),
                backgroundColor: muted ? colors.textFaint : colors.text,
                // The tallest bar carries the level, so a muted meter still
                // reads as a meter rather than as four identical dashes.
                opacity: muted ? 0.5 : 1 - index * 0.08,
              },
            ]}
          />
        ))}
      </View>

      {muted && <View style={[styles.slash, { width: size * 0.62 }]} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { width: 2.5, borderRadius: 2 },
  slash: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.danger,
    transform: [{ rotate: '-45deg' }],
  },
});

export default MuteButton;
