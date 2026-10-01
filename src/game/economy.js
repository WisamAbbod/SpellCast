/**
 * Stardust: what a round is worth.
 *
 * Zero imports, like everything else in src/game - these rates are the part of
 * the shop most likely to need retuning, so they have to be testable under
 * plain node with no device and no framework. That is also why the medal
 * arrives as a string key rather than as an import from the theme: tests/load.js
 * cannot resolve anything that reaches react-native.
 *
 * Nothing here knows about profiles, storage, or caps-as-state. A cap is passed
 * IN as `remaining`, which keeps every function a pure sum and makes the cap
 * itself one line to test.
 */

export const STARDUST_GLYPH = '✦'; // the six-pointed star, distinct from slow mode's gems

/**
 * ~1 stardust per 50 points, floored - a 99-point round pays 1.
 *
 * These rates were doubled-and-then-some after the first pass turned out to be
 * miserly: a typical daily paid 22 against a 2,550 catalog, which is fourteen
 * weeks of perfect attendance to own everything and a full week before you can
 * afford anything at all. A shop you cannot shop in is just a list.
 */
export const POINTS_PER_STARDUST = 50;

/** Paid once per UTC day for finishing the daily, whatever the score. */
export const DAILY_COMPLETION_BONUS = 25;

/** On top of the score. Keys match MEDALS in src/theme/colors.js. */
export const MEDAL_BONUS = { none: 0, bronze: 10, silver: 20, gold: 35, platinum: 60 };

/**
 * Paid on the day a streak reaches exactly this length. Re-earnable after a
 * break, which is deliberate: climbing back from a missed day should be worth
 * something rather than being permanently devalued.
 */
export const STREAK_MILESTONES = [
  { days: 3, bonus: 30 },
  { days: 7, bonus: 75 },
  { days: 14, bonus: 150 },
  { days: 30, bonus: 350 },
];

/**
 * Practice is unlimited, so without BOTH a reduced rate and a hard daily cap it
 * would be the only sensible way to earn and the daily would stop mattering.
 */
export const PRACTICE_RATE = 0.4;
export const PRACTICE_DAILY_CAP = 40;

/**
 * Slow mode pays flat. Its scoring is a different game entirely
 * (src/game/slow/scoring.js) and its totals are not comparable with a
 * 60-second round, so a rate would be meaningless.
 */
export const SLOW_COMPLETION_BONUS = 20;
export const SLOW_WIN_BONUS = 20;
export const SLOW_DAILY_CAP = 80;
/** Below this, a "finished game" is somebody tapping Pass until the whistle. */
export const SLOW_MIN_HUMAN_WORDS = 3;

/**
 * Online pays more than playing alone, because there are real people on the
 * other side - and by YOUR seat: your words, your finishing place. A room with
 * no other humans in it (just bots) is slow mode wearing a costume, and is paid
 * as slow mode by the caller, or a private room of bots would be a farm.
 */
export const ONLINE_COMPLETION_BONUS = 30;
export const ONLINE_PLACEMENT_BONUS = [40, 20, 10]; // 1st, 2nd, 3rd
export const ONLINE_DAILY_CAP = 150;
/** Two words of your own, so sitting in a game until it ends earns nothing. */
export const ONLINE_MIN_WORDS = 2;

const ORDINAL = ['1st', '2nd', '3rd'];

const line = (key, label, amount) => ({ key, label, amount });

const sum = (lines) => lines.reduce((total, entry) => total + entry.amount, 0);

export const stardustForScore = (score, rate = 1) =>
  Math.max(0, Math.floor(((Number(score) || 0) * rate) / POINTS_PER_STARDUST));

export const streakBonusFor = (streak) => {
  const hit = STREAK_MILESTONES.find((entry) => entry.days === streak);
  return hit ? hit.bonus : 0;
};

/**
 * The daily payout, itemised so the results screen can show its working.
 *
 * `claimed` is the replay guard: a daily already marked complete pays nothing,
 * however many times the results screen is reached.
 *
 * @returns {{ total: number, lines: Array, capped: boolean, claimed: boolean }}
 */
export const earnedForDaily = ({ score = 0, medalKey = 'none', streak = 0, claimed = false } = {}) => {
  if (claimed) return { total: 0, lines: [], capped: false, claimed: true };

  const lines = [];

  const fromScore = stardustForScore(score);
  if (fromScore > 0) lines.push(line('score', `${(Number(score) || 0).toLocaleString()} points`, fromScore));

  lines.push(line('daily', 'Daily complete', DAILY_COMPLETION_BONUS));

  const medal = MEDAL_BONUS[medalKey] || 0;
  if (medal > 0) lines.push(line('medal', `${medalKey} medal`, medal));

  const milestone = streakBonusFor(streak);
  if (milestone > 0) lines.push(line('streak', `${streak} day streak`, milestone));

  return { total: sum(lines), lines, capped: false, claimed: false };
};

export const earnedForPractice = ({ score = 0, remaining = PRACTICE_DAILY_CAP } = {}) => {
  const raw = stardustForScore(score, PRACTICE_RATE);
  const total = Math.max(0, Math.min(raw, Math.max(0, Math.floor(Number(remaining) || 0))));

  return {
    total,
    lines: total > 0 ? [line('practice', 'Practice round', total)] : [],
    capped: raw > total,
    claimed: false,
  };
};

/**
 * One online game, from one player's point of view.
 *
 * @param myWords  words this player played
 * @param rank     their finishing place, 1 = won (ties share a rank)
 */
export const earnedForOnline = ({ myWords = 0, rank = 99, remaining = ONLINE_DAILY_CAP } = {}) => {
  if ((Number(myWords) || 0) < ONLINE_MIN_WORDS) {
    return { total: 0, lines: [], capped: false, claimed: false };
  }

  const full = [line('online', 'Online game finished', ONLINE_COMPLETION_BONUS)];
  const place = Math.floor(Number(rank)) - 1;
  if (place >= 0 && place < ONLINE_PLACEMENT_BONUS.length) {
    full.push(line('place', `${ORDINAL[place]} place`, ONLINE_PLACEMENT_BONUS[place]));
  }

  const raw = sum(full);
  const total = Math.max(0, Math.min(raw, Math.max(0, Math.floor(Number(remaining) || 0))));
  return {
    total,
    lines: total === raw ? full : total > 0 ? [line('online', 'Online game finished', total)] : [],
    capped: raw > total,
    claimed: false,
  };
};

export const earnedForSlow = ({ humanWords = 0, humanWon = false, remaining = SLOW_DAILY_CAP } = {}) => {
  if ((Number(humanWords) || 0) < SLOW_MIN_HUMAN_WORDS) {
    return { total: 0, lines: [], capped: false, claimed: false };
  }

  const full = [line('slow', 'Offline game finished', SLOW_COMPLETION_BONUS)];
  if (humanWon) full.push(line('slowWin', 'First place', SLOW_WIN_BONUS));

  const raw = sum(full);
  const total = Math.max(0, Math.min(raw, Math.max(0, Math.floor(Number(remaining) || 0))));

  // Once the cap bites, itemising a breakdown that does not add up to the
  // payout would be a lie - collapse it to the one honest line.
  return {
    total,
    lines: total === raw ? full : total > 0 ? [line('slow', 'Offline game finished', total)] : [],
    capped: raw > total,
    claimed: false,
  };
};
