'use strict';
/**
 * Plays a whole round through the real game logic - generate, solve, trace,
 * score, share - and checks the numbers a player would actually see.
 *
 * The React layer isn't exercised here (it needs a device), but everything it
 * displays is.
 */
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const { getBoard } = loadSrc('src/game/generator.js');
const { solveBoard } = loadSrc('src/game/solver.js');
const { generateBonusCells } = loadSrc('src/game/bonusCells.js');
const { scoreWord } = loadSrc('src/game/scoring.js');
const { isValidWord } = loadSrc('src/game/dictionary.js');
const { dailyCellSeed, dailySeed, puzzleNumber } = loadSrc('src/game/daily.js');
const { formatShareText, parPercent } = loadSrc('src/game/share.js');
const { NEIGHBOURS } = loadSrc('src/game/board.js');
const { CELL_COUNT } = loadSrc('src/game/rules.js');

suite('a whole round');

const dateKey = '2026-08-10';
const board = getBoard(dailySeed(dateKey));
const bonus = generateBonusCells(dailyCellSeed(dateKey));

check('the bonus tiles are on the board', bonus.wordMultiplier < CELL_COUNT, true);
ok('the two bonus tiles are different cells', bonus.wordMultiplier !== bonus.letterBonus);
ok(
  'bonus tiles are stable for a date',
  generateBonusCells(dailyCellSeed(dateKey)).wordMultiplier === bonus.wordMultiplier,
);

/* Play the eight best words a decent player might plausibly find. */
const analysis = board.analysis;
const played = analysis.ranked.slice(0, 8);

let score = 0;
let best = { word: null, score: 0 };
const words = [];

played.forEach((entry, index) => {
  const path = analysis.words.get(entry.word);
  const chain = index; // as if each landed inside the combo window
  const scored = scoreWord(entry.word, path, bonus, chain);
  score += scored.score;
  words.push(entry.word);
  if (scored.score > best.score) best = { word: entry.word, score: scored.score };
});

ok(`the round scored ${score.toLocaleString()}`, score > 0);
ok('every word played is a real word', words.every(isValidWord));

ok(
  'every played path is traceable',
  words.every((word) => {
    const path = analysis.words.get(word);
    return path.every((cell, i) => i === 0 || NEIGHBOURS[path[i - 1]].includes(cell));
  }),
);

/* Par should describe a demanding but reachable target. */
const percent = parPercent(score, analysis.par);
ok(`eight best words with combos is ${percent}% of par`, percent > 60);
ok('par is the top ten, so eight great words alone need not beat it',
  analysis.par > 0);

/* Sanity-check the board a player is handed. */
ok(`the daily board offers ${analysis.count} common words`, analysis.count >= 70);
ok(`its best word is worth ${analysis.best.score}`, analysis.best.score > 60);
ok('the ten best words are all findable', analysis.top.every((entry) => analysis.words.has(entry.word)));

/* And the string they can share. */
const text = formatShareText({
  dateKey, puzzle: puzzleNumber(dateKey), score, wordCount: words.length,
  par: analysis.par, bestWord: best.word, bestWordScore: best.score,
  streak: 3, topFound: 8, topTotal: 10,
});
ok('the share text names the puzzle', text.includes(`#${puzzleNumber(dateKey)}`));

// Tokenise rather than substring-match: RAN is inside STRANGER.
const leaked = text
  .toUpperCase()
  .split(/[^A-Z]+/)
  .filter((token) => token.length >= 3 && analysis.words.has(token))
  .filter((token) => token !== best.word);
check('...and gives away no word except the one it names', leaked.join(','), '');

/* Re-solving the same board must be identical - the results screen re-reads it. */
const resolved = solveBoard(board.board);
check('re-solving gives the same word count', resolved.count, analysis.count);
check('...and the same par', resolved.par, analysis.par);
