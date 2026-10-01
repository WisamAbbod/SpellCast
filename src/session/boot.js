import { initAudio, startMusic } from '../audio/audio.js';
import { warmDictionary } from '../game/dictionary.js';
import { flushLeaderboardQueue } from '../leaderboard/index.js';
import { store } from '../storage/asyncStore.js';
import { runMigrations } from '../storage/migrations.js';
import { loadProfile, saveProfile } from '../storage/profile.js';
import { loadSettings } from '../storage/settings.js';
import { credit, devGrant } from '../storage/wallet.js';
import { runWhenIdle } from './idle.js';

/** The most a returning player can be handed for the play they already did. */
const FOUNDER_GRANT_CAP = 400;

/**
 * Back-pays somebody who was already playing before stardust existed.
 *
 * Opening a brand new shop on a balance of zero, having played two hundred
 * dailies, reads as a punishment for having been here first.
 *
 * Needs no flag and no migration: lifetime only ever goes up, so a wallet that
 * has never earned anything belongs to someone who has never seen the shop.
 */
const grantFounderStardust = async (profile) => {
  if (profile.wallet.lifetime > 0 || profile.daily.played === 0) return profile;

  const grant = Math.min(
    FOUNDER_GRANT_CAP,
    profile.daily.played * 8 + (profile.streak.best || 0) * 5,
  );
  const credited = credit(profile, grant);
  if (credited === profile) return profile;

  await saveProfile(credited);
  return credited;
};

/**
 * The developer's own stardust, for trying the shop. Two locks, and it needs
 * both: the amount lives in the gitignored .env, so it exists on one machine;
 * and __DEV__ is false in every build a player can install, so even a release
 * bundle made ON that machine grants nothing.
 */
const DEV_STARDUST =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? Number(process.env.EXPO_PUBLIC_DEV_STARDUST) || 0
    : 0;

/**
 * What has to happen before the first screen appears, and what can wait.
 *
 * Blocking: migrations, settings and profile - screens read them synchronously.
 * Deferred: the dictionary trie (~150ms) and audio, both of which would
 * otherwise be paid for by whoever taps Play first.
 */
export const boot = async () => {
  await runMigrations(store);
  await loadSettings();
  const profile = await grantFounderStardust(await loadProfile());
  const topped = devGrant(profile, DEV_STARDUST);
  if (topped !== profile) await saveProfile(topped);

  runWhenIdle(() => {
    warmDictionary();
    initAudio();
    // Asked for here rather than when a round starts, so the menu is not
    // silent. initAudio honours the request once the player is built.
    startMusic();
    flushLeaderboardQueue();
  });
};

export default boot;
