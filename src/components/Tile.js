import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { CELL_GAP } from '../theme/layout.js';

/**
 * One letter tile.
 *
 * Two independent scale animations multiply together: `select` tracks whether
 * the tile is in the current word, `pop` is the celebration when a word lands.
 * Sharing one value would mean the pop cancels the deselect and tiles get stuck
 * mid-animation.
 *
 * `modifier` is the bonus tile sitting under the letter - 'DL', 'TL' or 'DW'.
 * Daily mode only ever uses TL and DW; slow mode uses all three and adds gems.
 */

const BADGES = {
  DL: { label: 'DL', tone: 'letter' },
  TL: { label: 'TL', tone: 'letter' },
  DW: { label: '2x', tone: 'word' },
};

const Tile = memo(
  ({
    letter, selected, modifier, gem, popKey, replaceKey, value,
    size, letterSize, badgeSize, index, onLayout, onPress, reducedMotion,
  }) => {
    const select = useRef(new Animated.Value(1)).current;
    const pop = useRef(new Animated.Value(1)).current;
    const popCount = useRef(0);

    // The letter being thrown away, kept only while it is in flight.
    const [outgoing, setOutgoing] = useState(null);
    const exit = useRef(new Animated.Value(0)).current;
    const enter = useRef(new Animated.Value(1)).current;
    const previousLetter = useRef(letter);
    const replaceCount = useRef(replaceKey || 0);

    useEffect(() => {
      if (reducedMotion) {
        select.setValue(1);
        return undefined;
      }
      const animation = Animated.timing(select, {
        toValue: selected ? 1.1 : 1,
        duration: selected ? 90 : 140,
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [selected, reducedMotion, select]);

    // `popKey` increments when this tile was part of an accepted word.
    useEffect(() => {
      if (popKey === popCount.current) return undefined;
      popCount.current = popKey;
      if (popKey === 0 || reducedMotion) return undefined;

      const animation = Animated.sequence([
        Animated.timing(pop, { toValue: 1.28, duration: 170, useNativeDriver: true }),
        Animated.spring(pop, {
          toValue: 1, friction: 4, tension: 90, useNativeDriver: true,
        }),
      ]);
      animation.start();
      return () => animation.stop();
    }, [popKey, pop, reducedMotion]);

    /**
     * Slow mode replaces the letters a word used, and a letter that simply
     * blinks into a different one reads as a glitch. So the old one is thrown
     * off the board while the new one drops in behind it.
     *
     * Driven by `replaceKey` rather than by watching `letter`, because a letter
     * can legitimately be replaced by the same letter - and that still needs to
     * animate, or one tile in the word would sit there looking broken.
     *
     * Transform and opacity only, so it runs on the native driver and cannot
     * disturb the onLayout the swipe engine measures cell centres from.
     */
    useEffect(() => {
      const key = replaceKey || 0;
      if (key === replaceCount.current) {
        previousLetter.current = letter;
        return undefined;
      }

      replaceCount.current = key;
      const leaving = previousLetter.current;
      previousLetter.current = letter;

      if (reducedMotion) return undefined;

      setOutgoing(leaving);
      exit.setValue(0);
      enter.setValue(0);

      const animation = Animated.parallel([
        Animated.timing(exit, {
          toValue: 1,
          duration: 460,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          // Long enough that the two letters read as separate events rather
          // than a crossfade.
          Animated.delay(130),
          Animated.spring(enter, {
            toValue: 1, friction: 6, tension: 80, useNativeDriver: true,
          }),
        ]),
      ]);

      animation.start(({ finished }) => {
        if (finished) setOutgoing(null);
      });

      return () => animation.stop();
    }, [replaceKey, letter, reducedMotion, exit, enter]);

    // Deterministic per cell, so neighbouring letters scatter instead of
    // leaving in one column.
    const drift = (((index || 0) % 5) - 2) * size * 0.42;

    const badge = BADGES[modifier];
    const isWord = badge && badge.tone === 'word';
    const isLetter = badge && badge.tone === 'letter';

    return (
      <Animated.View
        onLayout={onLayout}
        style={[
          styles.tile,
          {
            width: size,
            height: size,
            margin: CELL_GAP,
            borderRadius: Math.round(size * 0.26),
            transform: [{ scale: select }, { scale: pop }],
          },
          isWord && styles.wordBonus,
          isLetter && styles.letterBonus,
          selected && styles.selected,
          // Selection takes the fill, but a bonus tile keeps its edge - losing
          // it mid-trace hides the one thing worth aiming at.
          selected && isWord && styles.selectedOnWord,
          selected && isLetter && styles.selectedOnLetter,
        ]}
      >
        <Animated.Text
          style={[
            styles.letter,
            { fontSize: letterSize },
            selected && styles.letterSelected,
            {
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-size * 0.85, 0],
                  }),
                },
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
              ],
            },
          ]}
          allowFontScaling={false}
        >
          {letter}
        </Animated.Text>

        {outgoing !== null && (
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.letter,
              styles.outgoing,
              { fontSize: letterSize },
              {
                opacity: exit.interpolate({
                  inputRange: [0, 0.55, 1],
                  outputRange: [1, 0.85, 0],
                }),
                transform: [
                  {
                    translateY: exit.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -size * 6.5],
                    }),
                  },
                  {
                    translateX: exit.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }),
                  },
                  {
                    rotate: exit.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', drift < 0 ? '-55deg' : '55deg'],
                    }),
                  },
                  { scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
                ],
              },
            ]}
            allowFontScaling={false}
          >
            {outgoing}
          </Animated.Text>
        )}

        {value != null && (
          <Animated.Text
            style={[
              styles.value,
              { fontSize: Math.max(9, Math.round(size * 0.23)), opacity: enter },
              selected && styles.valueSelected,
            ]}
            allowFontScaling={false}
          >
            {value}
          </Animated.Text>
        )}

        {!!badge && (
          <View
            style={[
              styles.badge,
              { height: badgeSize, minWidth: badgeSize, borderRadius: badgeSize / 2 },
              isWord ? styles.badgeWord : styles.badgeLetter,
            ]}
          >
            <Text style={[styles.badgeText, { fontSize: Math.round(badgeSize * 0.5) }]}>
              {badge.label}
            </Text>
          </View>
        )}

        {/* The picker overlays the tile rather than wrapping it: a wrapper
            would re-parent the tile and break the onLayout that the swipe
            engine measures every cell centre from. */}
        {!!onPress && (
          <Pressable
            onPress={onPress}
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={`Replace ${letter}`}
          />
        )}

        {!!gem && (
          <View
            style={[
              styles.gem,
              {
                width: Math.round(badgeSize * 0.72),
                height: Math.round(badgeSize * 0.72),
                borderRadius: Math.round(badgeSize * 0.16),
              },
            ]}
          />
        )}
      </Animated.View>
    );
  },
);

