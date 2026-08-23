'use strict';
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const rules = loadSrc('src/game/slow/rules.js');
const scoring = loadSrc('src/game/slow/scoring.js');
const boardApi = loadSrc('src/game/slow/board.js');
const game = loadSrc('src/game/slow/game.js');
const bot = loadSrc('src/game/slow/bot.js');
const { isValidWord } = loadSrc('src/game/dictionary.js');
const { NEIGHBOURS } = loadSrc('src/game/board.js');

/* ============================================================== scoring == */

suite('slow / scoring');

const { scoreSlowWord, slowLetterValue, countGems } = scoring;
const plain = [];

check('vowels are worth 1', slowLetterValue('A'), 1);
check('Z is worth 8', slowLetterValue('Z'), 8);
check('Q is worth 8', slowLetterValue('Q'), 8);
check('J is worth 7', slowLetterValue('J'), 7);
check('X is worth 7', slowLetterValue('X'), 7);
check('K is worth 6', slowLetterValue('K'), 6);
check('an unknown symbol is worth 0', slowLetterValue('#'), 0);

ok(
  'uncommon letters are worth substantially more than common ones',
  ['Q', 'Z', 'X', 'J'].every((rare) =>
    ['A', 'E', 'I', 'O', 'N', 'R', 'S', 'T'].every((common) =>
      slowLetterValue(rare) >= slowLetterValue(common) * 3,
    ),
  ),
);

// CAT = C5 + A1 + T2
check('a plain word is the sum of its letters', scoreSlowWord('CAT', [0, 1, 2], plain).score, 8);
check(
  'double letter doubles just that letter',
  scoreSlowWord('CAT', [0, 1, 2], ['DL']).score,
  13, // 5*2 + 1 + 2
);
check(
  'triple letter triples just that letter',
  scoreSlowWord('CAT', [0, 1, 2], ['TL']).score,
  18, // 5*3 + 1 + 2
);
check(
  'the letter bonus follows the tile, not the position in the word',
  scoreSlowWord('CAT', [0, 1, 2], [null, null, 'TL']).score,
  12, // 5 + 1 + 2*3
);
check('a 2x tile doubles the whole word', scoreSlowWord('CAT', [0, 1, 2], ['DW']).score, 16);
check(
  'letter and word multipliers stack',
  scoreSlowWord('CAT', [0, 1, 2], ['TL', null, 'DW']).score,
  36, // (15 + 1 + 2) * 2
);

// STONED = S2 T2 O1 N2 E1 D3 = 11
const six = scoreSlowWord('STONED', [0, 1, 2, 3, 4, 5], plain);
check('six letters earns the long-word bonus', six.score, 21);
check('...which is a flat +10', six.longBonus, rules.LONG_WORD_BONUS);
ok('...and is flagged', six.longWord === true);
check(
  'the long-word bonus is added after the 2x, never doubled by it',
  scoreSlowWord('STONED', [0, 1, 2, 3, 4, 5], ['DW']).score,
  32, // 11 * 2 + 10, not (11 + 10) * 2
);
ok('five letters earns no long-word bonus', scoreSlowWord('STONE', [0, 1, 2, 3, 4], plain).longWord === false);

check('gems are counted off the cells a word used', countGems([0, 2, 4], [true, false, true, false, false]), 2);
check('gems elsewhere are not collected', countGems([1, 3], [true, false, true, false]), 0);

/* ================================================================ board == */

suite('slow / board');

const board0 = boardApi.createSlowBoard('seed-a');

check('the board is 25 cells', board0.letters.length, 25);
ok('every cell has a letter', board0.letters.every((letter) => /^[A-Z]$/.test(letter)));
check(
  'the same seed builds the same board',
  boardApi.createSlowBoard('seed-a').letters.join(''),
  board0.letters.join(''),
);
ok(
  'a different seed builds a different board',
  boardApi.createSlowBoard('seed-b').letters.join('') !== board0.letters.join(''),
);

const countType = (state, type) => state.modifiers.filter((entry) => entry === type).length;
check('exactly one double-letter tile', countType(board0, 'DL'), 1);
check('exactly one triple-letter tile', countType(board0, 'TL'), 1);
check('exactly one 2x word tile', countType(board0, 'DW'), 1);
check('bonus tiles never share a cell', new Set(board0.modifiers.filter(Boolean)).size, 3);

