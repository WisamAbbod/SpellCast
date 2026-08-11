import React from 'react';
import { StyleSheet, View } from 'react-native';
import Tile from './Tile.js';
import SwipePath from './SwipePath.js';
import { GRID_SIZE } from '../game/rules.js';
import { toIndex } from '../game/board.js';
import { colors } from '../theme/colors.js';
import { BOARD_PADDING, radius } from '../theme/layout.js';

/**
 * The 5x5 board.
 *
 * One flat wrapping surface holds every tile, so each tile's onLayout reports a
 * position relative to the same origin the swipe engine measures. The path
 * overlay is rendered last, above the tiles.
 */
const Board = ({
  board,
  layout,
  selection,
  bonus,
  popKeys,
  swipe,
  valid,
  reducedMotion,
}) => {
  const selected = new Set(selection.map((cell) => toIndex(cell.row, cell.col)));

  const tiles = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const index = toIndex(row, col);
      // Primitives only: an object literal here would defeat Tile's memo and
      // re-render all 25 tiles four times a second as the clock ticks.
      tiles.push(
        <Tile
          key={index}
          letter={board[index]}
          selected={selected.has(index)}
          isWordBonus={bonus ? bonus.wordMultiplier === index : false}
          isLetterBonus={bonus ? bonus.letterBonus === index : false}
          popKey={popKeys ? popKeys[index] || 0 : 0}
          size={layout.cellSize}
          letterSize={layout.letterSize}
          badgeSize={layout.badgeSize}
          reducedMotion={reducedMotion}
          onLayout={swipe.onCellLayout(row, col)}
        />,
      );
    }
  }

  return (
    <View style={[styles.frame, { width: layout.frameWidth, borderRadius: radius.lg + 6 }]}>
      <View
        ref={swipe.gridRef}
        onLayout={swipe.onGridLayout}
        collapsable={false}
        style={[styles.surface, { width: layout.boardWidth }]}
      >
        {tiles}
        <SwipePath
          path={selection}
          getCellCenter={swipe.getCellCenter}
          subscribeToLivePoint={swipe.subscribeToLivePoint}
          geometryVersion={swipe.geometryVersion}
          valid={valid}
          thickness={layout.pathThickness}
          nodeSize={layout.pathNodeSize}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    padding: BOARD_PADDING,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  surface: { flexDirection: 'row', flexWrap: 'wrap' },
});

export default Board;
