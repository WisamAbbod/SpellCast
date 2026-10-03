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

/* ---- the player's name ------------------------------------------------ */
{
  const { cleanName, needsWelcome, NAME_LIMIT } = loadSrc('src/storage/schema.js');
  check('a name is trimmed', cleanName('  Wisam  '), 'Wisam');
  check('inner runs of spaces collapse', cleanName('Big    Al'), 'Big Al');
  check(`a name is capped at ${NAME_LIMIT}`, cleanName('Abcdefghijklmnop').length, NAME_LIMIT);
  check('a cap never leaves a trailing space', cleanName('Abcdefghijk lmnop'), 'Abcdefghijk');
  check('nothing at all is no name', cleanName(undefined), '');
  ok('a new player is welcomed', needsWelcome({ welcomed: false, displayName: '' }));
  ok('someone who already has a name is not', !needsWelcome({ welcomed: false, displayName: 'Ada' }));
  ok('someone who skipped is not asked again', !needsWelcome({ welcomed: true, displayName: '' }));
  ok('a name of only spaces still counts as none', needsWelcome({ welcomed: false, displayName: '   ' }));
}


/* ---- volumes --------------------------------------------------------------- */
{
  const { cleanVolume, DEFAULT_SETTINGS } = loadSrc('src/storage/schema.js');
  check('a volume is kept to the percent', cleanVolume(0.4567), 0.46);
  check('a volume above full is full', cleanVolume(1.7), 1);
  check('a volume below silent is silent', cleanVolume(-0.2), 0);
  check('silent is a real choice, not a missing value', cleanVolume(0), 0);
  check('garbage falls back to the default music volume', cleanVolume('loud'), DEFAULT_SETTINGS.musicVolume);
  check('NaN falls back too', cleanVolume(NaN), DEFAULT_SETTINGS.musicVolume);
  check('null falls back rather than meaning silent', cleanVolume(null), DEFAULT_SETTINGS.musicVolume);
  check('a numeric string from old storage still reads', cleanVolume('0.3'), 0.3);
}


/* ---- leaderboard paging ------------------------------------------------------ */
{
  const { LEADERBOARD_LIMIT, LEADERBOARD_PAGE, revealMore } = loadSrc('src/leaderboard/types.js');
  check('the board fetches a hundred', LEADERBOARD_LIMIT, 100);
  check('"More" reveals another page', revealMore(LEADERBOARD_PAGE, 100), LEADERBOARD_PAGE * 2);
  check('...but never past who actually played', revealMore(20, 27), 27);
  check('...nor past the hundred', revealMore(95, 500), 100);
  let shown = LEADERBOARD_PAGE;
  let presses = 0;
  while (shown < 100 && presses < 50) { shown = revealMore(shown, 100); presses++; }
  check('four presses take twenty to a hundred', presses, 4);
}

/* ---- names other players will see ---------------------------------------------- */
{
  const { nameIssue, isNameAllowed, safeName } = loadSrc('src/game/names.js');
  const blocked = ['fuck', 'F.u.c.k', 'sh1t', 'fuuuuck', 'ass', 'a s s', 'Big Ass', 'b!tch', 'cunt99', 'Hitler', 'KYS'];
  const fine = ['Wisam', 'Cassandra', 'Scunthorpe', 'Dickens', 'Peacock', 'Grape', 'Essex', 'Spice', 'Raccoon',
    'Night Owl', 'Therapist', 'Torpedo', 'Classic', 'Assassin', 'Cucumber', 'Shiitake', 'Hancock', 'Nova', 'Player 2'];
  check('obvious and disguised names are refused', blocked.filter(isNameAllowed).join(','), '');
  check('ordinary names that merely contain a rude word are left alone', fine.filter((n) => !isNameAllowed(n)).join(','), '');
  check('an empty name is not an offence (it means anonymous)', nameIssue(''), null);
  ok('a refusal comes with something to show the player', typeof nameIssue('shit') === 'string');
  check('someone else\'s clean name is shown as it is', safeName('Cassandra', 'Player'), 'Cassandra');
  check('...and a bad one is replaced, not shown', safeName('sh1thead', 'Player 3'), 'Player 3');
  check('whatever the server sends, it never throws', [null, undefined, 42, {}, ''].map((v) => safeName(v, 'Anonymous')).join(','),
    'Anonymous,Anonymous,Anonymous,Anonymous,Anonymous');
}

/* ---- hidden players -------------------------------------------------------------- */
{
  const { DEFAULT_SETTINGS, withDefaults, withHidden, hiddenIds } = loadSrc('src/storage/schema.js');
  check('nobody is hidden to begin with', hiddenIds(DEFAULT_SETTINGS).size, 0);
  check('settings from before this existed hide nobody', hiddenIds(withDefaults({ music: false }, DEFAULT_SETTINGS)).size, 0);
  const one = withHidden([], { id: 'u1', name: 'Rude' });
  ok('hiding a player remembers them', hiddenIds({ hiddenPlayers: one }).has('u1'));
  ok('hiding the same player twice changes nothing', withHidden(one, { id: 'u1', name: 'Rude' }) === one);
  ok('a player with no id cannot be hidden', withHidden(one, { name: 'Ghost' }) === one);
  check('damaged storage hides nobody rather than crashing', hiddenIds({ hiddenPlayers: 'oops' }).size, 0);
}
