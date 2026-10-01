import { GENERATOR_VERSION } from '../config.js';
import { ensureSession, getClient } from '../leaderboard/supabaseClient.js';

/**
 * Rooms: creating one, getting into one, starting it, ending it.
 *
 * Every function here RESOLVES. None rejects. Failure is a value with a reason
 * a person could read, exactly like the leaderboard contract - an unreachable
 * backend must produce a message on screen, never a red box.
 *
 * All the interesting logic lives in Postgres functions (see
 * supabase/schema.sql): seat allocation, code generation and matchmaking all
 * need a lock to be correct, and a lock is not something a client can hold.
 */

export const MAX_ROOM_PLAYERS = 6;
export const MIN_ROOM_PLAYERS = 2;

const fail = (reason) => ({ ok: false, reason });

/** Turns a Postgres exception into something worth showing somebody. */
const readableError = (error) => {
  const message = String((error && error.message) || 'Something went wrong');
  if (message.includes('no such room')) return 'No game with that code';
  if (message.includes('already started')) return 'That game has already started';
  if (message.includes('is full')) return 'That game is full';
  if (message.includes('only the host can change')) return 'Only the host can change the bots';
  if (message.includes('only the host')) return 'Only the host can start the game';
  if (message.includes('share a name')) return 'That name is already taken in this game';
  if (message.includes('at least two')) return 'You need at least two players';
  if (message.includes('not signed in')) return 'Could not sign in - check your connection';
  if (message.includes('Failed to fetch') || message.includes('Network')) return 'No connection';
  return message;
};

/** A signed-in client, or a readable reason there isn't one. */
const connect = async () => {
  const supabase = getClient();
  if (!supabase) return { ok: false, reason: 'Online play is not configured' };

  const session = await ensureSession();
  if (!session) {
    // Overwhelmingly the cause: anonymous sign-in is off in the dashboard.
    return { ok: false, reason: 'Could not sign in. Is anonymous auth enabled?' };
  }
  return { ok: true, supabase, session };
};

const call = async (fn, args) => {
  try {
    const link = await connect();
    if (!link.ok) return link;

    const { data, error } = await link.supabase.rpc(fn, args);
    if (error) return fail(readableError(error));
    if (!data) return fail('The server sent nothing back');

    // Postgres functions returning a table give an array of one.
    const room = Array.isArray(data) ? data[0] : data;
    if (!room) return fail('The server sent nothing back');

    return { ok: true, room: toRoom(room), uid: link.session.user.id };
  } catch (error) {
    return fail(readableError(error));
  }
};

/** Snake case on the wire, camel case in the app. */
export const toRoom = (row) => ({
  id: row.id,
  code: row.code,
  hostId: row.host_id,
  seed: row.seed,
  rounds: row.rounds,
  timerEnabled: row.timer_enabled,
  isPublic: row.is_public,
  status: row.status,
  roster: Array.isArray(row.roster) ? row.roster : [],
  generatorVersion: row.generator_version,
  startedAt: row.started_at ? Date.parse(row.started_at) : null,
  finishedAt: row.finished_at ? Date.parse(row.finished_at) : null,
});

/** The seating the engine needs, in the order turns are taken. */
export const rosterToPlayers = (roster) =>
  (roster || []).map((seat, index) => ({
    id: seat.id || seat.uid || `p${index}`,
    uid: seat.uid || null,
    name: seat.name || `Player ${index + 1}`,
    isBot: !!seat.isBot,
    level: seat.level || 'medium',
  }));

export const isMySeat = (roster, uid, turnIndex) => {
  const players = rosterToPlayers(roster);
  if (players.length === 0) return false;
  const seat = players[turnIndex % players.length];
  return !!seat && !seat.isBot && seat.uid === uid;
};

export const createRoom = ({ name, isPublic = false, rounds = 5, timerEnabled = true }) =>
  call('create_slow_room', {
    p_name: name,
    p_public: isPublic,
    p_rounds: rounds,
    p_timer: timerEnabled,
    p_version: GENERATOR_VERSION,
  });

export const joinRoom = ({ code, name }) => {
  const cleaned = String(code || '').trim().toUpperCase();
  if (cleaned.length < 4) return Promise.resolve(fail('That code is too short'));
  return call('join_slow_room', { p_code: cleaned, p_name: name });
};

/** Takes a seat in a waiting public room, or opens one and waits. */
export const findRoom = ({ name, rounds = 5, timerEnabled = true }) =>
  call('find_slow_room', {
    p_name: name,
    p_rounds: rounds,
    p_timer: timerEnabled,
    p_version: GENERATOR_VERSION,
  });

/**
 * Host only: replaces the lobby's bots with this line-up ({ name, level }).
 * Adding, removing and changing difficulty are all this one call, and every
 * phone in the lobby sees the result through the room's realtime update.
 */
export const setBots = ({ roomId, bots }) =>
  call('set_slow_bots', {
    p_room: roomId,
    p_bots: (bots || []).map((bot) => ({ name: bot.name, level: bot.level || 'medium' })),
  });

export const startRoom = ({ roomId, bots = [] }) =>
  call('start_slow_room', { p_room: roomId, p_bots: bots });

export const leaveRoom = async ({ roomId }) => {
  try {
    const link = await connect();
    if (!link.ok) return link;
    await link.supabase.rpc('leave_slow_room', { p_room: roomId });
    return { ok: true };
  } catch (error) {
    return fail(readableError(error));
  }
};

/** Re-reads a room. Used on reconnect, and to poll if realtime is blocked. */
export const fetchRoom = async ({ roomId }) => {
  try {
    const link = await connect();
    if (!link.ok) return link;

    const { data, error } = await link.supabase
      .from('slow_rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if (error) return fail(readableError(error));
    if (!data) return fail('That game is gone');
    return { ok: true, room: toRoom(data), uid: link.session.user.id };
  } catch (error) {
    return fail(readableError(error));
  }
};

/**
 * Writes the final standings and closes the room.
 *
 * Idempotent server-side, so every client calling it as the game ends is fine -
 * and necessary, because the one device that would otherwise be responsible
 * might be the one that just lost connection.
 */
export const finishRoom = async ({ roomId, results }) => {
  try {
    const link = await connect();
    if (!link.ok) return link;

    const { data, error } = await link.supabase.rpc('finish_slow_room', {
      p_room: roomId,
      p_results: results,
    });

    if (error) return fail(readableError(error));
    return { ok: true, results: data || [] };
  } catch (error) {
    return fail(readableError(error));
  }
};

/** The standings, as the lobby shows them once everyone has finished. */
export const fetchResults = async ({ roomId }) => {
  try {
    const link = await connect();
    if (!link.ok) return link;

    const { data, error } = await link.supabase
      .from('slow_results')
      .select('*')
      .eq('room_id', roomId)
      .order('rank', { ascending: true });

    if (error) return fail(readableError(error));
    return { ok: true, results: data || [] };
  } catch (error) {
    return fail(readableError(error));
  }
};
