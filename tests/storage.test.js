'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const {
  withDefaults, makeAnonId, DEFAULT_PROFILE, DEFAULT_SETTINGS, CURRENT_SCHEMA_VERSION,
} = loadSrc('src/storage/schema.js');
const { runMigrations, MIGRATIONS } = loadSrc('src/storage/migrations.js');
const { KEYS } = loadSrc('src/storage/keys.js');
const {
  recordDailyResult, recordPracticeResult, averageDailyScore, averageParPercent,
  longestWordFound,
} = loadSrc('src/storage/stats.js');

suite('schema');

check('missing values become defaults', withDefaults(null, DEFAULT_SETTINGS).music, true);
check('rubbish becomes defaults', withDefaults('nonsense', DEFAULT_SETTINGS).sound, true);
check('stored values win', withDefaults({ music: false }, DEFAULT_SETTINGS).music, false);
check('absent fields are filled in', withDefaults({ music: false }, DEFAULT_SETTINGS).haptics, true);

const partialProfile = withDefaults({ daily: { played: 3 } }, DEFAULT_PROFILE);
check('nested objects merge rather than replace', partialProfile.daily.played, 3);
check('...and keep their other defaults', partialProfile.daily.bestScore, 0);
check('...and sibling branches survive', partialProfile.practice.played, 0);

ok('anon ids are unique', makeAnonId() !== makeAnonId());
ok('anon ids are a reasonable length', makeAnonId().length >= 12);

const fakeStore = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    readRaw: async (key, fallback = null) => (key in data ? data[key] : fallback),
    writeRaw: async (key, value) => {
      data[key] = String(value);
      return true;
    },
    readJson: async (key, fallback = null) => (key in data ? data[key] : fallback),
    writeJson: async (key, value) => {
      data[key] = value;
      return true;
    },
  };
};

const run = async () => {
  suite('migrations');
  const fresh = fakeStore();
  const first = await runMigrations(fresh);
  check('a fresh install stamps the current version', first.fresh, true);
  check('...and runs nothing', first.ran, 0);
  check('...and writes the version', fresh.data[KEYS.schemaVersion], String(CURRENT_SCHEMA_VERSION));

  const second = await runMigrations(fresh);
  check('running again is a no-op', second.ran, 0);
  check('...and does not report a fresh install', second.fresh, false);

  const corrupt = fakeStore({ [KEYS.schemaVersion]: 'not a number' });
  const recovered = await runMigrations(corrupt);
  ok('a corrupt version does not throw', recovered.to === CURRENT_SCHEMA_VERSION);

  check('the ladder is declared', Array.isArray(MIGRATIONS), true);
};

suite('stats');

const base = JSON.parse(JSON.stringify(DEFAULT_PROFILE));

const afterOne = recordDailyResult(base, {
  date: '2026-08-10', score: 900, words: ['CAT', 'DREAM', 'STRANGER'],
  bestWord: 'STRANGER', bestWordScore: 207, parPercent: 45,
});
check('a daily round is counted', afterOne.daily.played, 1);
check('the score is banked', afterOne.daily.totalScore, 900);
check('a first score is the best score', afterOne.daily.bestScore, 900);
check('the streak starts', afterOne.streak.current, 1);
check('words are counted', afterOne.daily.totalWords, 3);
check('the length histogram is built', afterOne.perLength[8], 1);

const afterTwo = recordDailyResult(afterOne, {
  date: '2026-08-11', score: 400, words: ['CAT'],
  bestWord: 'CAT', bestWordScore: 30, parPercent: 20,
});
check('a worse round does not lower the best', afterTwo.daily.bestScore, 900);
check('...nor the best word', afterTwo.daily.bestWord, 'STRANGER');
check('the streak extends', afterTwo.streak.current, 2);
check('averages come out right', averageDailyScore(afterTwo), 650);
check('average par too', averageParPercent(afterTwo), 33);
check('the longest word is derived', longestWordFound(afterTwo), 8);

const afterPractice = recordPracticeResult(afterTwo, { score: 5000, words: ['CAT'] });
check('practice is counted separately', afterPractice.practice.played, 1);
check('...and never inflates daily stats', afterPractice.daily.bestScore, 900);
check('...or the streak', afterPractice.streak.current, 2);

module.exports = run;
