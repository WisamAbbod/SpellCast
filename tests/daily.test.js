'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const {
  utcDateKey, puzzleNumber, previousDateKey, nextDateKey, msUntilNextPuzzle,
  isFutureDate, dailySeed, dailyCellSeed, formatCountdown, DAY_MS,
} = loadSrc('src/game/daily.js');

suite('daily calendar');

const at = (iso) => Date.parse(iso);

/* UTC, so a leaderboard row means the same board everywhere. */
check('just before midnight UTC', utcDateKey(at('2026-08-10T23:59:59.999Z')), '2026-08-10');
check('exactly midnight UTC', utcDateKey(at('2026-08-11T00:00:00.000Z')), '2026-08-11');
check('a local evening in Auckland is already tomorrow UTC',
  utcDateKey(at('2026-08-10T12:00:00.000Z')), '2026-08-10');

check('the epoch is puzzle 1', puzzleNumber('2026-01-01'), 1);
check('the next day is puzzle 2', puzzleNumber('2026-01-02'), 2);
check('a month later', puzzleNumber('2026-02-01'), 32);
check('a year later (2026 is not a leap year)', puzzleNumber('2027-01-01'), 366);
check('across a leap day', puzzleNumber('2028-03-01') - puzzleNumber('2028-02-28'), 2);

ok(
  'puzzle numbers increase by exactly one a day for a year',
  (() => {
    let key = '2026-01-01';
    for (let i = 1; i < 365; i++) {
      const next = nextDateKey(key);
      if (puzzleNumber(next) !== puzzleNumber(key) + 1) return false;
      key = next;
    }
    return true;
  })(),
);

check('previous crosses a month boundary', previousDateKey('2026-03-01'), '2026-02-28');
check('previous crosses a year boundary', previousDateKey('2026-01-01'), '2025-12-31');
check('previous crosses a leap day', previousDateKey('2028-03-01'), '2028-02-29');
check('next crosses a month boundary', nextDateKey('2026-01-31'), '2026-02-01');
check('previous then next is a round trip', nextDateKey(previousDateKey('2026-08-10')), '2026-08-10');

const remaining = msUntilNextPuzzle(at('2026-08-10T23:00:00.000Z'));
check('an hour before rollover', remaining, 3600000);
ok('never longer than a day', msUntilNextPuzzle(at('2026-08-10T00:00:00.000Z')) <= DAY_MS);

ok('tomorrow is a future date', isFutureDate('2999-01-01'));
ok('yesterday is not', !isFutureDate('2020-01-01'));

/* Seeds: stable, and drawn from separate channels. */
check('the daily seed is stable', dailySeed('2026-08-10'), 'spellcast:g1:daily:2026-08-10');
ok('board and bonus seeds differ', dailySeed('2026-08-10') !== dailyCellSeed('2026-08-10'));

check('countdown formatting', formatCountdown(3725000), '1:02:05');
check('countdown never goes negative', formatCountdown(-5000), '0:00:00');
