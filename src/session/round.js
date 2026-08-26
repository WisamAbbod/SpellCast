import { GENERATOR_VERSION } from '../config.js';
import { puzzleNumber, utcDateKey } from '../game/daily.js';
import { earnedForDaily, earnedForPractice, earnedForSlow } from '../game/economy.js';
import { parPercent } from '../game/share.js';
import { standings } from '../game/slow/game.js';
import { getLeaderboard } from '../leaderboard/index.js';
import { completeDaily, getDailyRecord } from '../storage/dailyResults.js';
import { loadProfile, saveProfile } from '../storage/profile.js';
import { getSettings } from '../storage/settings.js';
import { recordDailyResult, recordPracticeResult } from '../storage/stats.js';
import { displayedStreak } from '../storage/streak.js';
import { balanceOf, credit, remainingFor } from '../storage/wallet.js';
import { medalFor } from '../theme/colors.js';

/**
 * Everything that happens when a round ends, in one place, so the game screen
 * only has to hand over what the player did.
 */

export const buildResult = ({ mode, dateKey, board, score, words, bestWord, bestWordScore }) => {
  const analysis = board.analysis;
  const foundSet = new Set(words);
  const topFound = analysis.top.filter((entry) => foundSet.has(entry.word)).length;

  return {
    mode,
    date: dateKey,
    puzzle: dateKey ? puzzleNumber(dateKey) : 0,
    generatorVersion: GENERATOR_VERSION,
    score,
    words,
    bestWord: bestWord || null,
    bestWordScore: bestWordScore || 0,
    par: analysis.par,
    parPercent: parPercent(score, analysis.par),
    wordsAvailable: analysis.count,
    topFound,
    topTotal: analysis.top.length,
  };
};

const NOTHING_EARNED = { total: 0, lines: [], capped: false, claimed: false };

/**
 * Persists a finished round, pays out its stardust, and submits it. Never
 * throws: a failure to save or to reach the network must not stop the results
 * screen appearing.
 */
export const finishRound = async (result) => {
  const outcome = { result, streak: 0, previousBest: 0, submitted: null, earned: null };

  try {
    const profile = await loadProfile();
    outcome.previousBest =
      result.mode === 'daily' ? profile.daily.bestScore : profile.practice.bestScore;

    // Read the PRIOR status before completeDaily flips it further down, or the
    // payout could never fire. This one read is the whole replay guard.
    const previous = result.mode === 'daily' ? await getDailyRecord(result.date) : null;
    const alreadyClaimed = !!previous && previous.status === 'complete';

    const next =
      result.mode === 'daily'
        ? recordDailyResult(profile, result)
        : recordPracticeResult(profile, result);
    outcome.streak = displayedStreak(next.streak, result.date);

    // Guarded separately: a bug in the economy must never be able to cost
    // somebody their streak or their leaderboard row.
    let earned = NOTHING_EARNED;
    const today = utcDateKey();
    try {
      earned =
        result.mode === 'daily'
          ? earnedForDaily({
              score: result.score,
              medalKey: medalFor(result.parPercent).key,
              streak: outcome.streak,
              claimed: alreadyClaimed,
            })
          : earnedForPractice({
              score: result.score,
              remaining: remainingFor(next, 'practice', today),
            });
    } catch (error) {
      // The round is worth more than the payout.
    }

    // One write: the statistics and the stardust are banked together or not at
    // all, so a crash can never leave the score recorded and the payout lost.
    const credited =
      earned.total > 0
        ? credit(next, earned.total, {
            bucket: result.mode === 'daily' ? null : 'practice',
            dateKey: today,
          })
        : next;
    await saveProfile(credited);
    outcome.earned = { ...earned, balance: balanceOf(credited) };

    if (result.mode === 'daily') {
      await completeDaily(result.date, {
        score: result.score,
        words: result.words,
        bestWord: result.bestWord,
        bestWordScore: result.bestWordScore,
        par: result.par,
        parPercent: result.parPercent,
        wordsAvailable: result.wordsAvailable,
        topFound: result.topFound,
        topTotal: result.topTotal,
      });

      outcome.submitted = await getLeaderboard().submit({
        date: result.date,
        puzzle: result.puzzle,
        score: result.score,
        wordCount: result.words.length,
        bestWord: result.bestWord,
        bestWordScore: result.bestWordScore,
        parPercent: result.parPercent,
        generatorVersion: result.generatorVersion,
        playerId: credited.anonId,
        displayName: getSettings().displayName || 'Anonymous',
        createdAt: Date.now(),
      });
    }
  } catch (error) {
    // Saving is best-effort. The player still sees their score.
  }

  return outcome;
};

/**
 * Slow mode's payout - the one thing slow mode persists besides its roster.
 *
 * Same contract as finishRound: never throws, and returns something the results
 * screen can render either way. Flat rather than score-derived, because slow
 * scoring is a different game entirely and its totals are not comparable with a
 * sixty-second round.
 */
export const finishSlowGame = async (state) => {
  try {
    const table = standings(state);
    const humanWords = state.players
      .filter((player) => !player.isBot)
      .reduce((sum, player) => sum + player.words.length, 0);

    const profile = await loadProfile();
    const today = utcDateKey();

    const earned = earnedForSlow({
      humanWords,
      humanWon: table.length > 0 && !table[0].isBot,
      remaining: remainingFor(profile, 'slow', today),
    });
    if (earned.total === 0) return { ...earned, balance: balanceOf(profile) };

    const credited = credit(profile, earned.total, { bucket: 'slow', dateKey: today });
    await saveProfile(credited);
    return { ...earned, balance: balanceOf(credited) };
  } catch (error) {
    return { ...NOTHING_EARNED, balance: 0 };
  }
};
