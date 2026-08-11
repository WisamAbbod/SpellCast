import { enqueue, readQueue, replaceQueue } from '../storage/queue.js';

/**
 * Remote when it works, local when it doesn't, and never an exception either
 * way. A failed submit is queued and retried on the next launch or the next
 * time the stats screen opens.
 */
export const remoteWithFallback = (remote, local) => ({
  kind: 'remote',
  isRemote: true,

  async submit(entry) {
    try {
      const result = await remote.submit(entry);
      if (result.ok) return result;
      await enqueue(entry);
      return { ok: true, queued: true, reason: result.reason };
    } catch (error) {
      await enqueue(entry);
      return { ok: true, queued: true, reason: 'offline' };
    }
  },

  async topForDate(dateKey, limit) {
    try {
      const result = await remote.topForDate(dateKey, limit);
      if (result.entries.length > 0) return result;
    } catch (error) {
      /* fall through */
    }
    return local.topForDate(dateKey, limit);
  },

  async rankForDate(dateKey, score) {
    try {
      const rank = await remote.rankForDate(dateKey, score);
      if (rank) return rank;
    } catch (error) {
      /* fall through */
    }
    return local.rankForDate(dateKey, score);
  },

  async historyForPlayer(limit) {
    // Local history is authoritative for the player's own record: it exists
    // even for rounds played before the backend was reachable.
    return local.historyForPlayer(limit);
  },

  async flushQueue() {
    const queue = await readQueue();
    if (queue.length === 0) return { sent: 0, remaining: 0 };

    const remaining = [];
    let sent = 0;

    for (const entry of queue) {
      try {
        const result = await remote.submit(entry);
        if (result.ok) sent++;
        else remaining.push(entry);
      } catch (error) {
        remaining.push(entry);
      }
    }

    await replaceQueue(remaining);
    return { sent, remaining: remaining.length };
  },
});

export default remoteWithFallback;
