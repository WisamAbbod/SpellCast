import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ParticleField from './ParticleField.js';
import Scenery from './Scenery.js';
import { useSettings } from '../hooks/useSettings.js';
import { backgroundFor } from '../theme/backgrounds.js';
import { space } from '../theme/layout.js';

/**
 * The shell every screen sits in: the backdrop, and safe-area padding.
 *
 * SDK 54 forces edge-to-edge on Android, so content draws under the status bar
 * and the navigation bar unless something accounts for the insets. Nothing in
 * the old app did - it padded the top by a hardcoded 60 and hoped.
 *
 * This is the ONLY place a background is drawn, which is what makes the shop
 * possible without a theme system: the ~21 module-scope stylesheets elsewhere
 * bake in colors.* and cannot react to a swap, so nothing else may depend on
 * which background is equipped. Every catalog entry is required to stay dark
 * enough for those stylesheets to remain readable.
 *
 * `backgroundKey` overrides the equipped choice without persisting it, which is
 * the whole of the shop's preview mechanism - and why leaving the shop reverts
 * for free.
 */
const Screen = ({
  children,
  stars = 46,
  padded = true,
  edges = { top: true, bottom: true },
  style,
  backgroundKey,
  scenery = true,
}) => {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const background = backgroundFor(backgroundKey || settings.backgroundKey);
  const { particles } = background;
  const count = Math.max(0, Math.round(stars * particles.density));

  return (
    // The flat colour is inline, not in the stylesheet: it is what shows for the
    // frame before the gradient paints, so a static one would flash deep purple
    // on every push once anything but Nebula is equipped.
    <View style={[styles.root, { backgroundColor: background.flat }]}>
      <LinearGradient
        colors={background.gradient}
        start={background.start}
        end={background.end}
        style={StyleSheet.absoluteFill}
      />

      {!!background.overlay && (
        <LinearGradient
          colors={background.overlay.colors}
          start={background.overlay.start}
          end={background.overlay.end}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {/* Order matters: scenery sits behind the particles, so fireflies drift in
          front of the tree line and snow falls in front of the hills. */}
      {scenery && <Scenery bands={background.scenery} />}

      {count > 0 && (
        <ParticleField
          count={count}
          motion={particles.motion}
          tint={particles.tint}
          sizeScale={particles.sizeScale}
          glow={particles.glow}
          reducedMotion={settings.reducedMotion}
        />
      )}

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
  root: { flex: 1 },
  content: { flex: 1 },
  padded: { paddingHorizontal: space.lg },
});

export default Screen;
