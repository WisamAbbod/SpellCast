import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { styles } from './styles.js';
import { PATH_COLOR, PATH_COLOR_VALID, PATH_NODE_SIZE, PATH_THICKNESS } from './game_constants.js';

/**
 * Draws the glowing line that follows the swipe: one segment per pair of
 * selected cells, plus a live segment running out to the finger.
 *
 * It subscribes to the pointer imperatively so that moving the finger only
 * re-renders this overlay - never the 25 letter tiles.
 */
const SwipePath = ({ path, getCellCenter, subscribeToLivePoint, valid, geometryVersion }) => {
  const [livePoint, setLivePoint] = useState(null);

  useEffect(() => subscribeToLivePoint(setLivePoint), [subscribeToLivePoint]);

  const centers = useMemo(
    () => path.map((cell) => getCellCenter(cell.row, cell.col)).filter(Boolean),
    // geometryVersion re-reads the centers once the grid has been measured
    [path, getCellCenter, geometryVersion],
  );

  if (centers.length === 0) return null;

  const color = valid ? PATH_COLOR_VALID : PATH_COLOR;
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
          styles.pathSegment,
          {
            backgroundColor: color,
            shadowColor: color,
            width: length,
            left: from.x + dx / 2 - length / 2,
            top: from.y + dy / 2 - PATH_THICKNESS / 2,
            transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
          },
        ]}
      />,
    );
  }

  return (
    <View pointerEvents="none" style={styles.pathLayer}>
      {segments}
      {centers.map((point, index) => (
        <View
          key={`node-${index}`}
          style={[
            styles.pathNode,
            {
              backgroundColor: color,
              shadowColor: color,
              left: point.x - PATH_NODE_SIZE / 2,
              top: point.y - PATH_NODE_SIZE / 2,
            },
          ]}
        />
      ))}
    </View>
  );
};

export default SwipePath;
