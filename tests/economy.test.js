'use strict';
/**
 * The stardust economy: what a round pays, what the wallet does with it, and
 * whether the cosmetics catalog is internally consistent.
 *
 * The catalog checks matter more than they look. A background is pure data -
 * gradient stops and SVG path strings - and every way it can be wrong is
 * silent: a truncated path renders as nothing, and a gradient stop that is too
 * light makes the whole UI unreadable without throwing anything.
 */
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const {
  DAILY_COMPLETION_BONUS, PRACTICE_DAILY_CAP, SLOW_DAILY_CAP,
  earnedForDaily, earnedForPractice, earnedForSlow,
  stardustForScore, streakBonusFor,
} = loadSrc('src/game/economy.js');

const {
  balanceOf, canAfford, credit, owns, purchase, remainingFor, rollEarn,
} = loadSrc('src/storage/wallet.js');

const { DEFAULT_PROFILE, withDefaults } = loadSrc('src/storage/schema.js');

const {
  BACKGROUNDS, BACKGROUND_ORDER, DEFAULT_BACKGROUND, backgroundFor,
} = loadSrc('src/theme/backgrounds.js');

const { TRACKS, TRACK_ORDER, DEFAULT_TRACK, trackFor } = loadSrc('src/audio/tracks.js');

/* ------------------------------------------------------------- economy -- */

suite('economy');

check('600 points is 6 stardust', stardustForScore(600), 6);
check('100 points is exactly 1', stardustForScore(100), 1);
check('99 points rounds down to nothing', stardustForScore(99), 0);
check('a negative score cannot pay out', stardustForScore(-5), 0);
check('the practice rate quarters it', stardustForScore(600, 0.25), 1);

const typical = earnedForDaily({ score: 600, medalKey: 'silver', streak: 2 });
check('a typical silver daily pays 22', typical.total, 22);
check('...itemised into score, completion and medal', typical.lines.length, 3);
ok('...and the lines add up to the total',
  typical.lines.reduce((sum, entry) => sum + entry.amount, 0) === typical.total);

const perfect = earnedForDaily({ score: 1100, medalKey: 'platinum', streak: 30 });
check('platinum on the thirtieth day pays 241', perfect.total, 241);

const zero = earnedForDaily({ score: 0, medalKey: 'none', streak: 0 });
check('finishing with nothing still pays the completion bonus', zero.total, DAILY_COMPLETION_BONUS);

const replayed = earnedForDaily({ score: 900, medalKey: 'gold', streak: 7, claimed: true });
check('a daily already claimed pays nothing', replayed.total, 0);
check('...and itemises nothing', replayed.lines.length, 0);
ok('...and says so', replayed.claimed === true);

check('three days is a milestone', streakBonusFor(3), 15);
check('seven days is a bigger one', streakBonusFor(7), 40);
check('eight days is not a milestone', streakBonusFor(8), 0);
check('thirty days is the last one', streakBonusFor(30), 200);
check('thirty-one pays nothing extra', streakBonusFor(31), 0);

const grind = earnedForPractice({ score: 4000, remaining: 5 });
check('practice is clipped to what is left of the cap', grind.total, 5);
ok('...and admits it was clipped', grind.capped === true);

const modest = earnedForPractice({ score: 400, remaining: PRACTICE_DAILY_CAP });
check('an ordinary practice round pays 1', modest.total, 1);
ok('...uncapped', modest.capped === false);
check('a practice round worth nothing itemises nothing',
  earnedForPractice({ score: 50, remaining: 15 }).lines.length, 0);

check('passing until the whistle pays nothing',
  earnedForSlow({ humanWords: 2, humanWon: true, remaining: 30 }).total, 0);
check('winning a real slow game pays 15',
  earnedForSlow({ humanWords: 9, humanWon: true, remaining: SLOW_DAILY_CAP }).total, 15);
check('losing one still pays 8',
  earnedForSlow({ humanWords: 9, humanWon: false, remaining: SLOW_DAILY_CAP }).total, 8);

const clipped = earnedForSlow({ humanWords: 9, humanWon: true, remaining: 4 });
check('a clipped slow payout collapses to one honest line', clipped.lines.length, 1);
check('...whose amount is what was actually paid', clipped.lines[0].amount, clipped.total);

