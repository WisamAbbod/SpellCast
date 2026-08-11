'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const { solveBoard, countAtLeast } = loadSrc('src/game/solver.js');
const { rowsToBoard, NEIGHBOURS, toIndex } = loadSrc('src/game/board.js');
const { isValidWord, isCommonWord, MAX_WORD_LENGTH } = loadSrc('src/game/dictionary.js');

suite('dictionary');

ok('accepts ordinary words', ['CAT', 'DREAM', 'QUEST', 'STORM', 'MAGIC', 'ZONE'].every(isValidWord));
ok('accepts obscure but real words', isValidWord('AAHED') && isValidWord('ZYMURGY'));
ok('rejects the acronyms the old list contained', !['AMD', 'ASN', 'ATI', 'AVG'].some(isValidWord));
ok('rejects proper nouns', !['AARON', 'ABERDEEN', 'AMERICA'].some(isValidWord));
ok('rejects non-words', !['XQZ', 'ZZZZ', 'ASDF'].some(isValidWord));
ok('rejects anything under three letters', !isValidWord('AT') && !isValidWord('A'));
ok('is case insensitive', isValidWord('cat') && isValidWord('Cat'));
ok('handles rubbish input', !isValidWord(null) && !isValidWord(42) && !isValidWord(''));

ok('common words are common', ['CAT', 'DREAM', 'HOUSE'].every(isCommonWord));
ok('obscure words are valid but not common', isValidWord('AAHED') && !isCommonWord('AAHED'));
check('the length cap is documented', MAX_WORD_LENGTH, 9);

suite('solver');

/* The adjacency table the solver walks must match the swipe engine exactly. */
check('a corner has 3 neighbours', NEIGHBOURS[toIndex(0, 0)].length, 3);
check('an edge has 5 neighbours', NEIGHBOURS[toIndex(0, 2)].length, 5);
check('the centre has 8 neighbours', NEIGHBOURS[toIndex(2, 2)].length, 8);
ok('no cell is its own neighbour', NEIGHBOURS.every((list, i) => !list.includes(i)));
ok(
  'adjacency is symmetric',
  NEIGHBOURS.every((list, i) => list.every((j) => NEIGHBOURS[j].includes(i))),
);

const board = rowsToBoard([
  ['S', 'T', 'O', 'N', 'E'],
  ['T', 'A', 'R', 'E', 'D'],
  ['O', 'R', 'E', 'A', 'L'],
  ['N', 'E', 'S', 'T', 'S'],
  ['E', 'D', 'I', 'T', 'S'],
]);

const analysis = solveBoard(board);

ok(`finds plenty of common words (${analysis.count})`, analysis.count > 80);
ok(`finds more valid words than common ones (${analysis.total})`, analysis.total > analysis.count);
ok('STONE is on the top row', analysis.words.has('STONE'));
ok('every word reported is valid', [...analysis.words.keys()].every(isValidWord));
ok('every word reported is common', [...analysis.words.keys()].every(isCommonWord));

ok(
  'every path is a chain of adjacent cells',
  [...analysis.words.values()].every((path) =>
    path.every((cell, i) => i === 0 || NEIGHBOURS[path[i - 1]].includes(cell)),
  ),
);
ok(
  'no path reuses a cell',
  [...analysis.words.values()].every((path) => new Set(path).size === path.length),
);
ok(
  'each path spells its word',
  [...analysis.words.entries()].every(
    ([word, path]) => path.map((i) => board[i]).join('') === word,
  ),
);

ok(
  'ranked is sorted by score, descending',
  analysis.ranked.every((entry, i) => i === 0 || analysis.ranked[i - 1].score >= entry.score),
);
check('best is the head of ranked', analysis.best.word, analysis.ranked[0].word);
check('top holds ten words', analysis.top.length, 10);
check(
  'par is the sum of the top ten',
  analysis.par,
  analysis.top.reduce((sum, entry) => sum + entry.score, 0),
);

/* A word that would need a cell twice must NOT be found. */
const doubled = rowsToBoard([
  ['T', 'E', 'S', 'J', 'J'],
  ['J', 'J', 'J', 'J', 'J'],
  ['J', 'J', 'J', 'J', 'J'],
  ['J', 'J', 'J', 'J', 'J'],
  ['J', 'J', 'J', 'J', 'J'],
]);
const doubledAnalysis = solveBoard(doubled);
ok('TESTS is rejected when it would reuse cells', !doubledAnalysis.words.has('TESTS'));

/* Degenerate boards must not throw. */
const empty = solveBoard(new Array(25).fill('J'));
check('a board of one repeated letter finds nothing', empty.count, 0);
check('...and has par 0', empty.par, 0);
check('...and has no best word', empty.best, null);

check('countAtLeast sums the tail', countAtLeast([0, 0, 0, 5, 4, 3, 2], 5), 5);
check('countAtLeast past the end is 0', countAtLeast([0, 0, 0, 5], 9), 0);
