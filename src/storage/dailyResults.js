import { GENERATOR_VERSION } from '../config.js';
import { puzzleNumber } from '../game/daily.js';
import { readJson, readMany, removeMany, writeJson } from './asyncStore.js';
import { KEYS, MAX_DAILY_RECORDS } from './keys.js';
import { DEFAULT_DAILY_RECORD, withDefaults } from './schema.js';

/**
 * One record per puzzle, under its own key.
 *
 * Per-day keys rather than a single blob: history grows without bound, and the
 * in-round checkpoint writes every few seconds - rewriting the whole history
 * each time would get slower every day the game is played.
 */

/** How long an abandoned round can be resumed before it is simply finalised. */
export const RESUME_GRACE_MS = 5 * 60 * 1000;

export const getDailyRecord = async (dateKey) => {
  const stored = await readJson(KEYS.daily(dateKey), null);
  return stored ? withDefaults(stored, DEFAULT_DAILY_RECORD) : null;
};

const addToIndex = async (dateKey) => {
  const index = (await readJson(KEYS.dailyIndex, [])) || [];
  if (index[0] === dateKey) return index;

  const next = [dateKey, ...index.filter((key) => key !== dateKey)];
  const trimmed = next.slice(0, MAX_DAILY_RECORDS);
  if (next.length > trimmed.length) {
    await removeMany(next.slice(MAX_DAILY_RECORDS).map(KEYS.daily));
  }
  await writeJson(KEYS.dailyIndex, trimmed);
  return trimmed;
};

/**
 * Claims today's attempt. Written BEFORE the timer starts: if it were written
 * on completion, force-quitting a bad opening would buy a fresh attempt.
 */
export const startDailyAttempt = async (dateKey, board) => {
  const existing = await getDailyRecord(dateKey);
  if (existing && existing.status === 'complete') return existing;

  const record = {
    ...DEFAULT_DAILY_RECORD,
    date: dateKey,
    puzzle: puzzleNumber(dateKey),
    generatorVersion: GENERATOR_VERSION,
    status: 'in_progress',
    startedAt: existing ? existing.startedAt : Date.now(),
    par: board.analysis.par,
    wordsAvailable: board.analysis.count,
    topTotal: board.analysis.top.length,
    checkpoint: existing ? existing.checkpoint : null,
  };

  await writeJson(KEYS.daily(dateKey), record);
  await addToIndex(dateKey);
  return record;
};

/** Cheap, frequent save so a crash or a phone call doesn't cost the day. */
export const checkpointDaily = async (dateKey, { score, words, secondsLeft }) => {
  const record = await getDailyRecord(dateKey);
  if (!record || record.status === 'complete') return record;

  const next = {
    ...record,
    checkpoint: { score, words, secondsLeft, at: Date.now() },
  };
  await writeJson(KEYS.daily(dateKey), next);
  return next;
};

export const completeDaily = async (dateKey, result) => {
  const record = (await getDailyRecord(dateKey)) || {
    ...DEFAULT_DAILY_RECORD,
    date: dateKey,
    puzzle: puzzleNumber(dateKey),
    generatorVersion: GENERATOR_VERSION,
    startedAt: Date.now(),
  };
  if (record.status === 'complete') return record;

  const next = {
    ...record,
    ...result,
    status: 'complete',
    completedAt: Date.now(),
    checkpoint: null,
  };
  await writeJson(KEYS.daily(dateKey), next);
  await addToIndex(dateKey);
  return next;
};

export const canResume = (record, now = Date.now()) =>
  !!record &&
  record.status === 'in_progress' &&
  !!record.checkpoint &&
  record.checkpoint.secondsLeft > 0 &&
  now - record.checkpoint.at < RESUME_GRACE_MS;

export const listDailyRecords = async (limit = 30) => {
  const index = (await readJson(KEYS.dailyIndex, [])) || [];
  const wanted = index.slice(0, limit);
  if (wanted.length === 0) return [];

  const values = await readMany(wanted.map(KEYS.daily));
  return wanted
    .map((dateKey) => values[KEYS.daily(dateKey)])
    .filter(Boolean)
    .map((record) => withDefaults(record, DEFAULT_DAILY_RECORD));
};

export const clearDailyHistory = async () => {
  const index = (await readJson(KEYS.dailyIndex, [])) || [];
  await removeMany([...index.map(KEYS.daily), KEYS.dailyIndex]);
};