/* Fuzz. Every payout is a whole non-negative number, never exceeds what the cap
   allows, and always itemises to exactly what it pays - regardless of input. */
let fuzzRandom = 1337;
const nextRandom = () => {
  fuzzRandom = (fuzzRandom * 1103515245 + 12345) % 2147483648;
  return fuzzRandom / 2147483648;
};
const MEDAL_KEYS = ['none', 'bronze', 'silver', 'gold', 'platinum', 'nonsense', undefined];

let fuzzFailure = null;
for (let i = 0; i < 500 && !fuzzFailure; i++) {
  const score = Math.floor(nextRandom() * 4000) - 200;
  const remaining = Math.floor(nextRandom() * 40) - 5;
  const results = [
    earnedForDaily({
      score,
      medalKey: MEDAL_KEYS[Math.floor(nextRandom() * MEDAL_KEYS.length)],
      streak: Math.floor(nextRandom() * 40),
    }),
    earnedForPractice({ score, remaining }),
    earnedForSlow({
      humanWords: Math.floor(nextRandom() * 14),
      humanWon: nextRandom() > 0.5,
      remaining,
    }),
  ];

  results.forEach((result, index) => {
    if (fuzzFailure) return;
    const itemised = result.lines.reduce((sum, entry) => sum + entry.amount, 0);
    if (!Number.isInteger(result.total)) fuzzFailure = `total not an integer (${index}, ${result.total})`;
    else if (result.total < 0) fuzzFailure = `negative total (${index}, ${result.total})`;
    else if (itemised !== result.total) fuzzFailure = `lines sum to ${itemised}, total is ${result.total}`;
    // The daily has no `remaining` - it is guarded by the record's own flag.
    else if (index > 0 && result.total > Math.max(0, remaining)) {
      fuzzFailure = `paid ${result.total} with ${remaining} remaining`;
    }
  });
}
ok('500 random rounds all pay a whole, capped, correctly itemised amount', !fuzzFailure, fuzzFailure);

/* -------------------------------------------------------------- wallet -- */

suite('wallet');

const fresh = JSON.parse(JSON.stringify(DEFAULT_PROFILE));

check('a new wallet is empty', balanceOf(fresh), 0);
check('a missing wallet reads as zero rather than throwing', balanceOf({}), 0);
ok('nothing is owned yet', !owns(fresh, 'backgrounds', 'forest'));
ok('nothing is affordable', !canAfford(fresh, 1));
ok('free things always are', canAfford(fresh, 0));

const funded = credit(fresh, 500);
check('crediting raises the balance', funded.wallet.balance, 500);
check('...and the lifetime total', funded.wallet.lifetime, 500);
check('...but never the spent total', funded.wallet.spent, 0);
ok('crediting nothing is a no-op returning the same object', credit(funded, 0) === funded);
ok('crediting a negative is too', credit(funded, -100) === funded);

const bought = purchase(funded, 'backgrounds', 'forest', 300);
check('buying debits the balance', bought.wallet.balance, 200);
check('...records it as spent', bought.wallet.spent, 300);
check('...and leaves lifetime alone', bought.wallet.lifetime, 500);
ok('...and the thing is now owned', owns(bought, 'backgrounds', 'forest'));
ok('...without touching the other kind', bought.unlocks.tracks.length === 0);

ok('buying it again is a no-op returning the same object',
  purchase(bought, 'backgrounds', 'forest', 300) === bought);
ok('buying what you cannot afford is a no-op returning the same object',
  purchase(bought, 'backgrounds', 'abyss', 600) === bought);
ok('buying nothing is a no-op', purchase(bought, 'backgrounds', null, 10) === bought);

const exact = purchase(bought, 'tracks', 'pulse', 200);
check('spending the last of it lands on zero', exact.wallet.balance, 0);
ok('...and zero is not negative', exact.wallet.balance >= 0);
check('the invariant holds: balance + spent === lifetime',
  exact.wallet.balance + exact.wallet.spent, exact.wallet.lifetime);

/* The trap: DEFAULT_PROFILE.unlocks is shared by reference with every profile a
   shallow spread has ever produced, so one in-place push would poison it for
   the whole process. */
