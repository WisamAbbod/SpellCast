/**
 * Defaults and the merge that guarantees a read never returns a half-shaped
 * record. Every reader goes through withDefaults, so a missing field - from a
 * skipped migration, a partial write, or a future rollback - can't crash a
 * screen.
 */

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  v: 1,
  music: true,
  sound: true,
  haptics: true,
  reducedMotion: false,
  musicVolume: 0.45,
  soundVolume: 0.8,
  displayName: '',
};

export const DEFAULT_PROFILE = {
  v: 1,
  anonId: '',
  createdAt: 0,
  streak: { current: 0, best: 0, lastCompletedDate: null },
  daily: {
    played: 0,
    totalScore: 0,
    bestScore: 0,
    bestScoreDate: null,
    bestWord: null,
    bestWordScore: 0,
    totalWords: 0,
    parPercentTotal: 0,
  },
  practice: { played: 0, totalScore: 0, bestScore: 0, totalWords: 0 },
  perLength: {},
  lastSeenPuzzle: null,
};

export const DEFAULT_DAILY_RECORD = {
  v: 1,
  date: '',
  puzzle: 0,
  generatorVersion: '',
  status: 'in_progress', // 'in_progress' | 'complete'
  startedAt: 0,
  completedAt: null,
  score: 0,
  words: [],
  bestWord: null,
  bestWordScore: 0,
  par: 0,
  parPercent: 0,
  wordsAvailable: 0,
  topFound: 0,
  topTotal: 10,
  checkpoint: null, // { score, words, secondsLeft, at }
};

/** Shallow-merges one level deep, which is as deep as these records nest. */
export const withDefaults = (value, defaults) => {
  if (!value || typeof value !== 'object') return { ...defaults };

  const merged = { ...defaults, ...value };
  Object.keys(defaults).forEach((key) => {
    const fallback = defaults[key];
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      merged[key] = { ...fallback, ...(value[key] || {}) };
    }
  });
  return merged;
};

/** Enough entropy to identify a device without asking anyone to sign up. */
export const makeAnonId = (random = Math.random, now = Date.now) => {
  const chunk = () => Math.floor(random() * 0xffffffff).toString(36);
  return `${now().toString(36)}${chunk()}${chunk()}`.slice(0, 24);
};
