import { previousDateKey } from '../game/daily.js';

/**
 * Streaks, split into "what to store" and "what to show".
 *
 * Storing a broken flag would need code to run at midnight. Deriving it at read
 * time is stateless and always right, and keeps `current` around so the results
 * screen can say "your streak of 12 ended" rather than just showing 0.
 */

export const applyStreak = (streak, dateKey) => {
  if (!streak || !dateKey) return streak;
  if (streak.lastCompletedDate === dateKey) return streak; // idempotent

  // A device clock that moved backwards must never corrupt the record.
  if (streak.lastCompletedDate && dateKey < streak.lastCompletedDate) return streak;

  const current =
    streak.lastCompletedDate === previousDateKey(dateKey) ? streak.current + 1 : 1;

  return {
    current,
    best: Math.max(streak.best || 0, current),
    lastCompletedDate: dateKey,
  };
};

export const displayedStreak = (streak, todayKey) => {
  if (!streak || !streak.lastCompletedDate) return 0;
  if (streak.lastCompletedDate === todayKey) return streak.current;
  if (streak.lastCompletedDate === previousDateKey(todayKey)) return streak.current;
  return 0; // a day was missed
};

/** True when today still counts toward the run the player already has going. */
export const streakAtRisk = (streak, todayKey) =>
  !!streak &&
  streak.current > 0 &&
  streak.lastCompletedDate === previousDateKey(todayKey);
