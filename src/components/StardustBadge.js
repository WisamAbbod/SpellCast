import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfile } from '../hooks/useProfile.js';
import { balanceOf } from '../storage/wallet.js';
import { STARDUST_GLYPH } from '../game/economy.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import { tapFeedback } from '../audio/audio.js';

/**
 * The stardust balance, live.
 *
 * Subscribes to the profile rather than taking a number as a prop, so it stays
 * correct wherever it is dropped - including on the menu the instant a round
 * finishes paying out behind it.
 *
 * With onPress it becomes the way into the shop; without, it is just a readout.
 */
const StardustBadge = ({ onPress, style }) => {
  const profile = useProfile();
  const balance = balanceOf(profile);

  const body = (
    <>
      <Text style={styles.glyph}>{STARDUST_GLYPH}</Text>
      <Text style={styles.amount} numberOfLines={1}>
        {balance.toLocaleString()}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.badge, style]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.badge, styles.tappable, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`${balance} stardust. Open the shop.`}
    >
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.stardustDim,
    borderWidth: 1,
    borderColor: colors.stardustEdge,
  },
  tappable: { minHeight: 40 },
  pressed: { opacity: 0.7 },
  glyph: { fontSize: 13, color: colors.stardust },
  amount: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: colors.stardust,
    letterSpacing: 1,
  },
});

export default StardustBadge;
