/**
 * Every storage key, in one place.
 *
 * The version lives in the *value* (each record carries a `v`), not in the key
 * prefix - otherwise a migration would have to know every historical prefix in
 * order to find the old data.
 */

const PREFIX = 'spellcast/';

export const KEYS = {
  schemaVersion: `${PREFIX}schemaVersion`,
  settings: `${PREFIX}settings`,
  profile: `${PREFIX}profile`,
  dailyIndex: `${PREFIX}dailyIndex`,
  queue: `${PREFIX}queue`,
  daily: (dateKey) => `${PREFIX}daily/${dateKey}`,
};

export const DAILY_PREFIX = `${PREFIX}daily/`;

/** Keep history bounded - roughly a year of puzzles. */
export const MAX_DAILY_RECORDS = 400;