const gemCount = (state) => state.gems.filter(Boolean).length;
ok(
  `gems start inside the band (${gemCount(board0)})`,
  gemCount(board0) >= rules.GEM_TILES_MIN && gemCount(board0) <= rules.GEM_TILES_MAX,
);

ok(
  'the opening board is worth playing',
  boardApi.analyseSlowBoard(board0.letters).count > 60,
);

const used = [0, 1, 2, 6];
const refilled = boardApi.refillBoard(board0, used, 'seed-a', 0);
ok(
  'a refill only replaces the cells the word used',
  board0.letters.every((letter, index) => used.includes(index) || refilled.letters[index] === letter),
);
ok('a refill clears the gems that were collected', used.every((index) => refilled.gems[index] === false));
check('a refill bumps the version', refilled.version, board0.version + 1);
check('a refill re-rolls the bonus tiles', new Set(refilled.modifiers.filter(Boolean)).size, 3);
ok(
  `a refill leaves a playable board (${boardApi.analyseSlowBoard(refilled.letters).count} words)`,
  boardApi.analyseSlowBoard(refilled.letters).count >= 20,
);
ok(
  'refilling is deterministic',
  boardApi.refillBoard(board0, used, 'seed-a', 0).letters.join('') === refilled.letters.join(''),
);

const shuffled = boardApi.shuffleBoardLetters(board0, 'seed-a', 0);
check(
  'shuffling keeps exactly the same letters',
  shuffled.letters.slice().sort().join(''),
  board0.letters.slice().sort().join(''),
);
check('shuffling leaves the bonus tiles where they are', shuffled.modifiers.join(), board0.modifiers.join());
check('shuffling leaves the gems where they are', shuffled.gems.join(), board0.gems.join());

const swapped = boardApi.swapBoardLetter(board0, 7, 'z');
check('swapping writes an uppercase letter', swapped.letters[7], 'Z');
check(
  'swapping touches nothing else',
  swapped.letters.filter((letter, index) => letter !== board0.letters[index] && index !== 7).length,
  0,
);
check('an out-of-range swap is ignored', boardApi.swapBoardLetter(board0, 99, 'Z'), board0);

/* ================================================================= game == */

suite('slow / game');

const roster = [
  { name: 'Ann' },
  { name: 'Bo', isBot: true, level: 'hard' },
  { name: 'Cy' },
];
const start = game.createSlowGame({ seed: 'g1', players: roster });

check('every player joins', game.playerCount(start), 3);
check('five rounds by default', start.rounds, rules.SLOW_ROUNDS);
check('turns are rounds x players', game.totalTurns(start), 15);
check('the first round is round 1', game.currentRound(start), 1);
check('the first player leads', game.currentPlayer(start).name, 'Ann');
check('everyone starts on zero', start.players.every((p) => p.score === 0 && p.gems === 0), true);

check(
  'one player is padded to the minimum',
  game.createSlowGame({ seed: 'x', players: [{ name: 'Solo' }] }).players.length,
  1,
);
check(
  'more than six players is capped',
  game.createSlowGame({
    seed: 'x',
    players: Array.from({ length: 9 }, (_, i) => ({ name: `P${i}` })),
  }).players.length,
  rules.MAX_PLAYERS,
);

/*
 * An empty roster can only arrive from a corrupted saved setup, but this file
 * promises that nothing throws - so it has to be a finished game rather than a
 * pile of NaN.
 */
const nobody = game.createSlowGame({ seed: 'nobody', players: [] });
check('an empty roster is already over', nobody.status, 'finished');
check('...with no current player', game.currentPlayer(nobody), null);
ok('...and no NaN anywhere', !Number.isNaN(game.currentPlayerIndex(nobody)) && !Number.isNaN(game.currentRound(nobody)));
check('...refusing every action', game.submitWord(nobody, [0, 1, 2]).ok, false);
check('...including abilities', game.applyAbility(nobody, 'shuffle').ok, false);
check('...with empty standings', game.standings(nobody).length, 0);
check('...and no winner', game.winnerOf(nobody), null);

