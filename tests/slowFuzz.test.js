'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const rules = loadSrc('src/game/slow/rules.js');
const boardApi = loadSrc('src/game/slow/board.js');
const game = loadSrc('src/game/slow/game.js');
const bot = loadSrc('src/game/slow/bot.js');
const { isValidWord } = loadSrc('src/game/dictionary.js');
const { mulberry32 } = loadSrc('src/game/rng.js');

/**
 * Plays a lot of complete games and checks the invariants that must hold no
 * matter what anyone does.
 *
 * The unit tests check that each piece behaves; this checks that five rounds of
 * six players spending gems on abilities cannot wander into a state the screen
 * would have to render. It is the cheapest possible stand-in for a hundred
 * people playing it.
 */

suite('slow / a hundred complete games');

const GAMES = 100;
const LEVELS = ['easy', 'medium', 'hard'];

const problems = [];
const note = (game_, message) => {
  if (problems.length < 8) problems.push(`seed ${game_.seed}: ${message}`);
};

let totalTurns = 0;
let totalWords = 0;
let totalPasses = 0;
let abilitiesUsed = 0;
let gemsWasted = 0;
let worstBoard = Infinity;
let highScore = 0;
let scoreTotal = 0;
let playerTotals = 0;

for (let g = 0; g < GAMES; g++) {
  const rng = mulberry32(1000 + g);
  const count = rules.MIN_PLAYERS + Math.floor(rng() * (rules.MAX_PLAYERS - rules.MIN_PLAYERS + 1));

  const players = Array.from({ length: count }, (_, i) => ({
    name: `P${i}`,
    isBot: true,
    level: LEVELS[Math.floor(rng() * LEVELS.length)],
  }));

  let state = game.createSlowGame({
    seed: `fuzz-${g}`,
    players,
    timerEnabled: rng() < 0.5,
  });

  const expectedTurns = game.totalTurns(state);
  let guard = 0;

  while (state.status === 'playing' && guard++ < expectedTurns + 5) {
    const before = state.turnIndex;
    const actor = game.currentPlayer(state);

    // Spend gems the moment they can be spent, so abilities are exercised hard.
    if (rng() < 0.45) {
      const key = ['shuffle', 'swap', 'hint', 'extend'][Math.floor(rng() * 4)];
      const payload =
        key === 'swap'
          ? { index: Math.floor(rng() * 25), letter: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(rng() * 26)] }
          : {};
      const used = game.applyAbility(state, key, payload);
      if (used.ok) {
        abilitiesUsed++;
        if (used.state.turnIndex !== before) note(state, `${key} advanced the turn`);
        if (used.state.players[state.turnIndex % count].gems < 0) note(state, `${key} went negative`);
        state = used.state;
      }
    }

    const words = boardApi.analyseSlowBoard(state.board.letters).count;
    if (words < worstBoard) worstBoard = words;
    if (words === 0) note(state, 'board had no words at all');

    const plan = bot.planBotTurn(state);
    if (plan.shuffle) {
      const shuffled = game.applyAbility(state, 'shuffle');
      if (shuffled.ok) {
        state = shuffled.state;
        abilitiesUsed++;
      }
    }

    const move = bot.chooseBotWord(state);
    if (move) {
      const played = game.submitWord(state, move.indices);
      if (!played.ok) {
        note(state, `bot played an illegal word: ${played.reason}`);
        state = game.passTurn(state, 'rejected').state;
        totalPasses++;
      } else {
        if (!isValidWord(played.event.word)) note(state, `scored a non-word: ${played.event.word}`);
        if (played.event.scored.score <= 0) note(state, `scored ${played.event.scored.score}`);
        gemsWasted += played.event.gemsWasted;
        state = played.state;
        totalWords++;
      }
    } else {
      state = game.passTurn(state, 'nothing').state;
      totalPasses++;
    }

    if (state.turnIndex !== before + 1) note(state, 'a turn did not advance by exactly one');
    if (actor.gems > rules.MAX_GEMS) note(state, 'gems went over the cap');
    totalTurns++;
  }

  if (state.status !== 'finished') note(state, `did not finish (${state.turnIndex}/${expectedTurns})`);
  if (state.turnIndex !== expectedTurns) note(state, `ended on turn ${state.turnIndex}`);

  const table = game.standings(state);
  if (table.length !== count) note(state, 'standings lost a player');
  if (table.some((entry, i) => i > 0 && table[i - 1].total < entry.total)) {
    note(state, 'standings are out of order');
  }
  if (table.some((entry) => entry.total !== entry.score + entry.gems)) {
    note(state, 'total is not score plus gems');
  }
  if (new Set(state.usedWords).size !== state.usedWords.length) note(state, 'a word was played twice');

  state.players.forEach((entry) => {
    if (entry.gems < 0 || entry.gems > rules.MAX_GEMS) note(state, `${entry.name} holds ${entry.gems} gems`);
    if (entry.score < 0) note(state, `${entry.name} scored ${entry.score}`);
    if (entry.words.length + entry.passes !== state.rounds) {
      note(state, `${entry.name} took ${entry.words.length + entry.passes} turns`);
    }
    playerTotals++;
    scoreTotal += entry.score;
    if (entry.score > highScore) highScore = entry.score;
  });
}

ok(
  `${GAMES} games completed without breaking an invariant`,
  problems.length === 0,
  problems.map((entry) => `        - ${entry}`).join('\n'),
);
check('every game ran its turns', totalTurns > 0, true);
ok(`${totalWords} words played, ${totalPasses} passes`, totalPasses / totalTurns < 0.1);
ok(`${abilitiesUsed} abilities were used`, abilitiesUsed > 50);
ok(`the thinnest board still held ${worstBoard} words`, worstBoard >= 20);
ok(
  `average player score ${(scoreTotal / playerTotals).toFixed(0)}, best ${highScore}`,
  scoreTotal / playerTotals > 20 && highScore < 5000,
);
ok(`${gemsWasted} gems were wasted against the cap`, gemsWasted >= 0);
