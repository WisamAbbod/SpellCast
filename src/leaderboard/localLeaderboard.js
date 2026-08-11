import { getDailyRecord, listDailyRecords } from '../storage/dailyResults.js';

/**
 * The local leaderboard.
 *
 * Not a degraded fallback - this is the base layer that always runs. Personal
 * history, per-day best and ranking against your own past work identically
 * whether a backend exists, is unreachable, or was never configured.
 */

const toEntry = (record) => ({
  date: record.date,
  puzzle: record.puzzle,
  score: record.score,
  wordCount: (record.words || []).length,
  bestWord: record.bestWord,
  bestWordScore: record.bestWordScore,
  parPercent: record.parPercent,
  generatorVersion: record.generatorVersion,
  playerId: 'me',
  displayName: 'You',
  createdAt: record.completedAt || record.startedAt,
  isMe: true,
});

export const localLeaderboard = {
  kind: 'local',
  isRemote: false,

  async submit() {
    // The daily record is already written by finishRound; nothing else to do.
    return { ok: true, local: true };
  },

  async topForDate(dateKey) {
    const record = await getDailyRecord(dateKey);
    return {
      entries: record && record.status === 'complete' ? [toEntry(record)] : [],
      source: 'local',
    };
  },

  /** Where this score sits among your own recent rounds. */
  async rankForDate(dateKey, score) {
    const history = (await listDailyRecords(60)).filter(
      (record) => record.status === 'complete' && record.date !== dateKey,
    );
    if (history.length === 0) return null;

    const beaten = history.filter((record) => score > record.score).length;
    const total = history.length + 1;
    return {
      rank: total - beaten,
      total,
      percentile: Math.round((beaten / history.length) * 100),
    };
  },

  async historyForPlayer(limit = 30) {
    const records = await listDailyRecords(limit);
    return records.filter((record) => record.status === 'complete').map(toEntry);
  },

  async flushQueue() {
    return { sent: 0, remaining: 0 };
  },
};

export default localLeaderboard;
