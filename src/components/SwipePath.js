import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors.js';

/**
 * The glowing trail that follows the swipe: one segment per pair of selected
 * tiles, plus a live segment running out to the finger.
 *
 * Drawn ABOVE the tiles with alpha. Underneath them - which is where it used to
 * be - opaque tiles hid everything except the sliver crossing each gutter.
 *
 * It subscribes to the pointer imperatively, so moving a finger re-renders this
 * overlay only, never the 25 tiles.
 */
const SwipePath = ({
  path,
  getCellCenter,
  subscribeToLivePoint,
  valid,
  tone,
  geometryVersion,
  thickness,
  nodeSize,
}) => {
  const [livePoint, setLivePoint] = useState(null);

  useEffect(() => subscribeToLivePoint(setLivePoint), [subscribeToLivePoint]);

  const centers = useMemo(
    () => path.map((cell) => getCellCenter(cell.row, cell.col)).filter(Boolean),
    // geometryVersion re-reads the centres once the board has been measured
    [path, getCellCenter, geometryVersion],
  );

  if (centers.length === 0) return null;

  // An explicit tone wins: a hint or a bot's move is not "the word you are
  // currently tracing", so it should not be green just because it is valid.
  const color =
    (tone === 'hint' && colors.pathHint) ||
    (tone === 'bot' && colors.pathBot) ||
    (valid ? colors.pathValid : colors.path);
  const points = livePoint ? [...centers, livePoint] : centers;
  const segments = [];

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) continue;

    segments.push(
      <View
        key={`segment-${i}`}
        style={[
          styles.segment,
          {
            backgroundColor: color,
            height: thickness,
            borderRadius: thickness / 2,
            width: length,
            left: from.x + dx / 2 - length / 2,
            top: from.y + dy / 2 - thickness / 2,
            transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
          },
        ]}
      />,
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
      {segments}
      {centers.map((point, index) => (
        <View
          key={`node-${index}`}
          style={[
            styles.node,
            {
              backgroundColor: color,
              width: nodeSize,
              height: nodeSize,
              borderRadius: nodeSize / 2,
              left: point.x - nodeSize / 2,
              top: point.y - nodeSize / 2,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  // zIndex orders it on iOS; elevation is what actually matters on Android,
  // where a tile's elevation beats document order. It goes on the segments
  // themselves rather than this container - an elevated transparent container
  // would cast a rectangular shadow across the whole board.
  layer: { zIndex: 10 },
  segment: { position: 'absolute', elevation: 12 },
  node: { position: 'absolute', elevation: 12 },
});

export default SwipePath;
