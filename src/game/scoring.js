import { COMBO_MAX, COMBO_STEP, LETTER_MULTIPLIER, WORD_MULTIPLIER } from './rules.js';

/**
 * Scoring. Rarity of letters, then length, then the board's bonus tiles, then
 * the combo chain - applied in that order so a long rare word on a bonus tile
 * during a combo is spectacular rather than merely good.
 */

const LETTER_SCORES = {
  E: 1, T: 1, A: 1, O: 1, I: 1, N: 1, S: 1, H: 1, R: 1,
  D: 2, L: 2, C: 2, U: 2, M: 2, W: 2, F: 2, G: 2, Y: 2, P: 2, B: 2,
  V: 5, K: 5, J: 8, X: 8, Q: 10, Z: 10,
};

export const letterScore = (letter) => LETTER_SCORES[letter] || 1;

export const lengthMultiplier = (length) => {
  if (length >= 7) return 3;
  if (length >= 6) return 2;
  if (length >= 5) return 1.5;
  return 1;
};

export const lengthBonus = (length) => {
  let bonus = 0;
  if (length >= 5) bonus += 25;
  if (length >= 6) bonus += 50;
  if (length >= 7) bonus += 100;
  return bonus;
};

/** Base score, ignoring the board. Used by the solver to rank every word. */
export const calculateScore = (word) => {
  const upper = String(word).toUpperCase();
  let letters = 0;
  for (let i = 0; i < upper.length; i++) letters += letterScore(upper[i]);
  return Math.floor(letters * lengthMultiplier(upper.length) + lengthBonus(upper.length));
};

/** Combo multiplier for the nth consecutive word (n starts at 0). */
export const comboMultiplier = (chain) =>
  Math.min(COMBO_MAX, 1 + Math.max(0, chain) * COMBO_STEP);

/**
 * What a word is actually worth on this board, right now.
 *
 * @param word    the traced word
 * @param indices the cells it used, in order
 * @param bonus   { wordMultiplier, letterBonus } cell indices, or null
 * @param chain   how many words in a row preceded this one
 * @returns { score, base, usedWordMultiplier, usedLetterBonus, combo }
 */
export const scoreWord = (word, indices, bonus, chain = 0) => {
  const upper = String(word).toUpperCase();

  const usedLetterBonus = !!bonus && indices.includes(bonus.letterBonus);
  const usedWordMultiplier = !!bonus && indices.includes(bonus.wordMultiplier);

  let letters = 0;
  for (let i = 0; i < upper.length; i++) {
    const value = letterScore(upper[i]);
    letters += usedLetterBonus && indices[i] === bonus.letterBonus
      ? value * LETTER_MULTIPLIER
      : value;
  }

  const base = Math.floor(letters * lengthMultiplier(upper.length) + lengthBonus(upper.length));
  const combo = comboMultiplier(chain);
  const withWordBonus = usedWordMultiplier ? base * WORD_MULTIPLIER : base;

  return {
    base,
    score: Math.floor(withWordBonus * combo),
    usedWordMultiplier,
    usedLetterBonus,
    combo,
  };
};

/**
 * Par: the sum of the ten best words on the board.
 *
 * Not the sum of every word - that averages ~3,100, so a strong 60-second round
 * reads as "22% of par" and feels like failure. Top-ten averages ~1,500 with a
 * tight spread, so the percentage means the same thing from one day to the next
 * and a good round lands at 40-60%.
 */
export const PAR_WORD_COUNT = 10;

export const computePar = (rankedWords) =>
  rankedWords
    .slice(0, PAR_WORD_COUNT)
    .reduce((total, entry) => total + entry.score, 0);
