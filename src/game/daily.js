import { GENERATOR_VERSION } from '../config.js';

/**
 * The daily puzzle calendar.
 *
 * Dates are UTC, not local. A leaderboard row labelled 2026-08-10 has to mean
 * the same board in Auckland and Los Angeles, and there is no way to reconcile
 * that afterwards if it doesn't. The cost is that the puzzle rolls over at an
 * odd local hour, which is why everything user-facing says "Puzzle #587" rather
 * than "today's puzzle", and why the menu shows a countdown to the next one.
 */

export const PUZZLE_EPOCH_UTC = Date.UTC(2026, 0, 1); // puzzle #1
export const DAY_MS = 86400000;

/** 'YYYY-MM-DD' in UTC - the canonical id of a puzzle. */
export const utcDateKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export const dateKeyToMs = (dateKey) => Date.parse(`${dateKey}T00:00:00.000Z`);

export const puzzleNumber = (dateKey) =>
  Math.floor((dateKeyToMs(dateKey) - PUZZLE_EPOCH_UTC) / DAY_MS) + 1;

export const previousDateKey = (dateKey) => utcDateKey(dateKeyToMs(dateKey) - DAY_MS);

export const nextDateKey = (dateKey) => utcDateKey(dateKeyToMs(dateKey) + DAY_MS);

export const msUntilNextPuzzle = (now = Date.now()) =>
  dateKeyToMs(utcDateKey(now)) + DAY_MS - now;

export const isFutureDate = (dateKey, now = Date.now()) => dateKey > utcDateKey(now);

/* --------------------------------------------------------------- seeds -- */

export const dailySeed = (dateKey) => `spellcast:${GENERATOR_VERSION}:daily:${dateKey}`;

/** A separate channel, so changing the board never moves the bonus tiles. */
export const dailyCellSeed = (dateKey) => `${dailySeed(dateKey)}:cells`;

export const practiceSeed = (token) => `spellcast:${GENERATOR_VERSION}:practice:${token}`;

export const practiceCellSeed = (token) => `${practiceSeed(token)}:cells`;

/** Shuffles stay deterministic too - a reroll can't be fished for a better board. */
export const shuffleSeed = (baseSeed, index) => `${baseSeed}:shuffle:${index}`;

/** Formats a countdown as H:MM:SS for the "next puzzle in" label. */
export const formatCountdown = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
};
