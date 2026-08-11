/**
 * Build-time configuration.
 *
 * EXPO_PUBLIC_* variables are inlined by Metro, so they work in Expo Go with no
 * native config. Copy .env.example to .env to switch the leaderboard on.
 */

/**
 * Bump this whenever board generation changes in any way: the dictionary, the
 * letter bag, the quality function, the seed-word count, or the ORDER of rng()
 * calls. It is part of every seed string, is stored on every saved result, and
 * every leaderboard query filters on it - so old scores stay comparable only
 * with boards that were actually the same.
 */
export const GENERATOR_VERSION = 'g1';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/** 'auto' uses the global leaderboard when keys exist, and local storage when they don't. */
export const LEADERBOARD_MODE = process.env.EXPO_PUBLIC_LEADERBOARD_MODE || 'auto';

export const hasRemoteConfig = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
