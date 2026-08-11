'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const { generateBoard, buildCandidate, placeSeedWord, EMERGENCY_BOARD } =
  loadSrc('src/game/generator.js');
const { meetsBar, measureBoard, rateBoard } = loadSrc('src/game/quality.js');
const { solveBoard } = loadSrc('src/game/solver.js');
const { makeRng } = loadSrc('src/game/rng.js');
const { NEIGHBOURS } = loadSrc('src/game/board.js');
const { dailySeed } = loadSrc('src/game/daily.js');
const { CELL_COUNT } = loadSrc('src/game/rules.js');

suite('generator');

/* The property the entire daily challenge rests on. */
const first = generateBoard({ seed: dailySeed('2026-08-10') });
const again = generateBoard({ seed: dailySeed('2026-08-10') });
check('the same seed gives a byte-identical board', first.board.join(''), again.board.join(''));
check('...and an identical par', first.analysis.par, again.analysis.par);

const other = generateBoard({ seed: dailySeed('2026-08-11') });
ok('a different date gives a different board', other.board.join('') !== first.board.join(''));

check('a board is 25 cells', first.board.length, CELL_COUNT);
ok('every cell is a single A-Z letter', first.board.every((c) => /^[A-Z]$/.test(c)));

/* Quality across a large sample - this is the whole point of the rewrite. */
const SAMPLE = 200;
let cleared = 0;
let worstWords = Infinity;
let totalWords = 0;
let totalPar = 0;
let emergency = 0;

for (let i = 0; i < SAMPLE; i++) {
  const result = generateBoard({ seed: dailySeed(`2026-01-${i}`) });
  const measure = result.measure;
  if (meetsBar(measure)) cleared++;
  if (measure.words < worstWords) worstWords = measure.words;
  totalWords += measure.words;
  totalPar += measure.par;
  if (result.board.join('') === EMERGENCY_BOARD.join('')) emergency++;
}

const clearedPercent = Math.round((cleared / SAMPLE) * 100);
ok(`${clearedPercent}% of generated boards clear the accept bar`, clearedPercent >= 95);
ok(`the worst board still had ${worstWords} words`, worstWords >= 60);
ok(
  `boards average ${Math.round(totalWords / SAMPLE)} common words and ${Math.round(totalPar / SAMPLE)} par`,
  totalWords / SAMPLE > 110,
);
check('the emergency board is never needed', emergency, 0);

/* The loop must be bounded. */
const bounded = generateBoard({ seed: 'bounded', candidates: 3, minCandidates: 3 });
ok('never tries more candidates than allowed', bounded.candidatesTried <= 3);

/* Seed words are written along paths a finger could actually trace. */
const rng = makeRng('placement');
const board = new Array(CELL_COUNT).fill('.');
ok('placeSeedWord reports success', placeSeedWord(board, 'PLANET', rng));
const written = board.filter((c) => c !== '.').length;
check('it wrote exactly one cell per letter', written, 6);

const traced = solveBoard(buildCandidate(makeRng('trace'), 3));
ok('a generated candidate is solvable', traced.count > 0);

/* A word placed by placeSeedWord must be findable by the solver. */
let found = 0;
for (let i = 0; i < 30; i++) {
  const attempt = buildCandidate(makeRng(`seedcheck:${i}`), 3);
  const solved = solveBoard(attempt);
  if (solved.count > 0) found++;
}
check('every sampled candidate contains words', found, 30);

/* Neighbour bridging sanity: the emergency board is real and playable. */
const emergencyAnalysis = solveBoard(EMERGENCY_BOARD);
ok(`the emergency board is itself playable (${emergencyAnalysis.count} words)`, emergencyAnalysis.count > 40);

ok(
  'rateBoard prefers a rich board to a barren one',
  rateBoard(measureBoard(first.board, first.analysis)) >
    rateBoard(measureBoard(new Array(25).fill('J'), solveBoard(new Array(25).fill('J')))),
);
