import { readJson, writeJson } from './asyncStore.js';
import { KEYS } from './keys.js';

/** Submissions waiting for a network. Bounded, newest kept. */

const MAX_QUEUED = 40;

export const readQueue = async () => (await readJson(KEYS.queue, [])) || [];

export const enqueue = async (entry) => {
  const queue = await readQueue();
  const deduped = queue.filter(
    (item) => !(item.date === entry.date && item.playerId === entry.playerId),
  );
  return writeJson(KEYS.queue, [...deduped, entry].slice(-MAX_QUEUED));
};

export const replaceQueue = async (entries) => writeJson(KEYS.queue, entries.slice(-MAX_QUEUED));

export const clearQueue = async () => writeJson(KEYS.queue, []);
