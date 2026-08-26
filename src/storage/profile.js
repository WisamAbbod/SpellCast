import { readJson, writeJson } from './asyncStore.js';
import { KEYS } from './keys.js';
import { DEFAULT_PROFILE, makeAnonId, withDefaults } from './schema.js';

/**
 * The player's identity, lifetime record and stardust.
 *
 * Observable the same way settings.js is, because the balance is now on screen:
 * a menu badge that only refreshed on mount would go stale the moment a round
 * paid out. Listeners are notified synchronously, before the write, so a
 * subscriber never renders a number that is one save behind.
 */

let cached = null;
const listeners = new Set();

const notify = (profile) => listeners.forEach((listener) => listener(profile));

export const loadProfile = async () => {
  if (cached) return cached;
  const stored = await readJson(KEYS.profile, null);
  let profile = withDefaults(stored, DEFAULT_PROFILE);

  // Generated even without a backend: if the leaderboard is switched on later,
  // existing local history can be attributed instead of orphaned.
  if (!profile.anonId) {
    profile = { ...profile, anonId: makeAnonId(), createdAt: Date.now() };
    await writeJson(KEYS.profile, profile);
  }

  cached = profile;
  notify(profile);
  return profile;
};

/** The synchronous read, valid once boot has run. Mirrors getSettings(). */
export const getProfile = () => cached || DEFAULT_PROFILE;

export const subscribeToProfile = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const saveProfile = async (profile) => {
  cached = profile;
  notify(profile);
  return writeJson(KEYS.profile, profile);
};

/** Applies a pure updater from stats.js or wallet.js and persists the result. */
export const updateProfile = async (updater) => {
  const profile = await loadProfile();
  const next = updater(profile);
  await saveProfile(next);
  return next;
};

export const resetProfile = async () => {
  // Rebuilt a level deep rather than spread. A shallow `{ ...DEFAULT_PROFILE }`
  // hands out the SAME nested objects every time, so `unlocks.backgrounds` would
  // be one array shared by every profile the app has ever produced - and one
  // in-place push anywhere would poison the defaults for the whole process.
  const fresh = {
    ...DEFAULT_PROFILE,
    anonId: makeAnonId(),
    createdAt: Date.now(),
    streak: { ...DEFAULT_PROFILE.streak },
    daily: { ...DEFAULT_PROFILE.daily },
    practice: { ...DEFAULT_PROFILE.practice },
    perLength: {},
    wallet: { ...DEFAULT_PROFILE.wallet },
    unlocks: { backgrounds: [], tracks: [] },
    earn: { ...DEFAULT_PROFILE.earn },
  };
  await saveProfile(fresh);
  return fresh;
};

export const clearProfileCache = () => {
  cached = null;
  notify(DEFAULT_PROFILE);
};
