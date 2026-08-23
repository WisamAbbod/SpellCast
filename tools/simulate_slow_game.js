'use strict';
/**
 * Plays a whole slow-mode game in the terminal and prints the scorecard.
 *
 *   node tools/simulate_slow_game.js [seed]
 *
 * It drives the engine in the same ORDER the screen does - shuffle, then choose
 * a word, then submit - which is the point. A unit test checks each reducer;
 * this checks the sequence. It is how the bot-shuffles-then-plays-a-stale-path
 * soft-lock was found: the bot picked its word, shuffled the letters out from
 * under it, and submitted a path that no longer spelled anything, so the turn
 * never advanced.
 */
const path = require('path');
const { loadModule } = require(path.join(__dirname, '..', 'tests', 'load.js'));

const src = (relative) => loadModule(path.join(__dirname, '..', relative));

const game = src('src/game/slow/game.js');
const bot = src('src/game/slow/bot.js');
const rules = src('src/game/slow/rules.js');

const seed = process.argv[2] || `sim-${Date.now()}`;

let state = game.createSlowGame({
  seed,
  players: [
    { name: 'You', isBot: false },
    { name: 'Nova', isBot: true, level: 'hard' },
    { name: 'Orion', isBot: true, level: 'medium' },
    { name: 'Vega', isBot: true, level: 'easy' },
  ],
  timerEnabled: true,
});

console.log(`seed ${seed} · ${state.players.length} players · ${state.rounds} rounds\n`);

const pad = (value, width) => String(value).padEnd(width);
let guard = 0;

while (state.status === 'playing' && guard++ < game.totalTurns(state) + 5) {
  const round = game.currentRound(state);
  const actor = game.currentPlayer(state);
  const prefix = `R${round} ${pad(actor.name, 6)}`;

  // Everyone opens the same way the screen does: decide, act, then choose.
  const plan = actor.isBot
    ? bot.planBotTurn(state)
    : { shuffle: actor.gems >= rules.ABILITIES.shuffle.cost * 2 };

  if (plan.shuffle) {
    const shuffled = game.applyAbility(state, 'shuffle');
    if (shuffled.ok) {
      state = shuffled.state;
      console.log(`${prefix} shuffled the board`);
    }
  }

  const move = actor.isBot
    ? bot.chooseBotWord(state)
    : bot.rankBotOptions(state.board, state.usedWords, 3)[0];

  if (!move) {
    state = game.passTurn(state, 'nothing to play').state;
    console.log(`${prefix} passed`);
    continue;
  }

  const played = game.submitWord(state, move.indices);
  if (!played.ok) {
    console.log(`${prefix} REJECTED: ${played.reason}`);
    state = game.passTurn(state, 'rejected').state;
    continue;
  }

  const { event } = played;
  const extras = [
    event.scored.doubleWord ? '2x' : null,
    event.scored.longWord ? `+${event.scored.longBonus}` : null,
    event.gemsFound ? `${event.gemsFound} gem` : null,
  ].filter(Boolean);

  console.log(
    `${prefix} ${pad(event.word, 10)} ${String(event.scored.score).padStart(3)}` +
      (extras.length ? `  (${extras.join(', ')})` : ''),
  );
  state = played.state;
}

console.log(`\n${state.status} after ${state.turnIndex} of ${game.totalTurns(state)} turns\n`);

game.standings(state).forEach((entry) => {
  console.log(
    `  ${entry.rank}. ${pad(entry.name, 7)} ${String(entry.total).padStart(4)}` +
      `   ${entry.score} banked + ${entry.gemPoints} from gems` +
      `   best ${entry.best ? `${entry.best.word} (${entry.best.score})` : '-'}`,
  );
});

const winner = game.winnerOf(state);
console.log(`\n${winner.tied ? `tied on ${winner.total}` : `${winner.name} wins with ${winner.total}`}`);
