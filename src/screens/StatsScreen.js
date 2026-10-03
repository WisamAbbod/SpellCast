import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Card, Stat, StatRow } from '../components/Stat.js';
import { colors, medalFor } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import { puzzleNumber, utcDateKey } from '../game/daily.js';
import { flushLeaderboardQueue, getLeaderboard, isRemoteEnabled } from '../leaderboard/index.js';
import { LEADERBOARD_PAGE, revealMore } from '../leaderboard/types.js';
import { tapFeedback } from '../audio/audio.js';
import PlayerSheet from '../components/PlayerSheet.js';
import { useSettings } from '../hooks/useSettings.js';
import { hiddenIds } from '../storage/schema.js';
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

// First, second and third, in the same metals as the daily medals.
const PODIUM = [colors.medal.gold, colors.medal.silver, colors.medal.bronze];

const BoardRow = ({ entry, onPress }) => {
  // By real rank, not position on screen: a row pinned under the list, or one
  // below a hidden player, keeps its true rank - and with it its real colour.
  const rank = entry.rank;
  const metal = PODIUM[rank - 1];
  const tint = metal ? { color: metal } : null;
  // Someone else's row opens Report / Hide; your own row is just your row.
  const Row = onPress ? Pressable : View;
  return (
    <Row
      style={[styles.row, entry.isMe && styles.rowMe]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${rank}, ${entry.displayName}, ${entry.score}. Report or hide this player.` : undefined}
    >
      <Text style={[styles.rowKey, tint]}>{rank}</Text>
      <Text style={[styles.rowName, tint, metal && styles.rowNamePodium]} numberOfLines={1}>
        {entry.displayName}
      </Text>
      <Text style={[styles.rowScore, tint]}>{entry.score.toLocaleString()}</Text>
    </Row>
  );
};

const StatsScreen = ({ nav, dateKey }) => {
  const today = dateKey || utcDateKey();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [board, setBoard] = useState(null);
  const [shown, setShown] = useState(LEADERBOARD_PAGE);
  const [loading, setLoading] = useState(true);
  const [about, setAbout] = useState(null); // whose row was tapped
  const settings = useSettings(); // hiding someone takes them off the board at once

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
  const hidden = hiddenIds(settings);
  const entries = (board ? board.entries : [])
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
    .filter((entry) => entry.isMe || !hidden.has(entry.playerId));
  const tapFor = (entry) =>
    !entry.isMe && isRemoteEnabled() && entry.playerId
      ? () => setAbout({ id: entry.playerId, name: entry.displayName })
      : undefined;
  const myIndex = entries.findIndex((entry) => entry.isMe);

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

        <Card title={`Puzzle #${puzzleNumber(today)} leaderboard`} style={styles.card}>
          {entries.length > 0 ? (
            <>
              {entries.slice(0, shown).map((entry, index) => (
                <BoardRow key={`${entry.playerId}-${entry.date}`} entry={entry} onPress={tapFor(entry)} />
              ))}
              {/* Further down than the list reaches: pinned underneath, so
                  nobody has to dig for their own name. */}
              {myIndex >= shown && (
                <>
                  <Text style={styles.gap}>⋯</Text>
                  <BoardRow entry={entries[myIndex]} />
                </>
              )}
              {entries.length > shown && (
                <Pressable
                  onPress={() => {
                    tapFeedback();
                    setShown((current) => revealMore(current, entries.length));
                  }}
                  style={styles.more}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Show more players. Showing ${shown} of ${entries.length}.`}
                >
                  <Text style={styles.moreLabel}>More</Text>
                </Pressable>
              )}
            </>
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
      </ScrollView>

      <PlayerSheet player={about} context="leaderboard" onClose={() => setAbout(null)} />
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
  rowNamePodium: { fontFamily: fonts.bodySemi },
  rowScore: {
    flex: 1, textAlign: 'right', fontFamily: fonts.bodySemi,
    fontSize: 14, color: colors.text,
  },
  rowPar: { fontFamily: fonts.body, fontSize: 12, minWidth: 44, textAlign: 'right' },
  empty: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textFaint,
    textAlign: 'center', lineHeight: 18,
  },
  gap: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textFaint,
    textAlign: 'center', lineHeight: 14,
  },
  more: {
    alignSelf: 'center',
    marginTop: space.sm,
    paddingVertical: 5,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textFaint, letterSpacing: 0.6 },
  footnote: {
    fontFamily: fonts.body, fontSize: 10, color: colors.textFaint,
    textAlign: 'center', marginTop: space.sm,
  },
});

export default StatsScreen;
