import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { nextSeq, replaySlowGame } from '../game/slow/replay.js';
import { subscribeToRoom } from './channel.js';
import { fetchMoves, submitMove } from './moves.js';
import { fetchRoom, isMySeat, rosterToPlayers } from './rooms.js';
import { getSettings } from '../storage/settings.js';
import { hiddenIds } from '../storage/schema.js';

/**
 * A live slow game, driven by the move log.
 *
 * The whole of the networking is: keep a set of moves, replay them into a game
 * state, and append to it when it is your turn. There is no state
 * reconciliation, no diffing and no authoritative server, because replay is
 * deterministic - two devices holding the same moves cannot be looking at
 * different boards.
 *
 * Moves are applied optimistically so a word lands the instant you lift your
 * finger. If the row is rejected because somebody else claimed that sequence
 * number, the optimistic move is dropped and the truth is re-read - which is
 * the only moment a player might see something jump.
 */
export const useOnlineSlowGame = ({ room: initialRoom, uid }) => {
  const [room, setRoom] = useState(initialRoom);
  const [moves, setMoves] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [present, setPresent] = useState([]);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(0);

  // Callable with no room at all, so the game screen can call it
  // unconditionally and still run a local pass-and-play game. Every effect
  // below no-ops on a null id; the hook order never changes.
  const roomId = initialRoom ? initialRoom.id : null;
  const enabled = !!roomId;
  /*
   * The move log's source of truth is this ref, updated the INSTANT a move is
   * added - state only mirrors it for rendering. It used to be copied from
   * state on each render, so two moves in quick succession (a bot shuffling and
   * then playing its word) both read the same stale log, claimed the same seq,
   * and the second was rejected as a duplicate and lost.
   */
  const movesRef = useRef([]);
  const setLog = useCallback((next) => {
    movesRef.current = next;
    setMoves(next);
  }, []);

  /** Insert-or-replace by seq. Realtime can deliver a move twice. */
  const absorb = useCallback((incoming) => {
    if (!incoming) return;
    const bySeq = new Map(movesRef.current.map((move) => [move.seq, move]));
    (Array.isArray(incoming) ? incoming : [incoming]).forEach((move) => {
      // A confirmed row always wins over an optimistic one at the same seq.
      const existing = bySeq.get(move.seq);
      if (!existing || existing.pending) bySeq.set(move.seq, move);
    });
    setLog([...bySeq.values()].sort((a, b) => a.seq - b.seq));
  }, [setLog]);

  // Moves are sent strictly one after another, through this chain.
  const queueRef = useRef(Promise.resolve());

  const resync = useCallback(async () => {
    if (!roomId) return true;
    const [movesResult, roomResult] = await Promise.all([
      fetchMoves({ roomId }),
      fetchRoom({ roomId }),
    ]);
    if (movesResult.ok) {
      // Replace outright rather than merge: this is the recovery path, and a
      // stale optimistic move is exactly what it exists to clear.
      setLog(movesResult.moves);
    }
    if (roomResult.ok) setRoom(roomResult.room);
    return movesResult.ok;
  }, [roomId, setLog]);

  useEffect(() => {
    if (!roomId) return undefined;

    let alive = true;
    resync().then((ok) => {
      if (alive && !ok) setError('Could not load the game');
    });

    const unsubscribe = subscribeToRoom({
      roomId,
      onMove: (move) => alive && absorb(move),
      onRoom: (next) => alive && setRoom(next),
      onPresence: (uids) => alive && setPresent(uids),
      onStatus: (status) => alive && setConnection(status),
    });

    // Coming back from the background can mean missed realtime events, and the
    // socket may have been dropped entirely. Re-read rather than hope.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') resync();
    });

    return () => {
      alive = false;
      unsubscribe();
      appState.remove();
    };
  }, [roomId, absorb, resync]);

  // Names only: who is hidden changes what is shown, never who sits where.
  const players = useMemo(() => rosterToPlayers(room && room.roster, hiddenIds(getSettings())), [room]);

  const config = useMemo(
    () =>
      room
        ? { seed: room.seed, players, rounds: room.rounds, timerEnabled: room.timerEnabled }
        : null,
    [room, players],
  );

  // Replay is a pure function of these two, so useMemo is not an optimisation
  // here - it is what stops every unrelated render rebuilding the board.
  const replayed = useMemo(
    () => (config ? replaySlowGame(config, moves) : { state: null, applied: 0, rejected: [] }),
    [config, moves],
  );
  const game = replayed.state;

  const myTurn = useMemo(
    () =>
      !!game && game.status === 'playing' && isMySeat(room.roster, uid, game.turnIndex),
    [game, room, uid],
  );

  const currentSeat =
    game && players.length ? players[game.turnIndex % players.length] : null;

  /*
   * A backstop for realtime. While it is somebody else's turn - the only time
   * this phone is waiting on the network - re-read the move log every few
   * seconds and merge it in. Realtime keeps play instant; this makes a dropped
   * event cost a moment instead of a frozen game. Merged, not replaced, so a
   * move this phone is still sending is not wiped.
   */
  const waiting = !!game && game.status === 'playing' && !myTurn;
  useEffect(() => {
    if (!roomId || !waiting) return undefined;
    const poll = setInterval(async () => {
      const result = await fetchMoves({ roomId });
      if (result.ok) absorb(result.moves);
    }, 3000);
    return () => clearInterval(poll);
  }, [roomId, waiting, absorb]);
  const isHost = !!room && room.hostId === uid;

  /**
   * Plays a move.
   *
   * `force` is for bot turns, which the host submits on a seat that is not its
   * own - the engine attributes the move to whoever's turn it is, not to whoever
   * sent it. Without it the turn check below refuses every bot move.
   *
   * Moves are QUEUED, never dropped. This used to refuse a move while another
   * was still being sent ("one at a time"); on a slow connection that silently
   * threw away a bot's word, and every phone then waited for a move that was
   * never coming.
   */
  const sendOne = useCallback(
    async (type, payload, force) => {
      if (!enabled || !config) return { ok: false, reason: 'Not an online game' };

      // Checked against the live log, which already holds every move this
      // phone has queued - so a move is judged against the game as it will be
      // when it lands, not as it was a render ago.
      const live = replaySlowGame(config, movesRef.current).state;
      if (!force && !isMySeat(room.roster, uid, live.turnIndex)) {
        return { ok: false, reason: 'Not your turn' };
      }

      setError(null);
      const seq = nextSeq(movesRef.current);
      absorb({ seq, type, payload, playerId: uid, pending: true });

      const result = await submitMove({ roomId, seq, type, payload });
      if (!result.ok) {
        // Somebody claimed this seq first, or the server refused it. Drop the
        // optimistic copy and re-read the truth.
        setLog(movesRef.current.filter((move) => !(move.seq === seq && move.pending)));
        await resync();
        if (!result.taken) setError(result.reason);
      }
      return result;
    },
    [enabled, config, room, uid, roomId, absorb, resync, setLog],
  );

  const play = useCallback(
    (type, payload = {}, { force = false } = {}) => {
      setSending((count) => count + 1);
      const run = queueRef.current.then(() => sendOne(type, payload, force));
      // The chain never breaks: a failed move must not stall the ones behind it.
      queueRef.current = run.catch(() => undefined);
      return run
        .catch(() => ({ ok: false, reason: 'No connection' }))
        .finally(() => setSending((count) => count - 1));
    },
    [sendOne],
  );

  return {
    enabled,
    room,
    game,
    players,
    myTurn,
    isHost,
    currentSeat,
    connection,
    present,
    busy: sending > 0,
    error,
    rejected: replayed.rejected,
    moveCount: moves.length,
    play,
    resync,
    clearError: () => setError(null),
  };
};

export default useOnlineSlowGame;
