import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSettings } from '../hooks/useSettings.js';
import { saveSettings } from '../storage/settings.js';
import { tapFeedback } from '../audio/audio.js';
import { colors } from '../theme/colors.js';
import { radius } from '../theme/layout.js';

/**
 * Background music on or off, from wherever you are.
 *
 * Music only. Sound effects - finding a word, the countdown - are feedback, not
 * decoration, and switching the soundtrack off should never take them with it.
 * Silencing everything is still there, as "Mute everything" in Settings.
 *
 * This button used to set that blunt `muted` flag, and the app remembers it, so
 * someone who once tapped it could be left with no music and no effects. So
 * while it reads as off, a tap clears `muted` as well as turning music on: one
 * tap gets everything back, and from then on it only ever touches music.
 *
 * The glyph is drawn rather than an emoji: emoji render at wildly different
 * sizes and colours across platforms, and this one sits beside the pause button.
 */
const MusicButton = ({ size = 44, style }) => {
  const { music, muted } = useSettings();
  const on = music && !muted;

  const toggle = () => {
    tapFeedback();
    // The audio layer is subscribed to settings, so it starts or stops the
    // loop as soon as this is saved.
    saveSettings(on ? { music: false } : { music: true, muted: false });
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
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? 'Music is on. Turn music off.' : 'Music is off. Turn music on.'}
    >
      <View style={styles.bars}>
        {barHeights.map((height, index) => (
          <View
            key={height}
            style={[
              styles.bar,
              {
                height: Math.round(size * 0.44 * height),
                backgroundColor: on ? colors.text : colors.textFaint,
                // The tallest bar carries the level, so an off meter still
                // reads as a meter rather than as four identical dashes.
                opacity: on ? 1 - index * 0.08 : 0.5,
              },
            ]}
          />
        ))}
      </View>

      {!on && <View style={[styles.slash, { width: size * 0.62 }]} />}
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

export default MusicButton;