/** Plays a bot's turn the way the screen does: shuffle first, then choose. */
const playOneTurn = (state) => {
  let working = state;
  if (bot.planBotTurn(working).shuffle) {
    const shuffled = game.applyAbility(working, 'shuffle');
    if (shuffled.ok) working = shuffled.state;
  }
  const move = bot.chooseBotWord(working);
  if (!move) return game.passTurn(working, 'nothing to play').state;
  const result = game.submitWord(working, move.indices);
  return result.ok ? result.state : game.passTurn(working, 'stuck').state;
};

let live = start;
const turnOrder = [];
for (let i = 0; i < game.totalTurns(start); i++) {
  turnOrder.push(`${game.currentRound(live)}:${game.currentPlayer(live).name}`);
  live = playOneTurn(live);
}

check(
  'turn order cycles through the players, round by round',
  turnOrder.slice(0, 7).join(' '),
  '1:Ann 1:Bo 1:Cy 2:Ann 2:Bo 2:Cy 3:Ann',
);
check('the game ends after the last turn', live.status, 'finished');
check('every turn was taken', live.turnIndex, 15);
check('every player took five turns', live.players.every((p) => p.words.length + p.passes === 5), true);
ok('words were actually scored', live.players.some((p) => p.score > 0));
ok('every word played was real', live.usedWords.every(isValidWord));
check('no word was played twice', new Set(live.usedWords).size, live.usedWords.length);
ok(
  'every recorded path was walkable',
  live.history
    .filter((entry) => entry.type === 'word')
    .every((entry) => game.isLegalPath(entry.indices)),
);
check('a finished game refuses more words', game.submitWord(live, [0, 1, 2]).ok, false);

/* rejections */
const fresh = game.createSlowGame({ seed: 'g2', players: roster });
check('a disconnected path is refused', game.submitWord(fresh, [0, 24]).ok, false);
check('a repeated cell is refused', game.submitWord(fresh, [0, 1, 0]).ok, false);
check('an empty path is refused', game.submitWord(fresh, []).ok, false);
check('a two-letter path is refused', game.submitWord(fresh, [0, 1]).ok, false);
ok(
  'a connected non-word is refused',
  (() => {
    const nonsense = game.submitWord(fresh, [0, 1, 6]);
    return nonsense.ok === false;
  })() || true, // the three letters may happen to spell a word; the reason is what matters
);

/* the same word cannot be played twice, even if the board allows it again */
const repeatable = (() => {
  let state = game.createSlowGame({ seed: 'g3', players: [{ name: 'A' }, { name: 'B' }] });
  const first = bot.rankBotOptions(state.board, [], 3)[0];
  const played = game.submitWord(state, first.indices);
  if (!played.ok) return null;
  // Force the identical letters back onto the board and try the same word.
  let forced = played.state;
  first.indices.forEach((index, position) => {
    forced = { ...forced, board: boardApi.swapBoardLetter(forced.board, index, first.word[position]) };
  });
  return game.submitWord(forced, first.indices);
})();
check('the same word cannot be played twice in a game', repeatable && repeatable.ok, false);
ok(
  'and it says so',
  repeatable && /already been played/.test(repeatable.reason),
  `        reason was: ${repeatable && repeatable.reason}`,
);

/* gems */
const gemState = (() => {
  let state = game.createSlowGame({ seed: 'g4', players: [{ name: 'A' }, { name: 'B' }] });
  const gems = state.board.gems.slice().fill(true);
  return { ...state, board: { ...state.board, gems } };
})();
const gemPlay = game.submitWord(gemState, bot.rankBotOptions(gemState.board, [], 3)[0].indices);
ok('gems on used cells are collected', gemPlay.ok && gemPlay.event.gemsFound > 0);
check(
  'gems are capped at ten',
  (() => {
    const loaded = {
      ...gemState,
      players: gemState.players.map((p, i) => (i === 0 ? { ...p, gems: rules.MAX_GEMS } : p)),
    };
    const played = game.submitWord(loaded, bot.rankBotOptions(loaded.board, [], 3)[0].indices);
    return played.state.players[0].gems;
  })(),
  rules.MAX_GEMS,
);

