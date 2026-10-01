import { ensureSession, getClient } from '../leaderboard/supabaseClient.js';
import { toMove } from './moves.js';
import { toRoom } from './rooms.js';

/**
 * One realtime channel per room, carrying three things:
 *
 *   - inserts on slow_moves  -> somebody played
 *   - updates on slow_rooms  -> the roster or the status changed
 *   - presence               -> who is actually here right now
 *
 * Presence is the only part that is genuinely "live". Moves and roster changes
 * are durable rows, so a client that misses an event can always recover by
 * re-reading; presence cannot be re-read, which is why a dropped player is
 * detected here and nowhere else.
 *
 * subscribe() returns an unsubscribe function and never throws. If realtime is
 * unavailable the caller still works - it just has to poll, which is why
 * onDropped is advisory and every screen also re-fetches on resume.
 */

const noop = () => {};

export const subscribeToRoom = ({
  roomId,
  onMove = noop,
  onRoom = noop,
  onPresence = noop,
  onStatus = noop,
}) => {
  let channel = null;
  let cancelled = false;

  (async () => {
    try {
      const supabase = getClient();
      if (!supabase) {
        onStatus('unconfigured');
        return;
      }

      const session = await ensureSession();
      if (!session || cancelled) {
        onStatus('unauthenticated');
        return;
      }

      // Hand the sign-in to the realtime socket BEFORE subscribing. supabase-js
      // does this itself on an auth event, but asynchronously - a channel that
      // joins first joins as the anonymous public key, and row level security
      // then quietly sends it nothing. That race is how a lobby could sit there
      // after the host pressed Start.
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase.channel(`room:${roomId}`, {
        config: { presence: { key: session.user.id } },
      });

      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'slow_moves', filter: `room_id=eq.${roomId}` },
          (message) => {
            if (message && message.new) onMove(toMove(message.new));
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'slow_rooms', filter: `id=eq.${roomId}` },
          (message) => {
            if (message && message.new) onRoom(toRoom(message.new));
          },
        )
        .on('presence', { event: 'sync' }, () => {
          try {
            // presenceState() is keyed by uid, each holding that client's
            // tracked payloads. One entry per open app, so the keys are the
            // people in the room right now.
            onPresence(Object.keys(channel.presenceState() || {}));
          } catch (error) {
            /* presence is a nicety, never a failure */
          }
        });

      channel.subscribe((status) => {
        if (cancelled) return;
        onStatus(status === 'SUBSCRIBED' ? 'live' : String(status).toLowerCase());
        if (status === 'SUBSCRIBED') {
          // Tracking is what puts this client into everybody else's presence
          // list. Without it you can see others and nobody can see you.
          channel.track({ uid: session.user.id, at: Date.now() }).catch(noop);
        }
      });
    } catch (error) {
      onStatus('error');
    }
  })();

  return () => {
    cancelled = true;
    try {
      if (channel) {
        channel.untrack().catch(noop);
        const supabase = getClient();
        if (supabase) supabase.removeChannel(channel);
      }
    } catch (error) {
      /* tearing down a channel must never be able to crash a screen */
    }
  };
};

export default subscribeToRoom;
