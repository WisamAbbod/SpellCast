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

export const LEADERBOARD_LIMIT = 25;