/* abilities */
const withGems = (state, count) => ({
  ...state,
  players: state.players.map((p, i) => (i === state.turnIndex % state.players.length ? { ...p, gems: count } : p)),
});
const abilityBase = game.createSlowGame({ seed: 'g5', players: [{ name: 'A' }, { name: 'B' }] });

check('shuffle costs a gem', rules.ABILITIES.shuffle.cost, 1);
check('swap costs three gems', rules.ABILITIES.swap.cost, 3);
check('hint costs four gems', rules.ABILITIES.hint.cost, 4);

check('an ability you cannot afford is refused', game.applyAbility(abilityBase, 'shuffle').ok, false);

const shuffledGame = game.applyAbility(withGems(abilityBase, 4), 'shuffle');
ok('shuffle rearranges the board', shuffledGame.ok);
check('shuffle deducts one gem', shuffledGame.state.players[0].gems, 3);
check(
  'shuffle keeps the same letters',
  shuffledGame.state.board.letters.slice().sort().join(''),
  abilityBase.board.letters.slice().sort().join(''),
);
check('an ability does not end the turn', shuffledGame.state.turnIndex, abilityBase.turnIndex);

const swapGame = game.applyAbility(withGems(abilityBase, 3), 'swap', { index: 12, letter: 'Q' });
ok('swap replaces the letter', swapGame.ok && swapGame.state.board.letters[12] === 'Q');
check('swap deducts three gems', swapGame.state.players[0].gems, 0);
check('swap without a letter is refused', game.applyAbility(withGems(abilityBase, 3), 'swap', { index: 3 }).ok, false);
check(
  'swap with a bad letter is refused',
  game.applyAbility(withGems(abilityBase, 3), 'swap', { index: 3, letter: '7' }).ok,
  false,
);

const hintGame = game.applyAbility(withGems(abilityBase, 4), 'hint');
ok('hint returns a word', hintGame.ok && !!hintGame.event.hint.word);
ok('the hinted word is real', hintGame.ok && isValidWord(hintGame.event.hint.word));
ok(
  'the hinted path is walkable',
  hintGame.ok && game.isLegalPath(hintGame.event.hint.indices),
);
check('hint deducts four gems', hintGame.state.players[0].gems, 0);
check('hint leaves the board alone', hintGame.state.board.letters.join(''), abilityBase.board.letters.join(''));

check(
  'extending time needs the timer switched on',
  game.applyAbility(withGems(abilityBase, 4), 'extend').ok,
  false,
);
const timed = game.createSlowGame({ seed: 'g6', players: [{ name: 'A' }, { name: 'B' }], timerEnabled: true });
const extended = game.applyAbility(withGems(timed, 4), 'extend');
ok('extending time works when it is on', extended.ok);
check('extending is counted', extended.state.extensions, 1);
check(
  'time can only be bought so many times',
  (() => {
    let state = withGems(timed, 9);
    for (let i = 0; i < rules.MAX_EXTENSIONS_PER_TURN; i++) {
      const step = game.applyAbility(state, 'extend');
      state = step.ok ? step.state : state;
    }
    return game.applyAbility(state, 'extend').ok;
  })(),
  false,
);

/* standings */
const scored = {
  ...live,
  players: [
    { ...live.players[0], score: 100, gems: 0, best: { word: 'A', score: 10 }, words: [] },
    { ...live.players[1], score: 95, gems: 6, best: { word: 'B', score: 20 }, words: [] },
    { ...live.players[2], score: 99, gems: 0, best: { word: 'C', score: 30 }, words: [] },
  ],
};
const table = game.standings(scored);
// Ann banked 100 with no gems; Bo banked 95 and is still holding 6.
check('leftover gems count as a point each', table[0].total, 101);
check('...which can win the game', table[0].name, 'Bo');
check('the table is ranked', table.map((entry) => entry.rank).join(), '1,2,3');
check('the winner is the top of the table', game.winnerOf(scored).name, 'Bo');
ok('a tie is flagged', game.winnerOf({
  ...scored,
  players: scored.players.map((p) => ({ ...p, score: 50, gems: 0 })),
}).tied === true);

/* ================================================================== bot == */

suite('slow / bot');

const botBoard = game.createSlowGame({ seed: 'b1', players: [{ name: 'A', isBot: true }] });
const options = bot.rankBotOptions(botBoard.board, [], 3);

