import { readJson, writeJson } from './asyncStore.js';
import { KEYS } from './keys.js';
import { DEFAULT_PROFILE, makeAnonId, withDefaults } from './schema.js';

/** The player's identity and lifetime record. */

let cached = null;

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
  return profile;
};

export const saveProfile = async (profile) => {
  cached = profile;
  return writeJson(KEYS.profile, profile);
};

/** Applies a pure updater from stats.js and persists the result. */
export const updateProfile = async (updater) => {
  const profile = await loadProfile();
  const next = updater(profile);
  await saveProfile(next);
  return next;
};

export const resetProfile = async () => {
  const fresh = { ...DEFAULT_PROFILE, anonId: makeAnonId(), createdAt: Date.now() };
  await saveProfile(fresh);
  return fresh;
};

export const clearProfileCache = () => {
  cached = null;
};