Tile.displayName = 'Tile';

const styles = StyleSheet.create({
  tile: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.tile,
    borderWidth: 2,
    borderColor: 'transparent',
    // Kept modest: the gutter is only 12px, and the old 20px shadow radius on
    // the bonus tile bled over its neighbours.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  // Selection is listed last in the style array so it wins over a bonus tile:
  // a selected 2x tile should read as selected first.
  selected: {
    backgroundColor: colors.tileSelected,
    borderColor: '#B9A6FF',
    elevation: 8,
  },
  wordBonus: { borderColor: colors.tileWord, backgroundColor: '#FFF6DC' },
  letterBonus: { borderColor: colors.tileLetter, backgroundColor: '#DFFAFA' },
  selectedOnWord: { borderColor: colors.tileWord },
  selectedOnLetter: { borderColor: colors.tileLetter },
  letter: {
    fontFamily: fonts.displayBold,
    color: colors.tileText,
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  letterSelected: { color: '#FFFFFF' },
  // Bottom right, the one free corner: the bonus badge sits top right and the
  // gem bottom left. Held well back from the letter so it reads as an
  // annotation rather than a second character on the tile.
  value: {
    position: 'absolute',
    right: 4,
    bottom: 2,
    fontFamily: fonts.bodyBold,
    color: colors.tileText,
    opacity: 0.5,
    includeFontPadding: false,
  },
  valueSelected: { color: '#FFFFFF', opacity: 0.85 },
  // Absolute so the departing letter cannot push the resident one around, and
  // lifted so it passes over its neighbours rather than under them.
  outgoing: { position: 'absolute', zIndex: 30, elevation: 30 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#100E22',
  },
  badgeWord: { backgroundColor: colors.tileWord },
  badgeLetter: { backgroundColor: colors.tileLetter },
  badgeText: {
    fontFamily: fonts.displayBold,
    color: '#231C05',
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  // A gem rotated onto its corner, so it reads as a jewel rather than a dot.
  gem: {
    position: 'absolute',
    left: -4,
    bottom: -4,
    backgroundColor: colors.gem,
    borderWidth: 1.5,
    borderColor: '#100E22',
    transform: [{ rotate: '45deg' }],
  },
});

export default Tile;
