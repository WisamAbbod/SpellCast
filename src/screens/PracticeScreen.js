import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Card } from '../components/Stat.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import {
  dailyCellSeed, dailySeed, practiceCellSeed, practiceSeed, previousDateKey,
  puzzleNumber, utcDateKey,
} from '../game/daily.js';

const ARCHIVE_LENGTH = 14;

/**
 * Practice: a fresh random board, or any past puzzle.
 *
 * The archive is free - boards are a pure function of their date, so every
 * puzzle ever published can be regenerated offline with no storage at all.
 */
const PracticeScreen = ({ nav }) => {
  const [token] = useState(() => `${Date.now()}`);
  const today = utcDateKey();

  const archive = useMemo(() => {
    const days = [];
    let key = previousDateKey(today);
    for (let i = 0; i < ARCHIVE_LENGTH; i++) {
      days.push(key);
      key = previousDateKey(key);
    }
    return days;
  }, [today]);

  const playRandom = () => {
    const seedToken = `${token}:${Math.floor(Math.random() * 1e9)}`;
    nav.push('game', {
      mode: 'practice',
      seed: practiceSeed(seedToken),
      cellSeed: practiceCellSeed(seedToken),
    });
  };

  const playArchive = (dateKey) =>
    nav.push('game', {
      mode: 'practice',
      dateKey,
      seed: dailySeed(dateKey),
      cellSeed: dailyCellSeed(dateKey),
    });

  return (
    <Screen>
      <Text style={styles.title}>PRACTICE</Text>
      <Text style={styles.blurb}>
        Nothing here counts toward your streak or the leaderboard.
      </Text>

      <Button label="Random board" icon="◈" onPress={playRandom} style={styles.random} />

      <Card title="Puzzle archive" style={styles.archive}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {archive.map((dateKey) => (
              <Pressable
                key={dateKey}
                onPress={() => playArchive(dateKey)}
                style={styles.day}
                accessibilityRole="button"
                accessibilityLabel={`Play puzzle ${puzzleNumber(dateKey)}`}
              >
                <Text style={styles.dayNumber}>#{puzzleNumber(dateKey)}</Text>
                <Text style={styles.dayDate}>{dateKey.slice(5)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Card>

      <Button label="Back" variant="ghost" onPress={() => nav.pop()} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display, fontSize: 30, color: colors.text,
    letterSpacing: 4, textAlign: 'center', marginTop: space.lg,
  },
  blurb: {
    fontFamily: fonts.body, fontSize: 13, color: colors.textDim,
    textAlign: 'center', marginTop: space.sm, marginBottom: space.lg,
  },
  random: { marginBottom: space.md },
  archive: { flex: 1, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  day: {
    width: '31%',
    backgroundColor: colors.primaryDim,
    borderColor: colors.primaryEdge,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  dayNumber: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.text },
  dayDate: { fontFamily: fonts.body, fontSize: 10, color: colors.textFaint, marginTop: 2 },
});

export default PracticeScreen;
