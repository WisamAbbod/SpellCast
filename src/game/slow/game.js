import { NEIGHBOURS } from '../board.js';
import { MIN_WORD_LENGTH } from '../rules.js';
import { MAX_WORD_LENGTH, isValidWord } from '../dictionary.js';
import {
  ABILITIES,
  DEFAULT_BOT_LEVEL,
  MAX_EXTENSIONS_PER_TURN,
  MAX_GEMS,
  MAX_PLAYERS,
  POINTS_PER_LEFTOVER_GEM,
  SLOW_ROUNDS,
} from './rules.js';
import {
  analyseSlowBoard,
  createSlowBoard,
  refillBoard,
  shuffleBoardLetters,
  swapBoardLetter,
  wordAt,
} from './board.js';
import { countGems, scoreSlowWord } from './scoring.js';

/**
 * The turn machine.
 *
 * Every action is a pure function from state to state, so a whole game can be
 * played out in a test with no React, no timers and no device - and so the
 * screen never has to work out whose turn it is.
 *
 * Nothing here throws. An illegal move comes back as { ok: false, reason }, and
 * the caller decides whether that is a red flash or a silently ignored tap.
 */

/**
 * Caps the roster. It does NOT pad up to MIN_PLAYERS - inventing a player
 * nobody asked for would be worse than a one-player game. The setup screen is
 * what guarantees two to six.
 */
const capRoster = (players) => players.slice(0, MAX_PLAYERS);

export const createSlowGame = ({
  seed,
  players = [],
  rounds = SLOW_ROUNDS,
  timerEnabled = false,
}) => {
  const roster = capRoster(players).map((player, index) => ({
    id: player.id || `p${index}`,
    name: player.name || `Player ${index + 1}`,
    isBot: !!player.isBot,
    level: player.level || DEFAULT_BOT_LEVEL,
    score: 0,
    gems: 0,
    gemsCollected: 0,
    words: [],
    best: null,
    passes: 0,
  }));

  return {
    seed,
    rounds,
    timerEnabled,
    players: roster,
    board: createSlowBoard(seed),
    turnIndex: 0,
    extensions: 0,
    // A roster nobody is in has no turns to take, so it is over before it
    // starts. Saying 'playing' would leave every derived value dividing by
    // zero, and this file promises never to throw.
    status: roster.length > 0 ? 'playing' : 'finished',
    usedWords: [],
    history: [],
    lastEvent: null,
  };
};

/* ------------------------------------------------------------- derived -- */

export const playerCount = (state) => state.players.length;
export const totalTurns = (state) => state.rounds * playerCount(state);
export const currentPlayerIndex = (state) =>
  playerCount(state) > 0 ? state.turnIndex % playerCount(state) : 0;
export const currentPlayer = (state) => state.players[currentPlayerIndex(state)] || null;
export const currentRound = (state) =>
  playerCount(state) > 0 ? Math.floor(state.turnIndex / playerCount(state)) + 1 : 0;
export const turnsRemaining = (state) => Math.max(0, totalTurns(state) - state.turnIndex);
export const isFinished = (state) => state.status === 'finished';

/** Score as it will be counted at the end: points banked plus gems still held. */
export const finalScoreFor = (player) => player.score + player.gems * POINTS_PER_LEFTOVER_GEM;

