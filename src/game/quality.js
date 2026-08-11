import { countVowels, maxRepeat, VOWEL_MAX, VOWEL_MIN } from './letters.js';
import { countAtLeast } from './solver.js';

/**
 * Is a board worth playing?
 *
 * Two separate judgements, deliberately:
 *   meetsBar  - boolean, "good enough to stop searching"
 *   rateBoard - number, "which of these candidates is best"
 * The bar lets generation exit early; the rating means the loop always has
 * something to return even if nothing clears the bar.
 */

export const measureBoard = (board, analysis) => ({
  words: analysis.count,
  len5: countAtLeast(analysis.byLength, 5),
  len6: countAtLeast(analysis.byLength, 6),
  len7: countAtLeast(analysis.byLength, 7),
  bestWord: analysis.best ? analysis.best.score : 0,
  par: analysis.par,
  vowels: countVowels(board),
  maxRepeat: maxRepeat(board),
});

/**
 * Calibrated, not guessed. Measured over 400 candidate boards with three seed
 * words and the shipped dictionary:
 *
 *   common words  p05  70   p50 131   p95 220
 *   5+ letters    p05   8   p50  34   p95  75
 *   6+ letters    p05   2   p50  11   p95  33
 *   7+ letters    p05   0   p50   3   p95  12
 *   vowels        p05   7   p50   9   p95  11
 *   max repeat    p05   3   p50   4   p95   6
 *
 * The bar sits near the median so roughly half of all candidates clear it,
 * which - with best-of-N selection behind it - means boards are consistently
 * good without generation ever running long.
 */
export const ACCEPT_BAR = {
  minWords: 100,
  minLen5: 25,
  minLen6: 8,
  minLen7: 1,
  minVowels: VOWEL_MIN,
  maxVowels: VOWEL_MAX,
  maxRepeat: 5,
};

export const meetsBar = (measure) =>
  measure.words >= ACCEPT_BAR.minWords &&
  measure.len5 >= ACCEPT_BAR.minLen5 &&
  measure.len6 >= ACCEPT_BAR.minLen6 &&
  measure.len7 >= ACCEPT_BAR.minLen7 &&
  measure.vowels >= ACCEPT_BAR.minVowels &&
  measure.vowels <= ACCEPT_BAR.maxVowels &&
  measure.maxRepeat <= ACCEPT_BAR.maxRepeat;

/**
 * Higher is better. The caps stop one runaway metric dominating; the two
 * penalties at the end are the safety net that keeps an ugly board from winning
 * on raw word count alone.
 */
export const rateBoard = (measure) =>
  Math.min(measure.words, 220) * 1 +
  Math.min(measure.len5, 60) * 3 +
  Math.min(measure.len6, 25) * 6 +
  Math.min(measure.len7, 8) * 10 +
  Math.min(measure.bestWord, 240) * 0.4 -
  Math.abs(measure.vowels - 9) * 10 -
  Math.max(0, measure.maxRepeat - 4) * 25 -
  (measure.words < 70 ? 250 : 0) -
  (measure.len6 < 2 ? 150 : 0);
