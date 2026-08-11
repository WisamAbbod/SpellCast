'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const { fnv1a, mulberry32, makeRng, rngInt, rngPick, rngShuffle } = loadSrc('src/game/rng.js');

suite('rng');

// FNV-1a against the published test vectors.
check('fnv1a("")', fnv1a(''), 2166136261);
check('fnv1a("a")', fnv1a('a'), 0xe40c292c);
check('fnv1a("foobar")', fnv1a('foobar'), 0xbf9cf968);

// The property the whole daily challenge rests on.
const a = mulberry32(12345);
const b = mulberry32(12345);
const seqA = Array.from({ length: 1000 }, () => a());
const seqB = Array.from({ length: 1000 }, () => b());
check('same seed gives an identical 1000-value sequence', seqA.join(), seqB.join());

const different = mulberry32(12346);
ok(
  'a neighbouring seed diverges immediately',
  Math.abs(different() - seqA[0]) > 1e-6,
);

ok('every value stays in [0, 1)', seqA.every((v) => v >= 0 && v < 1));

const mean = seqA.reduce((sum, v) => sum + v, 0) / seqA.length;
ok(`mean of 1000 draws is near 0.5 (${mean.toFixed(3)})`, Math.abs(mean - 0.5) < 0.05);

// Consecutive date seeds must not be correlated - a raw day counter would be.
const firsts = [];
for (let day = 1; day <= 31; day++) {
  const key = `2026-05-${String(day).padStart(2, '0')}`;
  firsts.push(makeRng(`spellcast:g1:daily:${key}`)());
}
const ascendingRuns = firsts.filter((v, i) => i > 0 && v > firsts[i - 1]).length;
ok(
  `31 consecutive dates are uncorrelated (${ascendingRuns} ascending steps of 30)`,
  ascendingRuns > 7 && ascendingRuns < 23,
);

// Helpers stay in range.
const rng = makeRng('bounds');
const ints = Array.from({ length: 500 }, () => rngInt(rng, 25));
ok('rngInt stays within [0, n)', ints.every((v) => v >= 0 && v < 25 && Number.isInteger(v)));
ok('rngInt reaches both ends', ints.includes(0) && ints.includes(24));

const items = ['a', 'b', 'c'];
ok(
  'rngPick only returns members',
  Array.from({ length: 50 }, () => rngPick(rng, items)).every((v) => items.includes(v)),
);

const shuffled = rngShuffle(makeRng('shuffle'), [1, 2, 3, 4, 5, 6, 7, 8]);
check('rngShuffle keeps every element', shuffled.slice().sort((x, y) => x - y).join(), '1,2,3,4,5,6,7,8');
check(
  'rngShuffle is reproducible',
  rngShuffle(makeRng('shuffle'), [1, 2, 3, 4, 5, 6, 7, 8]).join(),
  shuffled.join(),
);
