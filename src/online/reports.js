import { ensureSession, getClient } from '../leaderboard/supabaseClient.js';

/**
 * Reporting another player's name (App Store guideline 1.2).
 *
 * Write-only: the table has no select policy, so a report cannot be read back
 * through the API by anybody - they are reviewed in the Supabase dashboard
 * (Table editor -> player_reports). One report per reporter per player; a
 * second tap is answered as if it worked, because from the player's side it
 * did.
 */

export const REPORT_CONTEXTS = ['leaderboard', 'lobby', 'results'];

export const reportPlayer = async ({ id, name, context }) => {
  try {
    const supabase = getClient();
    if (!supabase) return { ok: false, reason: 'Reporting needs an internet connection' };
    const session = await ensureSession();
    if (!session) return { ok: false, reason: 'Could not reach the server - try again' };
    if (!id || id === session.user.id) return { ok: false, reason: 'Nothing to report' };

    const { error } = await supabase.from('player_reports').insert({
      reported: id,
      reported_name: String(name || '').slice(0, 40),
      context: REPORT_CONTEXTS.includes(context) ? context : 'leaderboard',
    });
    if (error && error.code !== '23505') return { ok: false, reason: 'Could not send the report - try again' };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'Could not send the report - try again' };
  }
};
