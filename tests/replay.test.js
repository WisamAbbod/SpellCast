'use strict';
/**
 * Replay determinism.
 *
 * Online slow mode syncs moves, not state, and every device rebuilds the board
 * by replaying them. If replaying a log ever produced a different board from
 * playing those moves live, two players would be looking at different letters
 * and neither would know. That is the property this file exists to hold down.
 */
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const {
  applyAbility, createSlowGame, currentPlayerIndex, passTurn, standings, submitWord,
} = loadSrc('src/game/slow/game.js');
const { analyseSlowBoard } = loadSrc('src/game/slow/board.js');
const {
  applyMove, isMoveType, nextSeq, replaySlowGame, sortMoves,
} = loadSrc('src/game/slow/replay.js');

suite('replay');

const CONFIG = {
  seed: 'spacewrite:test:online:1',
  rounds: 3,
  timerEnabled: false,
  players: [
    { id: 'a', name: 'Ada', isBot: false },
    { id: 'b', name: 'Bell', isBot: false },
    { id: 'c', name: 'Cray', isBot: false },
  ],
};

/**
 * Plays a game the way a device does - looking at the live board each turn and
 * picking a real word from it - while recording exactly what the wire would
 * have carried.
 */
const playLive = () => {
  let state = createSlowGame(CONFIG);
  const log = [];
  let seq = 0;
  let guard = 0;

  while (state.status === 'playing' && guard++ < 200) {
    const analysis = analyseSlowBoard(state.board.letters);
    const player = state.players[currentPlayerIndex(state)];

    // Spend gems when there are enough, so abilities are in the log too.
    if (player.gems >= 1 && seq % 5 === 4) {
      const spent = applyAbility(state, 'shuffle');
      if (spent.ok) {
        state = spent.state;
        log.push({ seq: seq++, type: 'shuffle', payload: {} });
        continue;
      }
    }

    const options = analysis.ranked.filter((entry) => !state.usedWords.includes(entry.word));
    if (options.length === 0) {
      const passed = passTurn(state);
      state = passed.state;
      log.push({ seq: seq++, type: 'pass', payload: { reason: 'passed' } });
      continue;
    }

    // Vary who plays well, so scores differ and the standings have an order.
    const pick = options[Math.min(options.length - 1, seq % 7)];
    const indices = analysis.words.get(pick.word);
    const played = submitWord(state, indices);

    if (!played.ok) {
      const passed = passTurn(state);
      state = passed.state;
      log.push({ seq: seq++, type: 'pass', payload: { reason: 'passed' } });
      continue;
    }

    state = played.state;
    log.push({ seq: seq++, type: 'word', payload: { indices } });
  }

  return { state, log };
};

const live = playLive();

ok(`the live game finished after ${live.log.length} moves`, live.state.status === 'finished');
ok('...and somebody actually scored', standings(live.state)[0].total > 0);

const replayed = replaySlowGame(CONFIG, live.log);

check('every logged move replays cleanly', replayed.rejected.length, 0);
check('...all of them', replayed.applied, live.log.length);
check('the replayed game is also finished', replayed.state.status, 'finished');

/* The board is the thing that would silently diverge, so check it letter by
   letter rather than trusting the scores to imply it. */
check('the board letters are identical',
  replayed.state.board.letters.join(''), live.state.board.letters.join(''));
check('...and so are the bonus tiles',
  JSON.stringify(replayed.state.board.modifiers), JSON.stringify(live.state.board.modifiers));
check('...and the gems', JSON.stringify(replayed.state.board.gems),
  JSON.stringify(live.state.board.gems));
check('...and the board version', replayed.state.board.version, live.state.board.version);

check('the scores match', JSON.stringify(standings(replayed.state).map((e) => e.total)),
  JSON.stringify(standings(live.state).map((e) => e.total)));
check('the words played match', replayed.state.usedWords.join(','),
  live.state.usedWords.join(','));
check('every player holds the same gems',
  JSON.stringify(replayed.state.players.map((p) => p.gems)),
  JSON.stringify(live.state.players.map((p) => p.gems)));

/* Replaying twice must also agree - a memo keyed on the board letters is the
   obvious way this could go wrong. */
const again = replaySlowGame(CONFIG, live.log);
check('replaying a second time gives the same board',
  again.state.board.letters.join(''), replayed.state.board.letters.join(''));

/* Out-of-order arrival is the normal case over a realtime socket. */
const shuffledLog = [...live.log].reverse();
const fromShuffled = replaySlowGame(CONFIG, shuffledLog);
check('a log that arrives backwards still replays correctly',
  fromShuffled.state.board.letters.join(''), live.state.board.letters.join(''));
check('...with nothing rejected', fromShuffled.rejected.length, 0);

check('sortMoves orders by seq', sortMoves([{ seq: 2 }, { seq: 0 }, { seq: 1 }])
  .map((m) => m.seq).join(','), '0,1,2');

/* Untrusted input: these arrive from another device and must never throw. */
const fresh = createSlowGame(CONFIG);
ok('an unknown move type is refused', !applyMove(fresh, { type: 'launch-missiles' }).ok);
ok('a null move is refused', !applyMove(fresh, null).ok);
ok('a word move with no path is refused', !applyMove(fresh, { type: 'word', payload: {} }).ok);
ok('a word move with a nonsense path is refused',
  !applyMove(fresh, { type: 'word', payload: { indices: [99, 100] } }).ok);
ok('a swap with no letter is refused',
  !applyMove(fresh, { type: 'swap', payload: { index: 3 } }).ok);
ok('an ability nobody can afford is refused', !applyMove(fresh, { type: 'hint' }).ok);
ok('isMoveType accepts the real ones', MOVE_TYPES_OK());

function MOVE_TYPES_OK() {
  return ['word', 'pass', 'shuffle', 'swap', 'hint', 'extend'].every(isMoveType)
    && !isMoveType('nope');
}

/* A rejected move must not stop the ones after it - one bad row from one client
   cannot be allowed to freeze everybody else's game. */
const withJunk = [
  { seq: 0, type: 'nonsense', payload: {} },
  ...live.log.map((move) => ({ ...move, seq: move.seq + 1 })),
];
const survived = replaySlowGame(CONFIG, withJunk);
check('one junk move is skipped, not fatal', survived.rejected.length, 1);
check('...and the rest still replay', survived.state.board.letters.join(''),
  live.state.board.letters.join(''));

check('nextSeq follows the highest seq', nextSeq([{ seq: 0 }, { seq: 4 }, { seq: 2 }]), 5);
check('nextSeq on an empty log is zero', nextSeq([]), 0);
check('nextSeq on nothing at all is zero', nextSeq(undefined), 0);
