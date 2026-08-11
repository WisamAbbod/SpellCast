import { GENERATOR_VERSION } from '../config.js';
import { puzzleNumber } from '../game/daily.js';
import { parPercent } from '../game/share.js';
import { getLeaderboard } from '../leaderboard/index.js';
import { completeDaily } from '../storage/dailyResults.js';
import { loadProfile, saveProfile } from '../storage/profile.js';
import { getSettings } from '../storage/settings.js';
import { recordDailyResult, recordPracticeResult } from '../storage/stats.js';
import { displayedStreak } from '../storage/streak.js';

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

/**
 * Persists a finished round and submits it. Never throws: a failure to save or
 * to reach the network must not stop the results screen appearing.
 */
export const finishRound = async (result) => {
  const outcome = { result, streak: 0, previousBest: 0, submitted: null };

  try {
    const profile = await loadProfile();
    outcome.previousBest =
      result.mode === 'daily' ? profile.daily.bestScore : profile.practice.bestScore;

    const next =
      result.mode === 'daily'
        ? recordDailyResult(profile, result)
        : recordPracticeResult(profile, result);
    await saveProfile(next);
    outcome.streak = displayedStreak(next.streak, result.date);

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
        playerId: next.anonId,
        displayName: getSettings().displayName || 'Anonymous',
        createdAt: Date.now(),
      });
    }
  } catch (error) {
    // Saving is best-effort. The player still sees their score.
  }

  return outcome;
};
