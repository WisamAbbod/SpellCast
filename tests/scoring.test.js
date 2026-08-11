'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const {
  calculateScore, scoreWord, comboMultiplier, computePar, letterScore, PAR_WORD_COUNT,
} = loadSrc('src/game/scoring.js');
const { COMBO_MAX } = loadSrc('src/game/rules.js');
const { parBlocks, parPercent, formatShareText } = loadSrc('src/game/share.js');

suite('scoring');

check('common letters are cheap', letterScore('E'), 1);
check('rare letters are not', letterScore('Z'), 10);
check('unknown letters do not crash', letterScore('#'), 1);

ok('longer words beat shorter ones', calculateScore('STRANGER') > calculateScore('RANGE'));
ok('rare letters beat common ones at equal length',
  calculateScore('JAZZY') > calculateScore('EATEN'));
check('scoring is case insensitive', calculateScore('cat'), calculateScore('CAT'));

/* Bonus tiles. Word index 2 sits on the letter bonus, index 0 on the word one. */
const indices = [10, 11, 12];
const bonus = { wordMultiplier: 10, letterBonus: 12 };

const plain = scoreWord('CAT', indices, null, 0);
const withBonus = scoreWord('CAT', indices, bonus, 0);

check('a plain word matches the base score', plain.score, calculateScore('CAT'));
ok('bonus tiles increase the score', withBonus.score > plain.score);
ok('the word multiplier is reported', withBonus.usedWordMultiplier);
ok('the letter bonus is reported', withBonus.usedLetterBonus);

const missed = scoreWord('CAT', [1, 2, 3], bonus, 0);
ok('a word that avoids the bonus tiles gets neither',
  !missed.usedWordMultiplier && !missed.usedLetterBonus);
check('...and scores the base amount', missed.score, calculateScore('CAT'));

/* Combos. */
check('no chain is 1x', comboMultiplier(0), 1);
check('one link is 1.25x', comboMultiplier(1), 1.25);
check('the multiplier is capped', comboMultiplier(99), COMBO_MAX);
ok('a combo raises the score', scoreWord('CAT', indices, null, 3).score > plain.score);

/* Par. */
const ranked = Array.from({ length: 30 }, (_, i) => ({ word: `W${i}`, score: 100 - i }));
check('par is the top ten only', computePar(ranked), 955);
check('par of an empty board is 0', computePar([]), 0);
check('par uses the documented count', PAR_WORD_COUNT, 10);

suite('share');

check('half of par is five blocks', parBlocks(500, 1000), '🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜');
check('beating par fills every block', parBlocks(2000, 1000), '🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
check('zero fills none', parBlocks(0, 1000), '⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜');
check('a missing par degrades gracefully', parBlocks(500, 0).length > 0, true);
check('percent of par', parPercent(680, 1000), 68);

const text = formatShareText({
  dateKey: '2026-08-10', puzzle: 587, score: 1840, wordCount: 23, par: 2700,
  bestWord: 'STRANGER', bestWordScore: 207, streak: 12, topFound: 6, topTotal: 10,
});
ok('mentions the puzzle number', text.includes('#587'));
ok('mentions the score', text.includes('1,840'));
ok('mentions the best word', text.includes('STRANGER'));
ok('mentions the streak', text.includes('12 day streak'));
ok('mentions the best-words tally', text.includes('6/10'));
ok('never leaks the board', !text.includes('Found words:'));
