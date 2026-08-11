import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';

/** A labelled number. Used across the results, stats and daily screens. */
export const Stat = ({ label, value, tint, small }) => (
  <View style={styles.stat}>
    <Text
      style={[styles.value, small && styles.valueSmall, tint ? { color: tint } : null]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
    <Text style={styles.label} numberOfLines={2}>
      {label}
    </Text>
  </View>
);

export const StatRow = ({ children }) => <View style={styles.row}>{children}</View>;

export const Card = ({ children, style, title, action }) => (
  <View style={[styles.card, style]}>
    {(!!title || !!action) && (
      <View style={styles.cardHeader}>
        {!!title && <Text style={styles.cardTitle}>{title}</Text>}
        {action}
      </View>
    )}
    {children}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  value: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 0.5,
  },
  valueSmall: { fontSize: 18 },
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textFaint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textDim,
    textTransform: 'uppercase',
  },
});

export default Stat;
