import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';

/**
 * The in-theme dialog that replaces Alert.alert.
 *
 * The old pause and game-over flows used the OS alert box, which looked like it
 * belonged to a different app entirely.
 */
const Sheet = ({ visible, title, subtitle, children, onRequestClose, dismissable = true }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    statusBarTranslucent
    onRequestClose={onRequestClose}
  >
    <Pressable
      style={styles.backdrop}
      onPress={dismissable ? onRequestClose : undefined}
      accessibilityRole={dismissable ? 'button' : undefined}
      accessibilityLabel={dismissable ? 'Dismiss' : undefined}
    >
      <Pressable style={styles.card} onPress={() => {}}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.body}>{children}</View>
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 3, 12, 0.82)',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: {
    backgroundColor: '#161233',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryEdge,
    padding: space.xl,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: space.sm,
    lineHeight: 20,
  },
  body: { marginTop: space.lg, gap: space.sm },
});

export default Sheet;
