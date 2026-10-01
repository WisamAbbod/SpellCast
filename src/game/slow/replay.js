import { applyAbility, createSlowGame, passTurn, submitWord } from './game.js';

/**
 * Rebuilding a slow game from its move log.
 *
 * Online slow mode does not synchronise game state. It synchronises the moves,
 * and every device rebuilds the state by replaying them through the same pure
 * reducers the local game already uses. That works because of two properties
 * this engine happens to have:
 *
 *   - `src/game/slow/` contains no Math.random() and no Date.now(). Every
 *     random thing - the opening board, the refill, the bonus tiles, the gem
 *     respawn, a shuffle - is seeded from the game seed and the turn index.
 *   - a board is `{ letters, modifiers, gems, version }`: plain arrays. The
 *     solver's output is never stored on it, only memoised beside it.
 *
 * So the state is a pure function of (config, moves), and the wire format is a
 * handful of small rows rather than a whole board per turn. Reconnecting is
 * just replaying from the start, and two clients cannot drift.
 *
 * Zero imports beyond the engine, so a whole online game replays under node.
 */

/** Everything a client may put on the wire. Anything else is rejected. */
export const MOVE_TYPES = ['word', 'pass', 'shuffle', 'swap', 'hint', 'extend'];

export const isMoveType = (type) => MOVE_TYPES.includes(type);

/**
 * Applies one logged move.
 *
 * Same contract as the reducers it wraps: never throws, and an illegal move
 * comes back as { ok: false, reason }. That matters more here than locally - a
 * move arriving from another device is untrusted input, and a malformed one
 * must be skippable rather than fatal.
 */
export const applyMove = (state, move) => {
  if (!move || !isMoveType(move.type)) {
    return { ok: false, reason: 'Unknown move' };
  }

  const payload = move.payload || {};

  if (move.type === 'word') {
    const indices = Array.isArray(payload.indices) ? payload.indices : null;
    if (!indices) return { ok: false, reason: 'A word move needs a path' };
    return submitWord(state, indices);
  }

  if (move.type === 'pass') {
    return passTurn(state, payload.reason || 'passed');
  }

  return applyAbility(state, move.type, payload);
};

/** Moves in the order they were played. Ties on seq keep the earlier row. */
export const sortMoves = (moves) =>
  [...(moves || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));

/**
 * Replays a whole game.
 *
 * Rejected moves are reported rather than thrown away silently: if a client
 * ever writes a move the engine will not accept, every other device would
 * quietly diverge, and the count is the only way anyone would notice.
 *
 * @returns { state, applied, rejected: [{ seq, reason }] }
 */
export const replaySlowGame = (config, moves) => {
  let state = createSlowGame(config);
  const rejected = [];
  let applied = 0;

  sortMoves(moves).forEach((move) => {
    const result = applyMove(state, move);
    if (result.ok) {
      state = result.state;
      applied += 1;
    } else {
      rejected.push({ seq: move.seq, type: move.type, reason: result.reason });
    }
  });

  return { state, applied, rejected };
};

/**
 * The next sequence number to claim.
 *
 * The move table has `unique (room_id, seq)`, so two players racing for the
 * same turn both compute the same number and exactly one insert survives. The
 * loser re-reads and finds the turn already taken, which is the whole of the
 * conflict resolution.
 */
export const nextSeq = (moves) =>
  (moves || []).reduce((highest, move) => Math.max(highest, move.seq || 0), -1) + 1;
