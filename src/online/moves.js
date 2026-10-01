import { ensureSession, getClient } from '../leaderboard/supabaseClient.js';

/**
 * The move log: the only thing online slow mode actually synchronises.
 *
 * A move is tiny - a type, and for a word the cell indices it traced. The board
 * that results is never sent, because every device can derive it by replaying
 * the log (src/game/slow/replay.js).
 *
 * Never throws, like everything else that touches the network here.
 */

const fail = (reason) => ({ ok: false, reason });

export const toMove = (row) => ({
  seq: row.seq,
  playerId: row.player_id,
  type: row.type,
  payload: row.payload || {},
  createdAt: row.created_at ? Date.parse(row.created_at) : 0,
});

export const fetchMoves = async ({ roomId }) => {
  try {
    const supabase = getClient();
    if (!supabase) return fail('Online play is not configured');
    if (!(await ensureSession())) return fail('Not signed in');

    const { data, error } = await supabase
      .from('slow_moves')
      .select('*')
      .eq('room_id', roomId)
      .order('seq', { ascending: true });

    if (error) return fail(error.message);
    return { ok: true, moves: (data || []).map(toMove) };
  } catch (error) {
    return fail('No connection');
  }
};

/**
 * Claims sequence number `seq` for this move.
 *
 * The table has `unique (room_id, seq)`, so if another device already took this
 * number the insert fails with 23505 and this reports `taken`. That is not an
 * error to show anybody - it means the caller's view of the game was one move
 * stale, and the right response is to re-read and carry on. It is the whole of
 * the conflict resolution, and it is the database doing it rather than a
 * hand-rolled lock.
 */
export const submitMove = async ({ roomId, seq, type, payload = {} }) => {
  try {
    const supabase = getClient();
    if (!supabase) return fail('Online play is not configured');

    const session = await ensureSession();
    if (!session) return fail('Not signed in');

    const { error } = await supabase.from('slow_moves').insert({
      room_id: roomId,
      seq,
      player_id: session.user.id,
      type,
      payload,
    });

    if (error) {
      if (error.code === '23505') return { ok: false, taken: true, reason: 'Someone got there first' };
      // 42501 is RLS refusing the write - not your room, or not running yet.
      if (error.code === '42501') return fail('That game is not accepting moves');
      return fail(error.message);
    }

    return { ok: true, seq };
  } catch (error) {
    return fail('No connection');
  }
};
