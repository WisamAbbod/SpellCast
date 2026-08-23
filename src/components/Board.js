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
 *
 * Bonus tiles arrive one of two ways. Daily mode passes `bonus`, which names
 * one 2x-word cell and one triple-letter cell. Slow mode passes `modifiers`, a
 * per-cell array, plus `gems`. `modifiers` wins if both are given.
 *
 * `onTilePress` turns the board into a picker (used by the swap ability); while
 * it is set the swipe handlers should be off, or a tap starts tracing a word.
 */
const Board = ({
  board,
  layout,
  selection,
  bonus,
  modifiers,
  gems,
  popKeys,
  replaceKeys,
  letterValue,
  swipe,
  valid,
  reducedMotion,
  onTilePress,
  pathTone,
}) => {
  const selected = new Set(selection.map((cell) => toIndex(cell.row, cell.col)));

  const modifierAt = (index) => {
    if (modifiers) return modifiers[index] || null;
    if (!bonus) return null;
    if (bonus.wordMultiplier === index) return 'DW';
    if (bonus.letterBonus === index) return 'TL';
    return null;
  };

  const tiles = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const index = toIndex(row, col);
      // Primitives only: an object literal here would defeat Tile's memo and
      // re-render all 25 tiles four times a second as the clock ticks.
      //
      // The picker handler goes INTO the tile rather than wrapping it. Wrapping
      // re-parents the tile, so its onLayout starts reporting a position
      // relative to the wrapper instead of the board surface - every measured
      // cell centre collapses onto one point and the swipe engine stops being
      // able to tell the tiles apart. onTilePress is undefined unless a picker
      // is open, so the common case still passes a stable value to the memo.
      tiles.push(
        <Tile
          key={index}
          letter={board[index]}
          selected={selected.has(index)}
          modifier={modifierAt(index)}
          gem={gems ? !!gems[index] : false}
          popKey={popKeys ? popKeys[index] || 0 : 0}
          replaceKey={replaceKeys ? replaceKeys[index] || 0 : 0}
          value={letterValue ? letterValue(board[index]) : undefined}
          index={index}
          size={layout.cellSize}
          letterSize={layout.letterSize}
          badgeSize={layout.badgeSize}
          reducedMotion={reducedMotion}
          onLayout={swipe.onCellLayout(row, col)}
          onPress={onTilePress ? () => onTilePress(index) : undefined}
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
          tone={pathTone}
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
    // Letters thrown off the board have to be able to leave it.
    overflow: 'visible',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  surface: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'visible' },
});

export default Board;