let shared = credit({ ...DEFAULT_PROFILE }, 1000);
for (let i = 0; i < 10; i++) shared = purchase(shared, 'backgrounds', `bg${i}`, 10);
check('ten purchases against a shallow copy leave the defaults empty',
  DEFAULT_PROFILE.unlocks.backgrounds.length, 0);
check('...while the copy has all ten', shared.unlocks.backgrounds.length, 10);

check('a fresh day resets the earn ledger', rollEarn({ date: '2026-08-25', practice: 15 }, '2026-08-26').practice, 0);
check('...and the same day preserves it', rollEarn({ date: '2026-08-26', practice: 15 }, '2026-08-26').practice, 15);
check('a missing ledger reads as a fresh one', rollEarn(null, '2026-08-26').slow, 0);

check('a fresh profile has the whole practice cap left',
  remainingFor(fresh, 'practice', '2026-08-26'), PRACTICE_DAILY_CAP);
const spentToday = credit(fresh, PRACTICE_DAILY_CAP, { bucket: 'practice', dateKey: '2026-08-26' });
check('...and none once it is used up', remainingFor(spentToday, 'practice', '2026-08-26'), 0);
check('...but the whole cap again tomorrow',
  remainingFor(spentToday, 'practice', '2026-08-27'), PRACTICE_DAILY_CAP);
check('the slow bucket is counted separately',
  remainingFor(spentToday, 'slow', '2026-08-26'), SLOW_DAILY_CAP);

/* withDefaults merges one level deep, and the new keys rely on it entirely -
   there is no migration. */
check('a partial wallet is filled in',
  withDefaults({ wallet: { balance: 40 } }, DEFAULT_PROFILE).wallet.lifetime, 0);
check('...keeping what was stored',
  withDefaults({ wallet: { balance: 40 } }, DEFAULT_PROFILE).wallet.balance, 40);
check('a stored unlock array survives',
  withDefaults({ unlocks: { backgrounds: ['forest'] } }, DEFAULT_PROFILE).unlocks.backgrounds.length, 1);
check('...and its untouched sibling defaults to empty',
  withDefaults({ unlocks: { backgrounds: ['forest'] } }, DEFAULT_PROFILE).unlocks.tracks.length, 0);
check('a profile from before stardust existed gets a wallet',
  withDefaults({ daily: { played: 200 } }, DEFAULT_PROFILE).wallet.balance, 0);
check('...and an empty earn ledger', withDefaults(null, DEFAULT_PROFILE).earn.date, null);

/* ----------------------------------------------------------- cosmetics -- */

suite('cosmetics');

const MOTIONS = ['twinkle', 'drift', 'fall', 'rise'];

const channel = (value) => {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance, so "dark enough" is a number and not an opinion. */
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
};

const catalogue = (entries, order, defaultKey, label) => {
  check(`every ${label} is in the order`, order.length, Object.keys(entries).length);
  ok(`...and the order names only real ${label}s`, order.every((key) => !!entries[key]));

  const free = order.filter((key) => entries[key].price === 0);
  check(`exactly one ${label} is free`, free.length, 1);
  check(`...and it is the default`, free[0], defaultKey);

  ok(`every ${label} price is a non-negative whole number`,
    order.every((key) => Number.isInteger(entries[key].price) && entries[key].price >= 0));

  // A catalog that is not monotonic reads as a bug on screen: the grid is drawn
  // in order, so a cheaper item below a dearer one looks like a mistake.
  ok(`${label} prices increase down the list`,
    order.every((key, i) => i === 0 || entries[key].price > entries[order[i - 1]].price));

  ok(`every ${label} has a name, mood and blurb`,
    order.every((key) => {
      const entry = entries[key];
      return !!entry.name && !!entry.mood && !!entry.blurb && entry.key === key;
    }));
};

catalogue(BACKGROUNDS, BACKGROUND_ORDER, DEFAULT_BACKGROUND, 'background');
catalogue(TRACKS, TRACK_ORDER, DEFAULT_TRACK, 'track');

ok('an unknown background falls back to the default',
  backgroundFor('does-not-exist') === BACKGROUNDS[DEFAULT_BACKGROUND]);
