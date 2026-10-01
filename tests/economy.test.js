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
  DAILY_COMPLETION_BONUS, PRACTICE_DAILY_CAP, PRACTICE_RATE, SLOW_DAILY_CAP,
  SLOW_COMPLETION_BONUS, SLOW_WIN_BONUS, STREAK_MILESTONES,
  earnedForDaily, earnedForPractice, earnedForSlow,
  stardustForScore, streakBonusFor,
} = loadSrc('src/game/economy.js');

const {
  balanceOf, canAfford, credit, devGrant, owns, purchase, remainingFor, rollEarn,
} = loadSrc('src/storage/wallet.js');

const { DEFAULT_PROFILE, withDefaults } = loadSrc('src/storage/schema.js');

const {
  BACKGROUNDS, BACKGROUND_ORDER, DEFAULT_BACKGROUND, backgroundFor,
} = loadSrc('src/theme/backgrounds.js');

const { TRACKS, TRACK_ORDER, DEFAULT_TRACK, trackFor, formatLength } = loadSrc('src/audio/tracks.js');
const { COSTUMES, COSTUME_ORDER, DEFAULT_COSTUME, costumeFor, isPremium } = loadSrc('src/theme/costumes.js');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------- economy -- */

suite('economy');

check('600 points is 12 stardust', stardustForScore(600), 12);
check('50 points is exactly 1', stardustForScore(50), 1);
check('49 points rounds down to nothing', stardustForScore(49), 0);
check('a negative score cannot pay out', stardustForScore(-5), 0);
check('the practice rate reduces it', stardustForScore(600, PRACTICE_RATE), 4);

const typical = earnedForDaily({ score: 600, medalKey: 'silver', streak: 2 });
check('a typical silver daily pays 57', typical.total, 57);
check('...itemised into score, completion and medal', typical.lines.length, 3);
ok('...and the lines add up to the total',
  typical.lines.reduce((sum, entry) => sum + entry.amount, 0) === typical.total);

const perfect = earnedForDaily({ score: 1100, medalKey: 'platinum', streak: 30 });
check('platinum on the thirtieth day pays 457', perfect.total, 457);

const zero = earnedForDaily({ score: 0, medalKey: 'none', streak: 0 });
check('finishing with nothing still pays the completion bonus', zero.total, DAILY_COMPLETION_BONUS);

const replayed = earnedForDaily({ score: 900, medalKey: 'gold', streak: 7, claimed: true });
check('a daily already claimed pays nothing', replayed.total, 0);
check('...and itemises nothing', replayed.lines.length, 0);
ok('...and says so', replayed.claimed === true);

check('three days is a milestone', streakBonusFor(3), 30);
check('seven days is a bigger one', streakBonusFor(7), 75);
check('eight days is not a milestone', streakBonusFor(8), 0);
check('thirty days is the last one', streakBonusFor(30), 350);
check('thirty-one pays nothing extra', streakBonusFor(31), 0);

const grind = earnedForPractice({ score: 4000, remaining: 5 });
check('practice is clipped to what is left of the cap', grind.total, 5);
ok('...and admits it was clipped', grind.capped === true);

const modest = earnedForPractice({ score: 400, remaining: PRACTICE_DAILY_CAP });
check('an ordinary practice round pays 3', modest.total, 3);
ok('...uncapped', modest.capped === false);
check('a practice round worth nothing itemises nothing',
  earnedForPractice({ score: 20, remaining: 40 }).lines.length, 0);

check('passing until the whistle pays nothing',
  earnedForSlow({ humanWords: 2, humanWon: true, remaining: 30 }).total, 0);
check('winning a real slow game pays 40',
  earnedForSlow({ humanWords: 9, humanWon: true, remaining: SLOW_DAILY_CAP }).total, 40);
check('losing one still pays 20',
  earnedForSlow({ humanWords: 9, humanWon: false, remaining: SLOW_DAILY_CAP }).total, 20);

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
catalogue(COSTUMES, COSTUME_ORDER, DEFAULT_COSTUME, 'costume');
ok('an unknown costume means no costume', costumeFor('tutu') === COSTUMES[DEFAULT_COSTUME]);
ok('"constructor" is not a costume', costumeFor('constructor') === COSTUMES[DEFAULT_COSTUME]);

