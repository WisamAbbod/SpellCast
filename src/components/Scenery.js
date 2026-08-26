import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The silhouette bands that make a background a place rather than a wash.
 *
 * Deliberately dumb: every path, colour and dimension arrives from
 * theme/backgrounds.js, so the art is pure data that the node tests can check
 * for truncation - a malformed `d` draws nothing and reports nothing.
 *
 * Static, so it renders under reduced motion too. Reduced motion is about
 * movement, not about taking away what somebody bought.
 */
const Scenery = ({ bands }) => {
  if (!bands || !bands.length) return null;

  return (
    <>
      {bands.map((band, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.band,
            band.anchor === 'top' ? { top: 0 } : { bottom: 0 },
            { height: `${band.height * 100}%` },
          ]}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox={band.viewBox}
            // slice, never none: "none" stretches the viewBox to fit, which
            // squashes a pine into a shrub on a tablet. Cropping the sides of a
            // silhouette is invisible; distorting it is not.
            preserveAspectRatio={band.anchor === 'top' ? 'xMidYMin slice' : 'xMidYMax slice'}
          >
            {band.layers.map((layer, layerIndex) => (
              <Path key={layerIndex} {...layer} />
            ))}
          </Svg>
        </View>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0 },
});

export default Scenery;
