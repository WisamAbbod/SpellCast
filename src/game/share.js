import { puzzleNumber } from './daily.js';

/**
 * The Wordle-style share string.
 *
 * Never includes the letters or the words: spoiling the board for whoever reads
 * it is exactly what makes a share format stop being shared.
 */

const BLOCKS = 10;

export const parBlocks = (score, par) => {
  if (!par || par <= 0) return '⬜'.repeat(BLOCKS);
  const ratio = Math.max(0, Math.min(1, score / par));
  const filled = Math.floor(ratio * BLOCKS);
  const partial = filled < BLOCKS && ratio * BLOCKS - filled >= 0.5;
  return (
    '🟩'.repeat(filled) +
    (partial ? '🟨' : '') +
    '⬜'.repeat(Math.max(0, BLOCKS - filled - (partial ? 1 : 0)))
  );
};

export const parPercent = (score, par) =>
  par > 0 ? Math.round((score / par) * 100) : 0;

export const formatShareText = ({
  dateKey,
  puzzle,
  score,
  wordCount,
  par,
  bestWord,
  bestWordScore,
  streak,
  topFound,
  topTotal,
}) => {
  const number = puzzle || (dateKey ? puzzleNumber(dateKey) : 0);
  const lines = [
    `SpellCast #${number}`,
    `${score.toLocaleString()} pts · ${wordCount} word${wordCount === 1 ? '' : 's'}`,
    `${parBlocks(score, par)}  ${parPercent(score, par)}% of par`,
  ];

  if (typeof topFound === 'number' && typeof topTotal === 'number') {
    lines.push(`Found ${topFound}/${topTotal} of the best words`);
  }
  if (bestWord) {
    lines.push(`Best: ${bestWord}${bestWordScore ? ` (${bestWordScore})` : ''}`);
  }
  if (streak > 1) {
    lines.push(`🔥 ${streak} day streak`);
  }

  return lines.join('\n');
};
