import { PRACTICE_DAILY_CAP, SLOW_DAILY_CAP } from '../game/economy.js';

/**
 * The wallet, as a pure function of the profile.
 *
 * Same shape as stats.js: profile in, profile out, no I/O. Persistence is the
 * caller's job, which is what lets the stardust award ride along on the SAME
 * saveProfile() write as the round's statistics - so a round can never bank the
 * score and lose the payout, or the other way round.
 *
 * Every updater returns the SAME object when it is a no-op, so a caller can
 * detect "that did nothing" with === and skip the write.
 */

const EMPTY_WALLET = { balance: 0, lifetime: 0, spent: 0 };

export const balanceOf = (profile) =>
  (profile && profile.wallet && profile.wallet.balance) || 0;

export const owns = (profile, kind, key) =>
  !!key && !!profile && !!profile.unlocks &&
  Array.isArray(profile.unlocks[kind]) && profile.unlocks[kind].includes(key);

export const canAfford = (profile, price) => balanceOf(profile) >= (Number(price) || 0);

/** A fresh earn ledger when the UTC day has turned over. */
export const rollEarn = (earn, dateKey) =>
  earn && earn.date === dateKey ? earn : { date: dateKey || null, practice: 0, slow: 0 };

/** How much of today's cap is left for a bucket. */
export const remainingFor = (profile, bucket, dateKey) => {
  const cap = bucket === 'practice' ? PRACTICE_DAILY_CAP : SLOW_DAILY_CAP;
  const earn = rollEarn(profile && profile.earn, dateKey);
  return Math.max(0, cap - (earn[bucket] || 0));
};

/**
 * Credits stardust and, when a bucket is named, charges it against that
 * bucket's daily cap. `bucket` is null for the daily, which is capped by the
 * daily record's own completion flag instead of by a counter.
 */
export const credit = (profile, amount, { bucket = null, dateKey = null } = {}) => {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (value === 0) return profile;

  const wallet = { ...EMPTY_WALLET, ...(profile.wallet || {}) };
  const earn = rollEarn(profile.earn, dateKey || (profile.earn && profile.earn.date) || null);

  return {
    ...profile,
    wallet: {
      balance: wallet.balance + value,
      lifetime: wallet.lifetime + value,
      spent: wallet.spent,
    },
    earn: bucket ? { ...earn, [bucket]: (earn[bucket] || 0) + value } : earn,
  };
};

/**
 * Buys `key`. Returns the profile UNCHANGED if it is already owned, cannot be
 * afforded, or the arguments are nonsense - so the caller's `next !== profile`
 * check is the whole error path.
 */
export const purchase = (profile, kind, key, price) => {
  const cost = Math.max(0, Math.floor(Number(price) || 0));
  if (!key || !kind || !profile) return profile;
  if (owns(profile, kind, key)) return profile;
  if (!canAfford(profile, cost)) return profile;

  const wallet = { ...EMPTY_WALLET, ...(profile.wallet || {}) };
  const unlocks = profile.unlocks || {};

  return {
    ...profile,
    wallet: {
      balance: wallet.balance - cost,
      lifetime: wallet.lifetime,
      spent: wallet.spent + cost,
    },
    // A new array, never a push: DEFAULT_PROFILE.unlocks.backgrounds is shared
    // by reference with every profile a shallow spread has ever produced, and
    // mutating it would poison the defaults for the whole process.
    unlocks: { ...unlocks, [kind]: [...(unlocks[kind] || []), key] },
  };
};
