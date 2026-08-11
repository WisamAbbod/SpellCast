import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Card, Stat, StatRow } from '../components/Stat.js';
import { useNow } from '../hooks/useNow.js';
import { colors, medalFor } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { space } from '../theme/layout.js';
import {
  dailyCellSeed, dailySeed, formatCountdown, msUntilNextPuzzle, puzzleNumber, utcDateKey,
} from '../game/daily.js';
import { canResume, getDailyRecord } from '../storage/dailyResults.js';
import { loadProfile } from '../storage/profile.js';
import { displayedStreak, streakAtRisk } from '../storage/streak.js';

/**
 * The daily puzzle: one scored attempt, then unlimited practice on the same
 * board. Puzzles are numbered rather than dated because the calendar is UTC -
 * "#587" means the same thing everywhere, "today's" does not.
 */
const DailyScreen = ({ nav }) => {
  const now = useNow(1000);
  const dateKey = utcDateKey(now);
  const [record, setRecord] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setRecord(await getDailyRecord(dateKey));
    setProfile(await loadProfile());
    setLoading(false);
  }, [dateKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const play = (resume = false) =>
    nav.push('game', {
      mode: 'daily',
      dateKey,
      seed: dailySeed(dateKey),
      cellSeed: dailyCellSeed(dateKey),
      resume,
    });

  const practiceToday = () =>
    nav.push('game', {
      mode: 'practice',
      dateKey,
      seed: dailySeed(dateKey),
      cellSeed: dailyCellSeed(dateKey),
    });

  const complete = record?.status === 'complete';
  const resumable = canResume(record, now);
  const streak = profile ? displayedStreak(profile.streak, dateKey) : 0;
  const atRisk = profile ? streakAtRisk(profile.streak, dateKey) : false;
  const medal = complete ? medalFor(record.parPercent) : null;

  return (
    <Screen>
      <Text style={styles.eyebrow}>DAILY PUZZLE</Text>
      <Text style={styles.number}>#{puzzleNumber(dateKey)}</Text>
      <Text style={styles.countdown}>
        Next puzzle in {formatCountdown(msUntilNextPuzzle(now))}
      </Text>

      {!loading && (
        <View style={styles.body}>
          {complete ? (
            <Card title="Your result">
              <StatRow>
                <Stat label="Score" value={record.score.toLocaleString()} />
                <Stat label="Of par" value={`${record.parPercent}%`} tint={colors.medal[medal.key]} />
                <Stat label="Words" value={(record.words || []).length} />
              </StatRow>
              <Text style={[styles.medal, { color: colors.medal[medal.key] }]}>
                {medal.label}
              </Text>
            </Card>
          ) : (
            <Card title={resumable ? 'Round in progress' : 'Not played yet'}>
              <Text style={styles.blurb}>
                {resumable
                  ? `You have ${record.checkpoint.secondsLeft}s and ${record.checkpoint.score} points left on the clock.`
                  : 'Everyone in the world gets this exact board. One scored attempt — make it count.'}
              </Text>
            </Card>
          )}

          {streak > 0 && (
            <Text style={styles.streak}>
              🔥 {streak} day streak{atRisk ? ' — play today to keep it' : ''}
            </Text>
          )}
        </View>
      )}

      <View style={styles.actions}>
        {complete ? (
          <>
            <Button label="Practice this board" onPress={practiceToday} subtitle="Doesn't count" />
            <Button
              label="See the leaderboard"
              variant="secondary"
              onPress={() => nav.push('stats', { dateKey })}
            />
          </>
        ) : resumable ? (
          <>
            <Button label="Resume round" onPress={() => play(true)} />
            <Button label="Start over" variant="secondary" onPress={() => play(false)} />
          </>
        ) : (
          <Button label="Play" icon="✦" onPress={() => play(false)} />
        )}
        <Button label="Back" variant="ghost" onPress={() => nav.pop()} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.body, fontSize: 11, letterSpacing: 3,
    color: colors.textFaint, textAlign: 'center', marginTop: space.lg,
  },
  number: {
    fontFamily: fonts.display, fontSize: 52, color: colors.text,
    letterSpacing: 2, textAlign: 'center',
  },
  countdown: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textDim,
    textAlign: 'center', letterSpacing: 1,
  },
  body: { flex: 1, justifyContent: 'center', gap: space.md },
  blurb: {
    fontFamily: fonts.body, fontSize: 14, color: colors.textDim,
    lineHeight: 21, textAlign: 'center',
  },
  medal: {
    fontFamily: fonts.displayBold, fontSize: 14, letterSpacing: 2,
    textAlign: 'center', marginTop: space.md,
  },
  streak: {
    fontFamily: fonts.bodySemi, fontSize: 13, color: colors.gold, textAlign: 'center',
  },
  actions: { gap: space.sm, paddingBottom: space.md },
});

export default DailyScreen;
