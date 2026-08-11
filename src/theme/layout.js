import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { GRID_SIZE } from '../game/rules.js';

/**
 * Board geometry, derived from the live window size.
 *
 * The old constants were computed once at module load from Dimensions.get(),
 * with a hardcoded 65px cell that made the board 435px wide - wider than most
 * phones, so the outer columns hung off the screen. Everything here is a
 * function of the space actually available, and re-derives on rotation.
 *
 * The swipe engine measures the rendered tiles rather than trusting these
 * numbers, so a mismatch can never break hit detection - this only decides how
 * big things look.
 */

export const CELL_GAP = 6; // half the gutter between tiles
export const BOARD_PADDING = 14; // inside the board frame
const SCREEN_PADDING = 14; // outside it
const MIN_CELL = 40;
const MAX_CELL = 76;

export const getBoardLayout = (windowWidth, windowHeight) => {
  const usableWidth =
    Math.min(windowWidth, 520) - SCREEN_PADDING * 2 - BOARD_PADDING * 2;

  // Leave room for the HUD above and the word rail below on short screens.
  const usableHeight = Math.max(220, windowHeight * 0.46) - BOARD_PADDING * 2;

  const cellSize = Math.max(
    MIN_CELL,
    Math.min(
      MAX_CELL,
      Math.floor(Math.min(usableWidth, usableHeight) / GRID_SIZE) - CELL_GAP * 2,
    ),
  );

  const pitch = cellSize + CELL_GAP * 2;
  return {
    cellSize,
    pitch,
    boardWidth: pitch * GRID_SIZE,
    frameWidth: pitch * GRID_SIZE + BOARD_PADDING * 2,
    letterSize: Math.round(cellSize * 0.44),
    pathThickness: Math.max(6, Math.round(cellSize * 0.17)),
    pathNodeSize: Math.max(10, Math.round(cellSize * 0.26)),
    badgeSize: Math.max(14, Math.round(cellSize * 0.32)),
  };
};

export const useBoardLayout = () => {
  const { width, height } = useWindowDimensions();
  return useMemo(() => getBoardLayout(width, height), [width, height]);
};

/** Shared spacing scale, so padding stops being a series of magic numbers. */
export const space = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 };
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