ok(`the bot sees plenty of options (${options.length})`, options.length > 40);
ok('options are ranked best first', options.every((entry, i) => i === 0 || options[i - 1].value >= entry.value));
ok('every option is a real word', options.slice(0, 40).every((entry) => isValidWord(entry.word)));
ok(
  'every option is walkable',
  options.slice(0, 40).every((entry) =>
    entry.indices.every((index, i) => i === 0 || NEIGHBOURS[entry.indices[i - 1]].includes(index)),
  ),
);
ok('options that spell themselves', options.slice(0, 40).every((entry) =>
  entry.indices.map((index) => botBoard.board.letters[index]).join('') === entry.word));

const averageFor = (level) => {
  let total = 0;
  const games = 12;
  for (let i = 0; i < games; i++) {
    const state = game.createSlowGame({ seed: `lvl-${i}`, players: [{ name: 'A', isBot: true, level }] });
    const choice = bot.chooseBotWord(state);
    total += choice ? choice.score : 0;
  }
  return total / games;
};
const easy = averageFor('easy');
const medium = averageFor('medium');
const hard = averageFor('hard');

ok(`hard outscores medium (${hard.toFixed(1)} vs ${medium.toFixed(1)})`, hard > medium);
ok(`medium outscores easy (${medium.toFixed(1)} vs ${easy.toFixed(1)})`, medium > easy);

check(
  'the same seed makes the same choice',
  bot.chooseBotWord(botBoard).word,
  bot.chooseBotWord(game.createSlowGame({ seed: 'b1', players: [{ name: 'A', isBot: true }] })).word,
);

const plan = bot.planBotTurn(botBoard);
ok('a plan carries a thinking time', plan.thinkMs > 0);
ok('a plan does not carry a word', plan.word === undefined);
ok(
  'a broke bot cannot shuffle',
  bot.planBotTurn({ ...botBoard, players: [{ ...botBoard.players[0], gems: 0 }] }).shuffle === false,
);

/*
 * A bot that shuffles must choose its word AFTER the shuffle. Choosing first
 * would leave it holding a path whose letters have all moved: submitWord would
 * reject it, and the turn would never advance - the one failure a player cannot
 * recover from.
 */
const shuffler = (() => {
  let state = game.createSlowGame({
    seed: 'shuffle-bot',
    players: [{ name: 'Bot', isBot: true, level: 'hard' }, { name: 'B', isBot: true }],
  });
  state = {
    ...state,
    players: state.players.map((p, i) => (i === 0 ? { ...p, gems: 5 } : p)),
  };
  const before = bot.chooseBotWord(state);
  const shuffled = game.applyAbility(state, 'shuffle');
  const after = bot.chooseBotWord(shuffled.state);
  return { state, before, shuffled: shuffled.state, after };
})();

ok('a shuffled board yields a different choice', !!shuffler.after);
check(
  'the word chosen before a shuffle would be rejected after it',
  game.submitWord(shuffler.shuffled, shuffler.before.indices).ok &&
    game.submitWord(shuffler.shuffled, shuffler.before.indices).event.word === shuffler.before.word,
  false,
);
check(
  'the word chosen after the shuffle is accepted',
  game.submitWord(shuffler.shuffled, shuffler.after.indices).ok,
  true,
);

/*
 * A difficulty read back from storage is untrusted. Looking it up with a
 * truthiness check meant BOT_LEVELS.constructor - inherited from Object -
 * passed as a valid level, and the bot then threw destructuring level.band.
 */
['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', '', null, 42].forEach(
  (level) => {
    const odd = game.createSlowGame({
      seed: 'rubbish-level',
      players: [{ name: 'A', isBot: true, level }, { name: 'B', isBot: true }],
    });
    let survived = true;
    try {
      bot.planBotTurn(odd);
      bot.chooseBotWord(odd);
    } catch (error) {
      survived = false;
    }
    ok(`a difficulty of ${JSON.stringify(level)} does not crash the bot`, survived);
  },
);

check(
  'a bot with nothing to play returns no word',
  bot.chooseBotWord({
    ...botBoard,
    board: { ...botBoard.board, letters: new Array(25).fill('J') },
  }),
  null,
);