export const standings = (state) =>
  state.players
    .map((player, index) => ({
      ...player,
      index,
      total: finalScoreFor(player),
      gemPoints: player.gems * POINTS_PER_LEFTOVER_GEM,
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        (b.best ? b.best.score : 0) - (a.best ? a.best.score : 0) ||
        b.words.length - a.words.length ||
        a.index - b.index,
    )
    .map((player, position) => ({ ...player, rank: position + 1 }));

export const winnerOf = (state) => {
  const table = standings(state);
  if (table.length === 0) return null;
  const tied = table.filter((entry) => entry.total === table[0].total);
  return { ...table[0], tied: tied.length > 1 };
};

/* ------------------------------------------------------------ internal -- */

const replacePlayer = (state, index, changes) => ({
  ...state,
  players: state.players.map((player, i) => (i === index ? { ...player, ...changes } : player)),
});

/** Advances the turn, finishing the game once every round has been played. */
const advance = (state) => {
  const turnIndex = state.turnIndex + 1;
  const status = turnIndex >= totalTurns(state) ? 'finished' : state.status;
  return { ...state, turnIndex, extensions: 0, status };
};

const fail = (reason) => ({ ok: false, reason });

/** The path must be walkable: adjacent steps, no cell used twice. */
export const isLegalPath = (indices) => {
  if (!Array.isArray(indices) || indices.length === 0) return false;
  const seen = new Set();
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    if (!Number.isInteger(index) || index < 0 || index >= NEIGHBOURS.length) return false;
    if (seen.has(index)) return false;
    seen.add(index);
    if (i > 0 && !NEIGHBOURS[indices[i - 1]].includes(index)) return false;
  }
  return true;
};

/**
 * A word worth showing as a hint: good enough to be worth four gems, not so
 * good that it hands over the best word on the board.
 */
export const findHint = (board, usedWords = []) => {
  const analysis = analyseSlowBoard(board.letters);
  const used = new Set(usedWords);

  const candidates = [];
  analysis.words.forEach((indices, word) => {
    if (used.has(word) || word.length < 4) return;
    const scored = scoreSlowWord(word, indices, board.modifiers);
    candidates.push({ word, indices, score: scored.score });
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);

  // Second best rather than best, so a hint helps without ending the puzzle.
  return candidates[Math.min(1, candidates.length - 1)];
};

/* ------------------------------------------------------------- actions -- */

/**
 * Plays a word for whoever has the turn.
 * @returns {{ok: true, state, event} | {ok: false, reason}}
 */
export const submitWord = (state, indices) => {
  if (state.status !== 'playing') return fail('The game is over');
  if (!isLegalPath(indices)) return fail('That path is not connected');

  const word = wordAt(state.board, indices);

  if (word.length < MIN_WORD_LENGTH) return fail(`${MIN_WORD_LENGTH} letters minimum`);
  if (word.length > MAX_WORD_LENGTH) return fail(`${MAX_WORD_LENGTH} letters maximum`);
  if (state.usedWords.includes(word)) return fail(`${word} has already been played`);
  if (!isValidWord(word)) return fail(`${word} is not a word`);

  const index = currentPlayerIndex(state);
  const player = state.players[index];

  const scored = scoreSlowWord(word, indices, state.board.modifiers);
  const gemsFound = countGems(indices, state.board.gems);
  const gems = Math.min(MAX_GEMS, player.gems + gemsFound);
  const gemsWasted = Math.max(0, player.gems + gemsFound - MAX_GEMS);
  const round = currentRound(state);

  const event = {
    type: 'word',
    turnIndex: state.turnIndex,
    round,
    playerId: player.id,
    playerName: player.name,
    word,
    indices,
    scored,
    gemsFound,
    gemsWasted,
  };

  let next = replacePlayer(state, index, {
    score: player.score + scored.score,
    gems,
    gemsCollected: player.gemsCollected + gemsFound,
    words: [...player.words, { word, score: scored.score, round }],
    best:
      !player.best || scored.score > player.best.score
        ? { word, score: scored.score }
        : player.best,
  });

  next = {
    ...next,
    board: refillBoard(next.board, indices, state.seed, state.turnIndex),
    usedWords: [...next.usedWords, word],
    history: [...next.history, event],
    lastEvent: event,
  };

  return { ok: true, state: advance(next), event };
};

/** Gives up the turn - the clock ran out, or there was nothing to find. */
export const passTurn = (state, reason = 'passed') => {
  if (state.status !== 'playing') return fail('The game is over');

  const index = currentPlayerIndex(state);
  const player = state.players[index];
  const event = {
    type: 'pass',
    turnIndex: state.turnIndex,
    round: currentRound(state),
    playerId: player.id,
    playerName: player.name,
    reason,
  };

  const next = replacePlayer(state, index, { passes: player.passes + 1 });

  return {
    ok: true,
    state: advance({ ...next, history: [...next.history, event], lastEvent: event }),
    event,
  };
};

/**
 * Spends gems on an ability. Abilities never end the turn.
 *
 * @param key      shuffle | swap | hint | extend
 * @param payload  swap needs { index, letter }
 */
export const applyAbility = (state, key, payload = {}) => {
  if (state.status !== 'playing') return fail('The game is over');

  const ability = ABILITIES[key];
  if (!ability) return fail('No such ability');

  const index = currentPlayerIndex(state);
  const player = state.players[index];
  if (player.gems < ability.cost) {
    const plural = ability.cost === 1 ? 'gem' : 'gems';
    return fail(`${ability.label} costs ${ability.cost} ${plural}`);
  }
  if (key === 'extend') {
    if (!state.timerEnabled) return fail('The turn timer is off');
    if (state.extensions >= MAX_EXTENSIONS_PER_TURN) return fail('No more time to buy');
  }

  let board = state.board;
  let extensions = state.extensions;
  let event = { type: key, playerId: player.id, cost: ability.cost };

  if (key === 'shuffle') {
    board = shuffleBoardLetters(board, state.seed, state.turnIndex);
  } else if (key === 'swap') {
    const target = Number(payload.index);
    const letter = String(payload.letter || '').toUpperCase();
    if (!Number.isInteger(target) || target < 0 || target >= NEIGHBOURS.length) {
      return fail('Pick a tile to swap');
    }
    if (!/^[A-Z]$/.test(letter)) return fail('Pick a letter');
    board = swapBoardLetter(board, target, letter);
    event = { ...event, index: target, letter };
  } else if (key === 'hint') {
    const hint = findHint(board, state.usedWords);
    // Nothing to reveal - do not charge for it.
    if (!hint) return fail('No word to reveal');
    event = { ...event, hint };
  } else if (key === 'extend') {
    extensions += 1;
  }

  const next = replacePlayer(state, index, { gems: player.gems - ability.cost });

  return { ok: true, state: { ...next, board, extensions, lastEvent: event }, event };
};
