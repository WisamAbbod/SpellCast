import { Dimensions } from 'react-native';
// Merged from assets/words.txt + assets/words.json: uppercase, 3+ letters, A-Z
// only, deduped. words.json alone was missing most of the words the grid seeds
// (DREAM, QUEST, STORM...), so tracing them correctly still got rejected.
import rawWords from './assets/dictionary.json';

// Game rules
export const GRID_SIZE = 5; // 5x5 grid
export const GAME_DURATION = 60; // 1 minute in seconds
export const MIN_WORD_LENGTH = 3;

// Screen
export const SCREEN_WIDTH = Dimensions.get('window').width;
export const SCREEN_HEIGHT = Dimensions.get('window').height;

/* -------------------------------------------------------------- geometry --
 * Sized from the screen so the board always fits: a hard-coded cell size used
 * to push the outer columns off the edge of narrow phones, which made the
 * letters there impossible to hit.
 */
export const CELL_MARGIN = 6; // gap around each tile (half the gutter)
export const GRID_FRAME_PADDING = 14; // padding inside the grid frame
const SCREEN_PADDING = 14; // breathing room outside the frame

const availableWidth =
  Math.min(SCREEN_WIDTH, 520) - SCREEN_PADDING * 2 - GRID_FRAME_PADDING * 2;

export const CELL_SIZE = Math.max(
  40,
  Math.min(76, Math.floor(availableWidth / GRID_SIZE) - CELL_MARGIN * 2),
);
export const CELL_PITCH = CELL_SIZE + CELL_MARGIN * 2; // center-to-center spacing
export const GRID_WIDTH = CELL_PITCH * GRID_SIZE;
export const LETTER_FONT_SIZE = Math.round(CELL_SIZE * 0.46);

/* ----------------------------------------------------------- swipe feel --
 * Tuning knobs for the selection engine. Everything is expressed as a fraction
 * of the measured cell pitch, so it scales with the board.
 */
// How close to a cell center the finger must get, as a fraction of the pitch.
// Nearest-cell-wins, so this is really "how early a tile lights up". Above ~0.7
// the corner gaps disappear and diagonal swipes start grabbing cells you only
// clipped; below ~0.45 the board starts to feel dead.
export const HIT_RADIUS_RATIO = 0.58;
// Distance between hit-test samples along a swipe, as a fraction of the pitch.
export const SAMPLE_SPACING_RATIO = 0.25;
export const MAX_SAMPLES_PER_MOVE = 64; // safety valve for huge jumps
export const LIVE_POINT_EPSILON = 1.5; // px of finger movement worth redrawing
export const HAPTICS_ENABLED = true; // tiny buzz per letter (Android only)

// Legacy alias - the old hitbox was a fraction of the cell, not the pitch.
export const HITBOX_SCALE = HIT_RADIUS_RATIO * 2;

/* -------------------------------------------------------------- visuals -- */
export const PATH_COLOR = 'rgba(102, 126, 234, 0.95)';
export const PATH_COLOR_VALID = 'rgba(46, 213, 115, 0.95)';
export const PATH_THICKNESS = Math.max(6, Math.round(CELL_SIZE * 0.18));
export const PATH_NODE_SIZE = Math.max(10, Math.round(CELL_SIZE * 0.26));

/* ----------------------------------------------------------- dictionary -- */
export const wordList = rawWords;

const DICTIONARY = new Set(
  rawWords
    .map((word) => String(word).trim().toUpperCase())
    .filter((word) => word.length >= MIN_WORD_LENGTH),
);

export const isValidWord = (word) =>
  typeof word === 'string' &&
  word.length >= MIN_WORD_LENGTH &&
  DICTIONARY.has(word.toUpperCase());
