import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Stat.js';
import { STARDUST_GLYPH } from '../game/economy.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { space } from '../theme/layout.js';

/**
 * What a finished round paid, itemised.
 *
 * Shared by the daily/practice results and slow mode's, because the two screens
 * would otherwise grow the same twenty lines twice - and the breakdown is the
 * only place the earning rules are ever explained to a player.
 *
 * Renders nothing at all when there was nothing to say. `earned` is undefined
 * for a game that finished before any of this shipped, so every field here is
 * read defensively.
 */
const EarnedCard = ({ earned, emptyNote, style }) => {
  if (!earned) return null;

  const total = earned.total || 0;
  const lines = earned.lines || [];

  // Nothing earned and no reason worth explaining: say nothing rather than
  // showing someone a card full of zeroes.
  if (total === 0 && !earned.capped && !earned.claimed) return null;

  if (total === 0) {
    return (
      <Card title="Stardust" style={style}>
        <Text style={styles.note}>{emptyNote}</Text>
        {typeof earned.balance === 'number' && (
          <Text style={styles.balance}>
            {earned.balance.toLocaleString()} {STARDUST_GLYPH} in the bank
          </Text>
        )}
      </Card>
    );
  }

  return (
    <Card title="Stardust earned" style={style}>
      <Text style={styles.total}>
        +{total.toLocaleString()} {STARDUST_GLYPH}
      </Text>

      <View style={styles.lines}>
        {lines.map((entry) => (
          <View key={entry.key} style={styles.line}>
            <Text style={styles.label} numberOfLines={1}>
              {entry.label}
            </Text>
            <Text style={styles.amount}>+{entry.amount}</Text>
          </View>
        ))}
      </View>

      {!!earned.capped && <Text style={styles.note}>{emptyNote}</Text>}

      {typeof earned.balance === 'number' && (
        <Text style={styles.balance}>
          {earned.balance.toLocaleString()} {STARDUST_GLYPH} in the bank
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  total: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.stardust,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: space.sm,
  },
  lines: { gap: 4 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  label: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    textTransform: 'capitalize',
  },
  amount: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.stardust },
  note: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: space.sm,
    lineHeight: 16,
  },
  balance: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: space.sm,
    letterSpacing: 0.5,
  },
});

export default EarnedCard;
