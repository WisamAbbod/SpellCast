import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import MuteButton from '../components/MuteButton.js';
import StardustBadge from '../components/StardustBadge.js';
import { Stat, StatRow } from '../components/Stat.js';
import { useNow } from '../hooks/useNow.js';
import { useProfile } from '../hooks/useProfile.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { space } from '../theme/layout.js';
import {
  formatCountdown, msUntilNextPuzzle, puzzleNumber, utcDateKey,
} from '../game/daily.js';
import { getDailyRecord } from '../storage/dailyResults.js';
import { displayedStreak } from '../storage/streak.js';

const MenuScreen = ({ nav }) => {
  const now = useNow(1000);
  const today = utcDateKey(now);
  // Subscribed rather than fetched, so the balance and the streak are already
  // right when a finished round lands back here - and so the badge below and
  // this screen cannot disagree about what the profile says.
  const profile = useProfile();
  const [record, setRecord] = useState(null);

  const refresh = useCallback(async () => {
    setRecord(await getDailyRecord(today));
  }, [today]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const streak = displayedStreak(profile.streak, today);
  const donetoday = record?.status === 'complete';

  return (
    <Screen>
      <View style={styles.topBar}>
        <StardustBadge onPress={() => nav.push('shop')} />
        <MuteButton />
      </View>

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
          icon="❖"
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
          label="Slow mode"
          subtitle="Pass & play · 2-6 players · 5 rounds"
          variant="secondary"
          icon="♟"
          onPress={() => nav.push('slowSetup')}
        />
        <Button
          label="Stats & leaderboard"
          variant="secondary"
          icon="▲"
          onPress={() => nav.push('stats')}
        />

        <View style={styles.minor}>
          <Button label="Shop" variant="ghost" onPress={() => nav.push('shop')} />
          <Button label="How to play" variant="ghost" onPress={() => nav.push('instructions')} />
          <Button label="Settings" variant="ghost" onPress={() => nav.push('settings')} />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  // In the flow, not absolutely placed. An absolute child is positioned from
  // the parent's border box, so top: 0 ignored the safe-area padding and put
  // the button up under the notch where it could not be reached.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  header: { alignItems: 'center', marginTop: space.md, marginBottom: space.xl },
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
  // Wraps: three ghost buttons no longer fit on one line on a narrow phone.
  minor: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: space.lg, marginTop: space.sm,
  },
});

export default MenuScreen;
