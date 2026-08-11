import { GENERATOR_VERSION } from '../config.js';
import { LEADERBOARD_LIMIT } from './types.js';
import { ensureSession, getClient } from './supabaseClient.js';

/**
 * The global daily leaderboard.
 *
 * Scores are client-submitted, so this is a friendly leaderboard rather than a
 * cheat-proof one, and the UI says so. Making it authoritative means re-running
 * the solver server-side against the seeded board - possible precisely because
 * src/game imports nothing from React, but a project of its own.
 *
 * Table (run once in the Supabase SQL editor - see README):
 *   create table public.scores (
 *     id uuid primary key default gen_random_uuid(),
 *     player_id uuid not null default auth.uid(),
 *     date date not null,
 *     puzzle int not null,
 *     generator_version text not null,
 *     score int not null check (score >= 0 and score <= 100000),
 *     word_count int not null default 0,
 *     best_word text,
 *     best_word_score int default 0,
 *     par_percent int default 0,
 *     display_name text,
 *     created_at timestamptz not null default now(),
 *     unique (player_id, date, generator_version)
 *   );
 */
const TABLE = 'scores';

const toEntry = (row) => ({
  date: row.date,
  puzzle: row.puzzle,
  score: row.score,
  wordCount: row.word_count,
  bestWord: row.best_word,
  bestWordScore: row.best_word_score,
  parPercent: row.par_percent,
  generatorVersion: row.generator_version,
  playerId: row.player_id,
  displayName: row.display_name || 'Anonymous',
  createdAt: Date.parse(row.created_at) || 0,
});

export const supabaseLeaderboard = {
  kind: 'remote',
  isRemote: true,

  async submit(entry) {
    const supabase = getClient();
    if (!supabase) return { ok: false, reason: 'not-configured' };

    const session = await ensureSession();
    if (!session) return { ok: false, reason: 'no-session' };

    const { error } = await supabase.from(TABLE).upsert(
      {
        player_id: session.user.id,
        date: entry.date,
        puzzle: entry.puzzle,
        generator_version: entry.generatorVersion,
        score: entry.score,
        word_count: entry.wordCount,
        best_word: entry.bestWord,
        best_word_score: entry.bestWordScore,
        par_percent: entry.parPercent,
        display_name: (entry.displayName || 'Anonymous').slice(0, 24),
      },
      { onConflict: 'player_id,date,generator_version' },
    );

    return error ? { ok: false, reason: error.message } : { ok: true };
  },

  async topForDate(dateKey, limit = LEADERBOARD_LIMIT) {
    const supabase = getClient();
    if (!supabase) return { entries: [], source: 'none' };

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('date', dateKey)
      .eq('generator_version', GENERATOR_VERSION)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) return { entries: [], source: 'none' };
    return { entries: data.map(toEntry), source: 'remote' };
  },

  async rankForDate(dateKey, score) {
    const supabase = getClient();
    if (!supabase) return null;

    const [{ count: total }, { count: better }] = await Promise.all([
      supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('date', dateKey)
        .eq('generator_version', GENERATOR_VERSION),
      supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('date', dateKey)
        .eq('generator_version', GENERATOR_VERSION)
        .gt('score', score),
    ]);

    if (!total) return null;
    return {
      rank: (better || 0) + 1,
      total,
      percentile: Math.round(((total - (better || 0) - 1) / Math.max(1, total - 1)) * 100),
    };
  },

  async historyForPlayer(limit = 30) {
    const supabase = getClient();
    const session = await ensureSession();
    if (!supabase || !session) return [];

    const { data } = await supabase
      .from(TABLE)
      .select('*')
      .eq('player_id', session.user.id)
      .order('date', { ascending: false })
      .limit(limit);

    return (data || []).map(toEntry);
  },

  async flushQueue() {
    return { sent: 0, remaining: 0 };
  },
};

export default supabaseLeaderboard;