ok('an unknown background falls back to the default',
  backgroundFor('does-not-exist') === BACKGROUNDS[DEFAULT_BACKGROUND]);
ok('so does no background at all', backgroundFor(undefined) === BACKGROUNDS[DEFAULT_BACKGROUND]);
ok('an unknown track falls back too', trackFor('nope') === TRACKS[DEFAULT_TRACK]);

/* The music is other people's work, so every track carries who made it and
   under what licence - exactly as on its page. */
ok('every track credits its author, licence and source page',
  TRACK_ORDER.every((key) => {
    const credit = TRACKS[key].credit;
    return credit && credit.author && credit.license === 'CC0' &&
      /^https:\/\/opengameart\.org\/content\/[a-z0-9-]+$/.test(credit.url);
  }));
check('a length reads as minutes and seconds', formatLength(68.6), '1:09');
check('...including long ones', formatLength(314.6), '5:15');

/* sounds.js cannot be loaded under node (it require()s audio files), so read it
   as text: every key it maps must be a catalog track, every catalog track must
   be mapped, and every file it points at must exist. A typo in a path otherwise
   only shows up as silence on a phone. */
const soundsSource = fs.readFileSync(path.join(__dirname, '..', 'src/audio/sounds.js'), 'utf8');
const musicBlock = soundsSource.slice(soundsSource.indexOf('export const MUSIC'));
const mapped = [...musicBlock.matchAll(/^\s+(\w+): require\('([^']+)'\)/gm)].map((m) => ({ key: m[1], file: m[2] }));
check('every catalog track has a music file mapped, and nothing else is',
  mapped.map((m) => m.key).sort().join(','), [...TRACK_ORDER].sort().join(','));
const missing = mapped.filter((m) => !fs.existsSync(path.join(__dirname, '..', 'src/audio', m.file)));
check('every mapped music file exists', missing.map((m) => m.file).join(','), '');

// Everything the shop sells. Costumes count: the pacing promise is about
// owning the whole shop, not just some of it.
const total =
  BACKGROUND_ORDER.reduce((sum, key) => sum + BACKGROUNDS[key].price, 0) +
  TRACK_ORDER.reduce((sum, key) => sum + TRACKS[key].price, 0) +
  COSTUME_ORDER.reduce((sum, key) => sum + COSTUMES[key].price, 0);
/*
 * Pacing, asserted rather than assumed.
 *
 * The first pass at these rates was miserly - fourteen weeks of perfect
 * attendance to own everything - and nothing caught it, because every
 * individual number looked reasonable on its own. This models an actual player:
 * one silver daily a day, plus the streak milestones as they land.
 */
const TYPICAL_DAILY = earnedForDaily({ score: 600, medalKey: 'silver', streak: 2 }).total;
const ALL_MILESTONES = STREAK_MILESTONES.reduce((sum, entry) => sum + entry.bonus, 0);

/*
 * Two promises since the premium suits arrived, because one number can no
 * longer hold both: a casual player should own the everyday shop in about
 * three months of dailies alone, and an engaged one - a daily plus a capped
 * practice session and an offline game - should own EVERYTHING, suits
 * included, inside three. What stays fixed is the gap to the next purchase:
 * the cheapest item is still days away, not weeks (below).
 */
const premiumTotal = COSTUME_ORDER.filter((key) => isPremium(COSTUMES[key]))
  .reduce((sum, key) => sum + COSTUMES[key].price, 0);
const everyday = total - premiumTotal;
const daysToClear = Math.ceil((everyday - ALL_MILESTONES) / TYPICAL_DAILY);
ok(
  `the everyday shop costs ${everyday}, cleared in ~${daysToClear} days of dailies alone`,
  daysToClear >= 14 && daysToClear <= 90,
  `        ${daysToClear} days at ${TYPICAL_DAILY}/day - under 14 is trivial, over 90 is a slog`,
);

const ENGAGED_DAILY = TYPICAL_DAILY + PRACTICE_DAILY_CAP + SLOW_COMPLETION_BONUS + SLOW_WIN_BONUS / 2;
const daysToOwnAll = Math.ceil((total - ALL_MILESTONES) / ENGAGED_DAILY);
ok(
  `the whole shop costs ${total}, owned in ~${daysToOwnAll} days by an engaged player`,
  daysToOwnAll >= 21 && daysToOwnAll <= 90,
  `        ${daysToOwnAll} days at ${ENGAGED_DAILY}/day`,
);
// The premium promise is per SUIT, not for the rack. Nobody needs all of them,
// and a bound on the total would mean every new suit made the others feel
// further away - or could not be added at all.
const premiumPrices = COSTUME_ORDER.filter((key) => isPremium(COSTUMES[key])).map((key) => COSTUMES[key].price);
ok('a premium suit is a real goal: at least two weeks of dailies',
  premiumPrices.every((price) => price >= TYPICAL_DAILY * 14));
ok('...and a reachable one: never more than a month of them',
  premiumPrices.every((price) => price <= TYPICAL_DAILY * 30));
ok(`a daily is worth ${TYPICAL_DAILY}, enough that the cheapest item is days away not weeks`,
  TYPICAL_DAILY * 4 >= Math.min(...BACKGROUND_ORDER.filter((k) => BACKGROUNDS[k].price > 0)
    .map((k) => BACKGROUNDS[k].price)));

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

/* ---- online --------------------------------------------------------------- */
{
  const { earnedForOnline, ONLINE_DAILY_CAP } = loadSrc('src/game/economy.js');
  check('winning an online game pays 70', earnedForOnline({ myWords: 5, rank: 1 }).total, 70);
  check('second pays 50', earnedForOnline({ myWords: 5, rank: 2 }).total, 50);
  check('third pays 40', earnedForOnline({ myWords: 5, rank: 3 }).total, 40);
  check('fourth still pays for finishing', earnedForOnline({ myWords: 5, rank: 4 }).total, 30);
  check('sitting there playing one word pays nothing', earnedForOnline({ myWords: 1, rank: 1 }).total, 0);
  const capped = earnedForOnline({ myWords: 5, rank: 1, remaining: 12 });
  check('online respects its own daily cap', capped.total, 12);
  check('...and itemises honestly when clipped', capped.lines.length, 1);
  ok('the online budget is separate and bigger than slow mode\'s', ONLINE_DAILY_CAP > SLOW_DAILY_CAP);
  check('a fresh earn ledger carries an online bucket',
    rollEarn(null, '2026-10-01').online, 0);
  check('remaining online starts at the full cap',
    remainingFor(JSON.parse(JSON.stringify(DEFAULT_PROFILE)), 'online', '2026-10-01'), ONLINE_DAILY_CAP);
}


/* ---- costumes are owned like everything else --------------------------------- */
{
  check('a profile from before costumes existed owns none, without a migration',
    withDefaults({ unlocks: { backgrounds: ['forest'], tracks: [] } }, DEFAULT_PROFILE).unlocks.costumes.length, 0);
  const rich = credit(JSON.parse(JSON.stringify(DEFAULT_PROFILE)), 500);
  const hatted = purchase(rich, 'costumes', 'wizard', COSTUMES.wizard.price);
  ok('a costume can be bought', owns(hatted, 'costumes', 'wizard'));
  ok('...without touching backgrounds or tracks',
    hatted.unlocks.backgrounds.length === 0 && hatted.unlocks.tracks.length === 0);
}


/* ---- the developer's own top-up ----------------------------------------------- */
{
  const fresh = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  ok('with no amount set, nothing is granted - the same object comes back', devGrant(fresh, 0) === fresh);
  ok('junk is not an amount', devGrant(fresh, 'lots') === fresh && devGrant(fresh, -5) === fresh && devGrant(fresh, undefined) === fresh);
  const topped = devGrant(fresh, 100000);
  check('a top-up lands in the balance', balanceOf(topped), 100000);
  ok('...and is not paid again on the next launch', devGrant(topped, 100000) === topped);
  check('raising it pays only the difference', balanceOf(devGrant(topped, 150000)), 150000);
  ok('lowering it takes nothing back', devGrant(topped, 500) === topped);
  const spent = purchase(topped, 'costumes', 'mk2', COSTUMES.mk2.price);
  ok('spending it does not earn a refill', devGrant(spent, 100000) === spent);
  check('it touches no daily earning cap',
    remainingFor(topped, 'practice', '2026-10-02'), PRACTICE_DAILY_CAP);
  check('a player from before this existed has been given none',
    withDefaults({ wallet: { balance: 7, lifetime: 7, spent: 0 } }, DEFAULT_PROFILE).devGrant, 0);
}
