import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StarField from './StarField.js';
import { useSettings } from '../hooks/useSettings.js';
import { colors } from '../theme/colors.js';
import { space } from '../theme/layout.js';

/**
 * The shell every screen sits in: the gradient backdrop, the starfield, and
 * safe-area padding.
 *
 * SDK 54 forces edge-to-edge on Android, so content draws under the status bar
 * and the navigation bar unless something accounts for the insets. Nothing in
 * the old app did - it padded the top by a hardcoded 60 and hoped.
 */
const Screen = ({
  children,
  stars = 46,
  padded = true,
  edges = { top: true, bottom: true },
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.backdrop}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {stars > 0 && <StarField count={stars} reducedMotion={reducedMotion} />}
      <View
        style={[
          styles.content,
          padded && styles.padded,
          {
            paddingTop: (edges.top ? insets.top : 0) + (padded ? space.md : 0),
            paddingBottom: (edges.bottom ? insets.bottom : 0) + (padded ? space.md : 0),
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backdropFlat },
  content: { flex: 1 },
  padded: { paddingHorizontal: space.lg },
});

export default Screen;
