import { LEADERBOARD_MODE, hasRemoteConfig } from '../config.js';
import localLeaderboard from './localLeaderboard.js';
import remoteWithFallback from './remoteWithFallback.js';

/**
 * Picks an implementation. Nothing outside this folder knows which one is live.
 *
 * With no Supabase keys the whole app runs on local storage - the leaderboard
 * screen shows your own history instead of a global table, and nothing else
 * changes.
 */

let cached = null;

export const isRemoteEnabled = () =>
  LEADERBOARD_MODE !== 'local' && hasRemoteConfig();

export const getLeaderboard = () => {
  if (cached) return cached;

  if (!isRemoteEnabled()) {
    cached = localLeaderboard;
    return cached;
  }

  // Required lazily so a local-only build never pulls in supabase-js.
  const { supabaseLeaderboard } = require('./supabaseLeaderboard.js');
  cached = remoteWithFallback(supabaseLeaderboard, localLeaderboard);
  return cached;
};

/** Retries anything that was queued while offline. Safe to call any time. */
export const flushLeaderboardQueue = async () => {
  try {
    return await getLeaderboard().flushQueue();
  } catch (error) {
    return { sent: 0, remaining: 0 };
  }
};
