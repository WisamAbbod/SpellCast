import { applyStreak } from './streak.js';

/**
 * Lifetime statistics. Pure: takes a profile and a finished round, returns the
 * next profile. Keeps daily and practice counters apart so practice can't
 * inflate the numbers that describe someone's daily play.
 */

export const recordDailyResult = (profile, result) => {
  const daily = profile.daily;
  const isBest = result.score > (daily.bestScore || 0);
  const isBestWord = (result.bestWordScore || 0) > (daily.bestWordScore || 0);

  const perLength = { ...profile.perLength };
  (result.words || []).forEach((word) => {
    perLength[word.length] = (perLength[word.length] || 0) + 1;
  });

  return {
    ...profile,
    streak: applyStreak(profile.streak, result.date),
    perLength,
    lastSeenPuzzle: result.date,
    daily: {
      played: (daily.played || 0) + 1,
      totalScore: (daily.totalScore || 0) + result.score,
      bestScore: isBest ? result.score : daily.bestScore || 0,
      bestScoreDate: isBest ? result.date : daily.bestScoreDate,
      bestWord: isBestWord ? result.bestWord : daily.bestWord,
      bestWordScore: isBestWord ? result.bestWordScore : daily.bestWordScore || 0,
      totalWords: (daily.totalWords || 0) + (result.words ? result.words.length : 0),
      parPercentTotal: (daily.parPercentTotal || 0) + (result.parPercent || 0),
    },
  };
};

export const recordPracticeResult = (profile, result) => {
  const practice = profile.practice;
  const perLength = { ...profile.perLength };
  (result.words || []).forEach((word) => {
    perLength[word.length] = (perLength[word.length] || 0) + 1;
  });

  return {
    ...profile,
    perLength,
    practice: {
      played: (practice.played || 0) + 1,
      totalScore: (practice.totalScore || 0) + result.score,
      bestScore: Math.max(practice.bestScore || 0, result.score),
      totalWords: (practice.totalWords || 0) + (result.words ? result.words.length : 0),
    },
  };
};

export const averageDailyScore = (profile) =>
  profile.daily.played ? Math.round(profile.daily.totalScore / profile.daily.played) : 0;

/** The honest measure of skill: par normalises away how rich each board was. */
export const averageParPercent = (profile) =>
  profile.daily.played
    ? Math.round(profile.daily.parPercentTotal / profile.daily.played)
    : 0;

export const longestWordFound = (profile) => {
  const lengths = Object.keys(profile.perLength || {})
    .map(Number)
    .filter((length) => profile.perLength[length] > 0);
  return lengths.length ? Math.max(...lengths) : 0;
};
