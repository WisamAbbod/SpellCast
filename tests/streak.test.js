'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const { applyStreak, displayedStreak, streakAtRisk } = loadSrc('src/storage/streak.js');

suite('streak');

const empty = { current: 0, best: 0, lastCompletedDate: null };

check('the first ever day starts a streak', applyStreak(empty, '2026-08-10').current, 1);
check('...and sets a best', applyStreak(empty, '2026-08-10').best, 1);

const day1 = applyStreak(empty, '2026-08-10');
const day2 = applyStreak(day1, '2026-08-11');
check('a consecutive day extends it', day2.current, 2);

check('completing the same day twice changes nothing', applyStreak(day2, '2026-08-11').current, 2);

const afterGap = applyStreak(day2, '2026-08-14');
check('a missed day restarts at 1', afterGap.current, 1);
check('...but the best is remembered', afterGap.best, 2);

/* A device clock that jumps backwards must not corrupt anything. */
const rewound = applyStreak(day2, '2026-08-01');
check('a backwards clock is ignored', rewound.current, 2);
check('...and the last date is untouched', rewound.lastCompletedDate, '2026-08-11');

/* Display is derived, so a missed day reads as broken with no midnight job. */
check('played today shows the streak', displayedStreak(day2, '2026-08-11'), 2);
check('played yesterday still shows it', displayedStreak(day2, '2026-08-12'), 2);
check('two days ago reads as broken', displayedStreak(day2, '2026-08-13'), 0);
check('never played shows zero', displayedStreak(empty, '2026-08-13'), 0);

ok('the stored value survives so results can say "your streak ended"', day2.current === 2);

ok('a streak is at risk the day after', streakAtRisk(day2, '2026-08-12'));
ok('...but not on the day it was extended', !streakAtRisk(day2, '2026-08-11'));
ok('...and not once already broken', !streakAtRisk(day2, '2026-08-20'));
