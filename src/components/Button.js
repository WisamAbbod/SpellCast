import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tapFeedback } from '../audio/audio.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';

/**
 * The one button. Variants rather than a new set of styles per screen, and a
 * 48px minimum height everywhere so nothing is fiddly to hit.
 */
const Button = ({
  label,
  onPress,
  variant = 'primary', // primary | secondary | ghost | danger
  icon,
  disabled = false,
  subtitle,
  style,
  accessibilityLabel,
}) => {
  const handlePress = () => {
    if (disabled) return;
    tapFeedback();
    onPress?.();
  };

  const content = (
    <View style={styles.inner}>
      {!!icon && <Text style={styles.icon}>{icon}</Text>}
      <View style={styles.labels}>
        <Text style={[styles.label, variant === 'ghost' && styles.labelGhost]}>{label}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {variant === 'primary' && !disabled ? (
        <LinearGradient
          colors={[colors.primary, '#5B3FE0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.lg,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    minHeight: 48,
  },
  danger: {
    backgroundColor: 'rgba(255, 94, 125, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 125, 0.5)',
  },
  disabled: { backgroundColor: 'rgba(255,255,255,0.06)', opacity: 0.6 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  labels: { alignItems: 'center' },
  icon: { fontSize: 20, marginRight: space.sm },
  label: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 15,
    letterSpacing: 1,
  },
  labelGhost: { fontFamily: fonts.bodySemi, letterSpacing: 0.4, color: colors.textDim },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.3,
  },
});

export default Button;
