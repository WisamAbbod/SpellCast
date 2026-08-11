import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Stat, StatRow } from '../components/Stat.js';
import { useNow } from '../hooks/useNow.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { space } from '../theme/layout.js';
import {
  formatCountdown, msUntilNextPuzzle, puzzleNumber, utcDateKey,
} from '../game/daily.js';
import { getDailyRecord } from '../storage/dailyResults.js';
import { loadProfile } from '../storage/profile.js';
import { displayedStreak } from '../storage/streak.js';

const MenuScreen = ({ nav }) => {
  const now = useNow(1000);
  const today = utcDateKey(now);
  const [profile, setProfile] = useState(null);
  const [record, setRecord] = useState(null);

  const refresh = useCallback(async () => {
    setProfile(await loadProfile());
    setRecord(await getDailyRecord(today));
  }, [today]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const streak = profile ? displayedStreak(profile.streak, today) : 0;
  const donetoday = record?.status === 'complete';

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>SPELLCAST</Text>
        <Text style={styles.tagline}>Trace words across the stars</Text>
      </View>

      <View style={styles.stats}>
        <StatRow>
          <Stat label="Puzzle" value={`#${puzzleNumber(today)}`} />
          <Stat label="Streak" value={streak} tint={streak > 0 ? colors.gold : undefined} />
          <Stat label="Best" value={(profile?.daily.bestScore || 0).toLocaleString()} />
        </StatRow>
      </View>

      <View style={styles.actions}>
        <Button
          label={donetoday ? 'Daily complete' : 'Play daily'}
          subtitle={
            donetoday
              ? `Next puzzle in ${formatCountdown(msUntilNextPuzzle(now))}`
              : 'One scored attempt · everyone gets the same board'
          }
          icon="✦"
          onPress={() => nav.push('daily')}
        />
        <Button
          label="Practice"
          subtitle="Unlimited rounds, nothing at stake"
          variant="secondary"
          icon="◈"
          onPress={() => nav.push('practice')}
        />
        <Button
          label="Stats & leaderboard"
          variant="secondary"
          icon="▲"
          onPress={() => nav.push('stats')}
        />

        <View style={styles.minor}>
          <Button label="How to play" variant="ghost" onPress={() => nav.push('instructions')} />
          <Button label="Settings" variant="ghost" onPress={() => nav.push('settings')} />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: space.xxl, marginBottom: space.xl },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    color: colors.text,
    letterSpacing: 6,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    letterSpacing: 2,
    marginTop: space.sm,
  },
  stats: { marginBottom: space.xl },
  actions: { flex: 1, justifyContent: 'center', gap: space.md },
  minor: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm },
});

export default MenuScreen;
