import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Card, Stat, StatRow } from '../components/Stat.js';
import { colors, medalFor } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import { puzzleNumber, utcDateKey } from '../game/daily.js';
import { flushLeaderboardQueue, getLeaderboard, isRemoteEnabled } from '../leaderboard/index.js';
import { loadProfile } from '../storage/profile.js';
import { listDailyRecords } from '../storage/dailyResults.js';
import { averageDailyScore, averageParPercent, longestWordFound } from '../storage/stats.js';
import { displayedStreak } from '../storage/streak.js';

/** A tiny bar chart of recent scores - enough to see a trend without a library. */
const Sparkline = ({ records }) => {
  if (records.length < 2) return null;
  const max = Math.max(...records.map((record) => record.score), 1);

  return (
    <View style={styles.spark}>
      {records.map((record) => (
        <View
          key={record.date}
          style={[
            styles.sparkBar,
            {
              height: Math.max(3, (record.score / max) * 54),
              backgroundColor: colors.medal[medalFor(record.parPercent).key],
            },
          ]}
        />
      ))}
    </View>
  );
};

const StatsScreen = ({ nav, dateKey }) => {
  const today = dateKey || utcDateKey();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [loadedProfile, records] = await Promise.all([
      loadProfile(),
      listDailyRecords(30),
    ]);
    setProfile(loadedProfile);
    setHistory(records.filter((record) => record.status === 'complete'));

    // Retry anything that was queued while offline, then read the board back.
    await flushLeaderboardQueue();
    const top = await getLeaderboard().topForDate(today);
    setBoard(top);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !profile) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const streak = displayedStreak(profile.streak, utcDateKey());

  return (
    <Screen>
      <Text style={styles.title}>YOUR RECORD</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Card>
          <StatRow>
            <Stat label="Played" value={profile.daily.played} />
            <Stat label="Streak" value={streak} tint={streak > 0 ? colors.gold : undefined} />
            <Stat label="Best streak" value={profile.streak.best} />
          </StatRow>
          <View style={styles.spacer} />
          <StatRow>
            <Stat label="Best score" value={profile.daily.bestScore.toLocaleString()} />
            <Stat label="Average" value={averageDailyScore(profile).toLocaleString()} />
            <Stat label="Avg of par" value={`${averageParPercent(profile)}%`} />
          </StatRow>
        </Card>

        <Card title="Best word" style={styles.card}>
          <Text style={styles.bestWord}>{profile.daily.bestWord || '—'}</Text>
          <Text style={styles.bestWordMeta}>
            {profile.daily.bestWordScore
              ? `${profile.daily.bestWordScore} points · longest found ${longestWordFound(profile)} letters`
              : 'Play a round to set one'}
          </Text>
        </Card>

        {history.length > 1 && (
          <Card title="Recent rounds" style={styles.card}>
            <Sparkline records={[...history].reverse()} />
            <View style={styles.list}>
              {history.slice(0, 8).map((record) => (
                <View key={record.date} style={styles.row}>
                  <Text style={styles.rowKey}>#{puzzleNumber(record.date)}</Text>
                  <Text style={styles.rowScore}>{record.score.toLocaleString()}</Text>
                  <Text
                    style={[
                      styles.rowPar,
                      { color: colors.medal[medalFor(record.parPercent).key] },
                    ]}
                  >
                    {record.parPercent}%
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <Card title={`Puzzle #${puzzleNumber(today)} leaderboard`} style={styles.card}>
          {board && board.entries.length > 0 ? (
            board.entries.map((entry, index) => (
              <View
                key={`${entry.playerId}-${entry.date}`}
                style={[styles.row, entry.isMe && styles.rowMe]}
              >
                <Text style={styles.rowKey}>{index + 1}</Text>
                <Text style={styles.rowName} numberOfLines={1}>
                  {entry.displayName}
                </Text>
                <Text style={styles.rowScore}>{entry.score.toLocaleString()}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>
              {isRemoteEnabled()
                ? 'No scores posted for this puzzle yet.'
                : 'Playing offline — this shows your own result. Add Supabase keys in .env for a global board.'}
            </Text>
          )}
          {isRemoteEnabled() && (
            <Text style={styles.footnote}>
              Scores are submitted by players, so treat this as a friendly board.
            </Text>
          )}
        </Card>
      </ScrollView>

      <Button label="Back" variant="ghost" onPress={() => nav.pop()} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.display, fontSize: 26, color: colors.text,
    letterSpacing: 4, textAlign: 'center', marginVertical: space.md,
  },
  scroll: { paddingBottom: space.lg },
  card: { marginTop: space.sm },
  spacer: { height: space.md },
  bestWord: {
    fontFamily: fonts.display, fontSize: 26, color: colors.accent,
    letterSpacing: 3, textAlign: 'center',
  },
  bestWordMeta: {
    fontFamily: fonts.body, fontSize: 11, color: colors.textFaint,
    textAlign: 'center', marginTop: 4,
  },
  spark: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 3,
    height: 58, marginBottom: space.md,
  },
  sparkBar: { flex: 1, borderRadius: 2, minWidth: 3 },
  list: { gap: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7, paddingHorizontal: space.sm,
    borderRadius: radius.sm, gap: space.md,
  },
  rowMe: { backgroundColor: colors.primaryDim },
  rowKey: {
    fontFamily: fonts.displayMedium, fontSize: 12,
    color: colors.textFaint, minWidth: 38,
  },
  rowName: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  rowScore: {
    flex: 1, textAlign: 'right', fontFamily: fonts.bodySemi,
    fontSize: 14, color: colors.text,
  },
  rowPar: { fontFamily: fonts.body, fontSize: 12, minWidth: 44, textAlign: 'right' },
  empty: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textFaint,
    textAlign: 'center', lineHeight: 18,
  },
  footnote: {
    fontFamily: fonts.body, fontSize: 10, color: colors.textFaint,
    textAlign: 'center', marginTop: space.sm,
  },
});

export default StatsScreen;
