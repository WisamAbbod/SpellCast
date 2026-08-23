import { CELL_COUNT } from '../rules.js';
import { drawLetter, repairVowels } from '../letters.js';
import { makeRng, rngInt, rngShuffle } from '../rng.js';
import { solveBoard } from '../solver.js';
import { getBoard } from '../generator.js';
import {
  BONUS_TILE_PLAN,
  GEM_TILES_MAX,
  GEM_TILES_MIN,
} from './rules.js';

/**
 * The shared board, and how it changes hands.
 *
 * Unlike the daily board - fixed for sixty seconds - this one mutates after
 * every word: the letters that were used are replaced, the bonus tiles move,
 * and gems respawn. That is what keeps five rounds interesting rather than five
 * players racing to spot the same word.
 *
 * Everything is seeded, so a whole game replays identically from its seed. That
 * is worth more for testing than it is for play, but it costs nothing.
 */

const MIN_WORDS_AFTER_REFILL = 20;
const MAX_REFILL_ATTEMPTS = 8;

/** A named sub-stream, so a change to one thing never shifts another. */
export const slowSeed = (base, ...parts) => `${base}:${parts.join(':')}`;

/* --------------------------------------------------------------- solve -- */

let cacheKey = null;
let cacheValue = null;

/**
 * Solving costs a couple of milliseconds, and a turn asks three times over
 * (playability check, bot move, hint). One-entry memo, because there is only
 * ever one live board.
 */
export const analyseSlowBoard = (letters) => {
  const key = letters.join('');
  if (key === cacheKey) return cacheValue;
  cacheKey = key;
  cacheValue = solveBoard(letters);
  return cacheValue;
};

/* --------------------------------------------------------------- tiles -- */

/** Distinct cells for each bonus tile, re-rolled every turn. */
export const placeBonusTiles = (rng) => {
  const modifiers = new Array(CELL_COUNT).fill(null);
  const cells = rngShuffle(
    rng,
    Array.from({ length: CELL_COUNT }, (_, index) => index),
  );

  let cursor = 0;
  BONUS_TILE_PLAN.forEach((entry) => {
    for (let i = 0; i < entry.count && cursor < cells.length; i++) {
      modifiers[cells[cursor++]] = entry.type;
    }
  });

  return modifiers;
};

/**
 * Tops the board back up to a gem count inside the band, keeping whatever is
 * still there. Gems are only ever removed by being collected.
 */
export const replenishGems = (gems, rng) => {
  const next = gems.slice();
  const held = [];
  const free = [];

  for (let i = 0; i < CELL_COUNT; i++) {
    if (next[i]) held.push(i);
    else free.push(i);
  }

  const target = GEM_TILES_MIN + rngInt(rng, GEM_TILES_MAX - GEM_TILES_MIN + 1);
  const wanted = Math.max(0, target - held.length);

  rngShuffle(rng, free);
  for (let i = 0; i < wanted && i < free.length; i++) next[free[i]] = true;

  return next;
};

/* --------------------------------------------------------------- board -- */

const withMeta = (letters, modifiers, gems, version) => ({
  letters,
  modifiers,
  gems,
  version,
});

/**
 * The opening board comes from the daily generator, which builds several
 * candidates and keeps the one with the most good words - so nobody's first
 * turn is a dead board.
 */
export const createSlowBoard = (seed) => {
  const generated = getBoard(slowSeed(seed, 'board'));
  const rng = makeRng(slowSeed(seed, 'tiles', 0));

  return withMeta(
    generated.board.slice(),
    placeBonusTiles(rng),
    replenishGems(new Array(CELL_COUNT).fill(false), rng),
    0,
  );
};

/**
 * Replaces the letters a word consumed, moves the bonus tiles, and respawns
 * gems.
 *
 * The refill is checked with the solver and redrawn if it left the board too
 * thin. It can't fail outright - after the attempts run out the last draw is
 * used, which is still a legal board, just a less generous one.
 */
export const refillBoard = (state, usedIndices, seed, turnIndex) => {
  const used = new Set(usedIndices);
  let letters = state.letters;

  for (let attempt = 0; attempt < MAX_REFILL_ATTEMPTS; attempt++) {
    const rng = makeRng(slowSeed(seed, 'refill', turnIndex, attempt));
    const candidate = state.letters.slice();
    used.forEach((index) => {
      candidate[index] = drawLetter(rng);
    });
    repairVowels(candidate, rng);

    letters = candidate;
    if (analyseSlowBoard(candidate).count >= MIN_WORDS_AFTER_REFILL) break;
  }

  const rng = makeRng(slowSeed(seed, 'tiles', turnIndex + 1));
  const gems = state.gems.slice();
  used.forEach((index) => {
    gems[index] = false; // collected by whoever played the word
  });

  return withMeta(letters, placeBonusTiles(rng), replenishGems(gems, rng), state.version + 1);
};

/**
 * Shuffle ability: the same 25 letters in new places. The bonus tiles and gems
 * stay where they are - shuffling letters onto the 2x tile is the point.
 */
export const shuffleBoardLetters = (state, seed, turnIndex) => {
  let letters = state.letters;

  for (let attempt = 0; attempt < MAX_REFILL_ATTEMPTS; attempt++) {
    const rng = makeRng(slowSeed(seed, 'shuffle', turnIndex, attempt));
    const candidate = rngShuffle(rng, state.letters.slice());
    letters = candidate;
    if (analyseSlowBoard(candidate).count >= MIN_WORDS_AFTER_REFILL) break;
  }

  return withMeta(letters, state.modifiers, state.gems, state.version + 1);
};

/** Swap ability: one cell, one new letter. */
export const swapBoardLetter = (state, index, letter) => {
  if (index < 0 || index >= CELL_COUNT) return state;
  const letters = state.letters.slice();
  letters[index] = String(letter || '').toUpperCase().slice(0, 1) || letters[index];
  return withMeta(letters, state.modifiers, state.gems, state.version + 1);
};

/** Reads a word off the board along a path of cell indices. */
export const wordAt = (state, indices) => indices.map((index) => state.letters[index]).join('');
