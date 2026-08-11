import { CELL_COUNT } from './rules.js';
import { NEIGHBOURS } from './board.js';
import { getSeedWords } from './dictionary.js';
import { drawLetter, repairQ, repairVowels } from './letters.js';
import { makeRng, rngInt, rngPick } from './rng.js';
import { measureBoard, meetsBar, rateBoard } from './quality.js';
import { solveBoard } from './solver.js';

/**
 * Board generation: build a candidate, solve it, keep the best.
 *
 * The old generator planted words in straight lines, refused overlaps, and
 * never checked whether the finished board contained anything. Measured, only
 * 15% of its boards were worth playing. This one plants words along snaking
 * paths the swipe engine can actually follow, then *verifies* with the solver
 * and picks the best of several attempts.
 *
 * !! Every rng() call below is part of the daily puzzle contract. Adding,
 * !! removing or reordering one changes every board for every date. Bump
 * !! GENERATOR_VERSION in src/config.js if you touch this file.
 */

export const DEFAULT_CANDIDATES = 12;
export const MIN_CANDIDATES = 5;
export const SEED_WORDS_PER_BOARD = 3;
const MAX_PLACEMENT_ATTEMPTS = 40;

/** A hand-checked board, so generation can never leave the player with nothing. */
export const EMERGENCY_BOARD = [
  'S', 'T', 'A', 'R', 'E',
  'O', 'N', 'E', 'S', 'T',
  'L', 'I', 'G', 'H', 'A',
  'D', 'R', 'A', 'M', 'P',
  'E', 'S', 'T', 'O', 'N',
];

/**
 * Writes a word along a random self-avoiding walk. Overwriting whatever was
 * there is intentional: a later word crossing an earlier one usually leaves
 * both traceable by another route, and the solver checks the truth afterwards.
 * Never trust placement - trust the solver.
 */
export const placeSeedWord = (board, word, rng) => {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const path = [rngInt(rng, CELL_COUNT)];
    const used = new Set(path);
    let ok = true;

    for (let i = 1; i < word.length; i++) {
      const options = NEIGHBOURS[path[path.length - 1]].filter((j) => !used.has(j));
      if (options.length === 0) {
        ok = false;
        break;
      }
      const next = rngPick(rng, options);
      path.push(next);
      used.add(next);
    }

    if (ok) {
      for (let i = 0; i < word.length; i++) board[path[i]] = word[i];
      return true;
    }
  }
  return false;
};

export const buildCandidate = (rng, seedWordCount = SEED_WORDS_PER_BOARD) => {
  const board = new Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) board[i] = drawLetter(rng);

  const pool = getSeedWords();
  for (let i = 0; i < seedWordCount; i++) {
    placeSeedWord(board, rngPick(rng, pool), rng);
  }

  repairQ(board, rng);
  repairVowels(board, rng);
  return board;
};

/**
 * @param {{seed: string, candidates?: number, minCandidates?: number, seedWords?: number}} options
 * @returns {{board, seed, analysis, measure, rating, candidatesTried, acceptedEarly}}
 */
export const generateBoard = ({
  seed,
  candidates = DEFAULT_CANDIDATES,
  minCandidates = MIN_CANDIDATES,
  seedWords = SEED_WORDS_PER_BOARD,
}) => {
  const rng = makeRng(seed);

  let best = null;
  let tried = 0;

  for (let attempt = 0; attempt < candidates; attempt++) {
    tried++;
    const board = buildCandidate(rng, seedWords);
    const analysis = solveBoard(board);
    const measure = measureBoard(board, analysis);
    const rating = rateBoard(measure);

    if (!best || rating > best.rating) {
      best = { board, analysis, measure, rating };
    }
    if (tried >= minCandidates && meetsBar(measure)) {
      return { ...best, seed, candidatesTried: tried, acceptedEarly: true };
    }
  }

  if (!best) {
    const board = EMERGENCY_BOARD.slice();
    const analysis = solveBoard(board);
    const measure = measureBoard(board, analysis);
    return {
      board,
      analysis,
      measure,
      rating: rateBoard(measure),
      seed,
      candidatesTried: tried,
      acceptedEarly: false,
    };
  }

  return { ...best, seed, candidatesTried: tried, acceptedEarly: false };
};

/**
 * Boards are a pure function of their seed, so the same one is never built
 * twice in a session - returning to the daily screen is free.
 */
const cache = new Map();
const CACHE_LIMIT = 12;

export const getBoard = (seed, options = {}) => {
  const hit = cache.get(seed);
  if (hit) return hit;

  const result = generateBoard({ seed, ...options });
  cache.set(seed, result);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return result;
};
