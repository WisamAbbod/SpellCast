/**
 * Time helpers. The round runs against a deadline rather than a chain of
 * setTimeouts: a chain drifts by however long each tick was late, and loses
 * time entirely while the app is backgrounded.
 */

export const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
};

export const secondsRemaining = (deadline, now = Date.now()) =>
  Math.max(0, Math.ceil((deadline - now) / 1000));

export const deadlineFrom = (durationSeconds, now = Date.now()) =>
  now + durationSeconds * 1000;

/** Rebuilds a deadline after a pause, preserving whatever was left on the clock. */
export const resumeDeadline = (secondsLeft, now = Date.now()) => now + secondsLeft * 1000;
