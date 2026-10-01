/**
 * The mascot's moods, and what the game makes it feel.
 *
 * Rules only - no drawing, no React - so they load under plain node like the
 * rest of src/game. The astronaut itself is data in src/theme/astronaut.js (the
 * rig) and src/theme/astronautMoves.js (the choreography).
 *
 * These names are also the contract for a future Rive or Lottie character:
 * whatever replaces the code-drawn one only has to understand these strings.
 */

/** Moods it can rest in. They loop for as long as they hold. */
export const RESTING_MOODS = ['idle', 'sleepy', 'thinking', 'panic', 'focused'];

/** Moods it plays once, then hands back to the resting mood. */
export const REACTION_MOODS = ['happy', 'ecstatic', 'oops', 'dizzy', 'wave', 'thinking', 'wow'];

export const MOODS = [...new Set([...RESTING_MOODS, ...REACTION_MOODS])];

/** How long each reaction plays. Held equal to the choreography by a test. */
export const REACTION_MS = {
  happy: 900,
  ecstatic: 1500,
  oops: 1200,
  dizzy: 1600,
  wave: 1600,
  thinking: 1400,
  wow: 1000,
};

export const isMood = (mood) => MOODS.includes(mood);

/** How long a mood holds before falling back. Resting moods hold forever. */
export const reactionLength = (mood) => REACTION_MS[mood] || 0;

/**
 * A found word. Long words and a running combo earn the backflip, so it stays
 * special - if every word got a backflip, none of them would.
 *
 * @param chain the combo chain as GameScreen counts it (0 = no combo).
 */
export const moodForWord = ({ length = 0, chain = 0 } = {}) =>
  length >= 7 || chain >= 4 ? 'ecstatic' : 'happy';

/** The results screen. No medal reads as a shrug, never as disappointment. */
export const moodForResult = (medalKey) => {
  if (medalKey === 'platinum' || medalKey === 'gold') return 'ecstatic';
  if (medalKey === 'silver' || medalKey === 'bronze') return 'happy';
  return 'thinking';
};

/** Resting mood by the player's local hour: asleep in the small hours. */
export const idleMoodFor = (hour) => (hour >= 0 && hour < 6 ? 'sleepy' : 'idle');

/**
 * Resting mood during a timed round: panic in the last ten seconds, watching
 * closely while a finger is on the board, otherwise just floating.
 */
export const moodForRound = ({ secondsLeft = 60, running = true, tracing = false } = {}) => {
  if (running && secondsLeft > 0 && secondsLeft <= 10) return 'panic';
  if (tracing) return 'focused';
  return 'idle';
};

/**
 * Where to look for a board cell, in the -1..1 space the mascot's gaze uses.
 *
 * The astronaut floats above the board, off to one side, so every cell is below
 * it and the whole board is somewhat toward the centre. `side` is where it is
 * sitting: -1 left, 0 middle, 1 right.
 */
export const gazeForCell = ({ row, col }, gridSize = 5, side = 1) => {
  const half = (gridSize - 1) / 2;
  const x = (col - half) / half; // -1 .. 1 across the board
  const y = row / (gridSize - 1); // 0 .. 1 down it
  const clamp = (value) => Math.max(-1, Math.min(1, value));
  return {
    x: clamp(x * 0.75 - side * 0.35),
    y: clamp(0.25 + y * 0.7),
  };
};
