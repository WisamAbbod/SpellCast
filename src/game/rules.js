/**
 * The rules of the game. Zero imports, on purpose: everything in src/game must
 * be loadable under plain `node` so it can be tested without a device.
 */

export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export const GAME_DURATION = 60; // seconds in a round
export const MIN_WORD_LENGTH = 3;

/** Consecutive words inside this window keep a combo alive. */
export const COMBO_WINDOW_MS = 6000;
export const COMBO_STEP = 0.25; // +25% per link
export const COMBO_MAX = 2.5;

/** Shuffles are free but rate-limited, so they can't be spammed for a better board. */
export const SHUFFLE_COOLDOWN_MS = 12000;
// One, so it is a decision rather than a habit. (There were three, with the
// cooldown below between them - and a greyed-out button showing "2" read as
// "used up", not "wait twelve seconds". The cooldown only matters again if
// this is ever raised.)
export const SHUFFLES_PER_ROUND = 1;

/** Bonus tiles, fixed for the whole round once seeded. */
export const WORD_MULTIPLIER = 2;
export const LETTER_MULTIPLIER = 3;
