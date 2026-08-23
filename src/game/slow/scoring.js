import {
  LONG_WORD_BONUS,
  LONG_WORD_MIN,
  TILE_DOUBLE_LETTER,
  TILE_DOUBLE_WORD,
  TILE_TRIPLE_LETTER,
} from './rules.js';

/**
 * Slow-mode scoring: SpellCast's, which is a different game to the daily mode's.
 *
 * Daily mode multiplies by word length and adds big length bonuses, so a
 * seven-letter word is worth fifty times a three-letter one. Here the letters
 * themselves carry the value - Z and Q are worth eight, vowels one - so a short
 * word made of expensive letters can beat a long word made of cheap ones. Long
 * words get a flat +10 rather than a multiplier.
 *
 * Order of operations, which is the part that is easy to get wrong:
 *   1. each letter's value, multiplied by its own DL/TL tile
 *   2. sum
 *   3. doubled if any tile in the word is a 2x word tile
 *   4. +10 if the word is six letters or longer
 *
 * The long-word bonus lands AFTER the doubling, so 2x never doubles it.
 */

export const SLOW_LETTER_VALUES = {
  A: 1, E: 1, I: 1, O: 1,
  N: 2, R: 2, S: 2, T: 2,
  D: 3, G: 3, L: 3,
  B: 4, H: 4, M: 4, P: 4, U: 4, W: 4, Y: 4,
  C: 5, F: 5, V: 5,
  K: 6,
  J: 7, X: 7,
  Q: 8, Z: 8,
};

export const slowLetterValue = (letter) => SLOW_LETTER_VALUES[letter] || 0;

/** The multiplier a tile applies to the single letter sitting on it. */
export const letterMultiplierFor = (modifier) => {
  if (modifier === TILE_DOUBLE_LETTER) return 2;
  if (modifier === TILE_TRIPLE_LETTER) return 3;
  return 1;
};

/**
 * What a word scores on this board.
 *
 * @param {string} word       the traced word
 * @param {number[]} indices  the cells it used, in order
 * @param {Array<string|null>} modifiers  per-cell bonus tiles
 * @returns {{
 *   score: number, base: number, doubleWord: boolean, longWord: boolean,
 *   longBonus: number, letters: {letter,value,multiplier,index}[]
 * }}
 */
export const scoreSlowWord = (word, indices, modifiers = []) => {
  const upper = String(word || '').toUpperCase();
  const letters = [];

  let base = 0;
  let doubleWord = false;

  for (let i = 0; i < upper.length; i++) {
    const index = indices[i];
    const modifier = modifiers[index] || null;
    const value = slowLetterValue(upper[i]);
    const multiplier = letterMultiplierFor(modifier);

    if (modifier === TILE_DOUBLE_WORD) doubleWord = true;

    base += value * multiplier;
    letters.push({ letter: upper[i], value, multiplier, index });
  }

  const doubled = doubleWord ? base * 2 : base;
  const longWord = upper.length >= LONG_WORD_MIN;
  const longBonus = longWord ? LONG_WORD_BONUS : 0;

  return {
    score: doubled + longBonus,
    base,
    doubleWord,
    longWord,
    longBonus,
    letters,
  };
};

/** Gems sitting on the cells a word used - collected when the word is played. */
export const countGems = (indices, gems = []) =>
  indices.reduce((total, index) => total + (gems[index] ? 1 : 0), 0);

/** A short human-readable breakdown, e.g. "12 x2 +10". */
export const describeSlowScore = (scored) =>
  [
    `${scored.base}`,
    scored.doubleWord ? 'x2' : null,
    scored.longBonus ? `+${scored.longBonus}` : null,
  ]
    .filter(Boolean)
    .join(' ');
