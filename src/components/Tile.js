import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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
 */
const Tile = memo(
  ({
    letter, selected, isWordBonus, isLetterBonus, popKey,
    size, letterSize, badgeSize, onLayout, reducedMotion,
  }) => {
    const select = useRef(new Animated.Value(1)).current;
    const pop = useRef(new Animated.Value(1)).current;
    const popCount = useRef(0);

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
          selected && styles.selected,
          isWordBonus && styles.wordBonus,
          isLetterBonus && styles.letterBonus,
          selected && (isWordBonus || isLetterBonus) && styles.selectedBonus,
        ]}
      >
        <Text
          style={[
            styles.letter,
            { fontSize: letterSize },
            selected && styles.letterSelected,
          ]}
          allowFontScaling={false}
        >
          {letter}
        </Text>

        {(isWordBonus || isLetterBonus) && (
          <View
            style={[
              styles.badge,
              { height: badgeSize, minWidth: badgeSize, borderRadius: badgeSize / 2 },
              isWordBonus ? styles.badgeWord : styles.badgeLetter,
            ]}
          >
            <Text style={[styles.badgeText, { fontSize: Math.round(badgeSize * 0.5) }]}>
              {isWordBonus ? '2x' : '3L'}
            </Text>
          </View>
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
  selected: {
    backgroundColor: colors.tileSelected,
    borderColor: '#B9A6FF',
    elevation: 8,
  },
  wordBonus: { borderColor: colors.tileWord, backgroundColor: '#FFF6DC' },
  letterBonus: { borderColor: colors.tileLetter, backgroundColor: '#DFFAFA' },
  selectedBonus: { backgroundColor: colors.tileSelected },
  letter: {
    fontFamily: fonts.displayBold,
    color: colors.tileText,
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  letterSelected: { color: '#FFFFFF' },
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
});

export default Tile;
