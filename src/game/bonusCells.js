import { CELL_COUNT, LETTER_MULTIPLIER, WORD_MULTIPLIER } from './rules.js';
import { makeRng, rngInt } from './rng.js';

/**
 * The two bonus tiles, drawn from their own seed channel and FIXED for the
 * whole round.
 *
 * The old code rolled a new multiplier cell with Math.random() after every
 * multiplier word, which made two players on the same daily board diverge the
 * moment either of them used one.
 */
export const generateBonusCells = (seedString) => {
  const rng = makeRng(seedString);

  const wordMultiplier = rngInt(rng, CELL_COUNT);
  // Pick from the remaining 24 and step over the collision, rather than
  // rejection-sampling: a rejection loop would burn a variable number of draws.
  let letterBonus = rngInt(rng, CELL_COUNT - 1);
  if (letterBonus >= wordMultiplier) letterBonus += 1;

  return {
    wordMultiplier,
    letterBonus,
    wordMultiplierValue: WORD_MULTIPLIER,
    letterMultiplierValue: LETTER_MULTIPLIER,
  };
};

export const isWordMultiplier = (bonus, index) => !!bonus && bonus.wordMultiplier === index;

export const isLetterBonus = (bonus, index) => !!bonus && bonus.letterBonus === index;