ok('so does no background at all', backgroundFor(undefined) === BACKGROUNDS[DEFAULT_BACKGROUND]);
ok('an unknown track falls back too', trackFor('nope') === TRACKS[DEFAULT_TRACK]);

const total =
  BACKGROUND_ORDER.reduce((sum, key) => sum + BACKGROUNDS[key].price, 0) +
  TRACK_ORDER.reduce((sum, key) => sum + TRACKS[key].price, 0);
ok(`the whole catalog costs ${total} stardust, which is a season of play, not a decade`,
  total > 0 && total < 3000);

/* The constraint the entire "don't build a theme system" decision rests on: the
   ~21 module-scope stylesheets assume a dark backdrop, so every background has
   to stay dark or the app becomes unreadable without anything throwing. */
let tooLight = null;
BACKGROUND_ORDER.forEach((key) => {
  BACKGROUNDS[key].gradient.forEach((stop) => {
    if (tooLight) return;
    if (!/^#[0-9A-Fa-f]{6}$/.test(stop)) tooLight = `${key}: "${stop}" is not a 6-digit hex`;
    else if (luminance(stop) >= 0.18) {
      tooLight = `${key}: ${stop} has luminance ${luminance(stop).toFixed(3)}`;
    }
  });
  if (!tooLight && !/^#[0-9A-Fa-f]{6}$/.test(BACKGROUNDS[key].flat)) {
    tooLight = `${key}: flat colour "${BACKGROUNDS[key].flat}" is not a 6-digit hex`;
  }
});
ok('every gradient stop is dark enough for white text to read on', !tooLight, tooLight);

let sceneryFault = null;
BACKGROUND_ORDER.forEach((key) => {
  const bands = BACKGROUNDS[key].scenery;
  if (bands === null || sceneryFault) return;
  if (!Array.isArray(bands)) { sceneryFault = `${key}: scenery is neither null nor an array`; return; }

  bands.forEach((band) => {
    if (sceneryFault) return;
    if (band.anchor !== 'top' && band.anchor !== 'bottom') sceneryFault = `${key}: anchor "${band.anchor}"`;
    else if (!(band.height > 0 && band.height <= 0.5)) sceneryFault = `${key}: height ${band.height}`;
    else if (!/^0 0 \d+ \d+$/.test(band.viewBox)) sceneryFault = `${key}: viewBox "${band.viewBox}"`;
    else if (!band.layers || !band.layers.length) sceneryFault = `${key}: a band with no layers`;
    else {
      band.layers.forEach((layer) => {
        if (sceneryFault) return;
        // A truncated path string draws nothing and reports nothing.
        if (typeof layer.d !== 'string' || !layer.d.startsWith('M')) {
          sceneryFault = `${key}: a path that does not start with M`;
        } else if (!/[Zz\d]$/.test(layer.d)) {
          sceneryFault = `${key}: a path ending "${layer.d.slice(-12)}"`;
        } else if (!layer.fill && !layer.stroke) {
          sceneryFault = `${key}: a path with neither fill nor stroke`;
        } else if (layer.fill === 'none' && !layer.strokeWidth) {
          sceneryFault = `${key}: a stroked path with no width`;
        }
      });
    }
  });
});
ok('every scenery band is anchored, sized, and made of complete paths', !sceneryFault, sceneryFault);

ok('every background uses a particle motion ParticleField knows',
  BACKGROUND_ORDER.every((key) => MOTIONS.includes(BACKGROUNDS[key].particles.motion)));
ok('...at a sane density and size',
  BACKGROUND_ORDER.every((key) => {
    const p = BACKGROUNDS[key].particles;
    return p.density > 0 && p.density <= 1.8 && p.sizeScale > 0 && p.sizeScale <= 3 && !!p.tint;
  }));

// fall and rise translate continuously where twinkle only fades, so they cost
// more per particle and must not also be the densest.
ok('the continuously-moving motions are not the densest',
  BACKGROUND_ORDER.every((key) => {
    const p = BACKGROUNDS[key].particles;
    return p.motion === 'twinkle' || p.motion === 'drift' || p.density <= 0.7;
  }));
