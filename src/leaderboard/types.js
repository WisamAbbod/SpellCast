/**
 * The leaderboard contract. Documentation, not runtime code.
 *
 * Entry - what the app submits and reads back:
 * {
 *   date: '2026-08-10',        // UTC date key, the puzzle's id
 *   puzzle: 587,
 *   score: 1840,
 *   wordCount: 23,
 *   bestWord: 'STRANGER',
 *   bestWordScore: 207,
 *   parPercent: 68,
 *   generatorVersion: 'g1',    // scores are only comparable within a version
 *   playerId: 'a3f2...',       // the local anon id; auth.uid() server-side
 *   displayName: 'Wisam',
 *   createdAt: 1754784060000,
 * }
 *
 * Leaderboard - every implementation satisfies this:
 *   submit(entry)               -> { ok, queued?, reason? }
 *   topForDate(dateKey, limit)  -> { entries, source }
 *   rankForDate(dateKey, score) -> { rank, total, percentile } | null
 *   historyForPlayer(limit)     -> Entry[]
 *   flushQueue()                -> { sent, remaining }
 *
 * Every method RESOLVES. None rejects. Failure is a value, not an exception -
 * a leaderboard is never allowed to break a results screen.
 */

// One fetch of the top hundred - a few kilobytes - then revealed a page at a
// time on screen, so "More" is instant and costs no further requests.
export const LEADERBOARD_LIMIT = 100;
export const LEADERBOARD_PAGE = 20;

/** How many rows to show after one more press of "More". */
export const revealMore = (shown, available) =>
  Math.min(shown + LEADERBOARD_PAGE, available, LEADERBOARD_LIMIT);
