import React, { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import Confetti from '../components/Confetti.js';
import { Card, Stat, StatRow } from '../components/Stat.js';
import { useSettings } from '../hooks/useSettings.js';
import { colors, medalFor } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import { formatShareText, parBlocks } from '../game/share.js';
import { getLeaderboard } from '../leaderboard/index.js';

/**
 * What the round was worth.
 *
 * The headline is "you found 6 of the 10 best words" rather than a raw
 * percentage - it is a far better hook, and it comes free from the solver that
 * already had to prove the board was playable.
 */
const ResultsScreen = ({ nav, outcome, board, seed, cellSeed, dateKey, mode }) => {
  const settings = useSettings();
  const { result, streak, submitted } = outcome;
  const medal = medalFor(result.parPercent);
  const [rank, setRank] = useState(null);

  const foundSet = new Set(result.words);
  const isDaily = mode === 'daily';

  useEffect(() => {
    if (!isDaily) return;
    let cancelled = false;
    getLeaderboard()
      .rankForDate(result.date, result.score)
      .then((value) => {
        if (!cancelled) setRank(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDaily, result.date, result.score]);

  const share = () => {
    Share.share({
      message: formatShareText({
        dateKey: result.date,
        puzzle: result.puzzle,
        score: result.score,
        wordCount: result.words.length,
        par: result.par,
        bestWord: result.bestWord,
        bestWordScore: result.bestWordScore,
        streak,
        topFound: result.topFound,
        topTotal: result.topTotal,
      }),
    }).catch(() => {});
  };

  const playAgain = () =>
    nav.replace('game', { mode: 'practice', dateKey, seed, cellSeed });

  return (
    <Screen padded stars={settings.reducedMotion ? 0 : 24}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>
          {isDaily ? `PUZZLE #${result.puzzle}` : 'PRACTICE ROUND'}
        </Text>
        <Text style={styles.score}>{result.score.toLocaleString()}</Text>
        <Text style={[styles.medal, { color: colors.medal[medal.key] }]}>{medal.label}</Text>

        <Text style={styles.blocks}>{parBlocks(result.score, result.par)}</Text>
        <Text style={styles.parLine}>
          {result.parPercent}% of par ({result.par.toLocaleString()})
        </Text>

        <Card style={styles.card}>
          <StatRow>
            <Stat label="Words" value={result.words.length} />
            <Stat label="Of 10 best" value={`${result.topFound}/${result.topTotal}`} />
            <Stat
              label="Best word"
              value={result.bestWord || '—'}
              small
              tint={colors.accent}
            />
          </StatRow>
        </Card>

        {isDaily && (
          <Card style={styles.card}>
            <StatRow>
              <Stat
                label="Streak"
                value={streak}
                tint={streak > 0 ? colors.gold : undefined}
              />
              <Stat label="Available" value={result.wordsAvailable} />
              <Stat
                label={rank ? 'Rank' : 'Saved'}
                value={rank ? `${rank.rank}/${rank.total}` : submitted?.queued ? 'Queued' : '✓'}
              />
            </StatRow>
          </Card>
        )}

        <Card title="The ten best words on this board" style={styles.card}>
          <View style={styles.words}>
            {board.analysis.top.map((entry) => {
              const got = foundSet.has(entry.word);
              return (
                <View key={entry.word} style={[styles.word, got && styles.wordFound]}>
                  <Text style={[styles.wordText, got && styles.wordTextFound]}>
                    {entry.word}
                  </Text>
                  <Text style={[styles.wordScore, got && styles.wordTextFound]}>
                    {entry.score}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.footnote}>
            {result.topFound === result.topTotal
              ? 'You found every one of them.'
              : `${result.wordsAvailable} common words were hiding in this board.`}
          </Text>
        </Card>

        {result.words.length > 0 && (
          <Card title={`Your words (${result.words.length})`} style={styles.card}>
            <View style={styles.chips}>
              {result.words.map((word) => (
                <View key={word} style={styles.chip}>
                  <Text style={styles.chipText}>{word}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <View style={styles.actions}>
          {isDaily && <Button label="Share result" icon="↗" onPress={share} />}
          <Button
            label={isDaily ? 'Practice this board' : 'Play again'}
            variant="secondary"
            onPress={playAgain}
          />
          <Button
            label="Stats & leaderboard"
            variant="secondary"
            onPress={() => nav.push('stats', { dateKey: result.date })}
          />
          <Button label="Menu" variant="ghost" onPress={() => nav.reset('menu')} />
        </View>
      </ScrollView>

      <Confetti
        burstKey={result.parPercent >= 40 ? 1 : 0}
        count={40}
        enabled={!settings.reducedMotion}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xl, gap: space.sm },
  eyebrow: {
    fontFamily: fonts.body, fontSize: 11, letterSpacing: 3,
    color: colors.textFaint, textAlign: 'center', marginTop: space.md,
  },
  score: {
    fontFamily: fonts.display, fontSize: 54, color: colors.text,
    textAlign: 'center', letterSpacing: 1,
  },
  medal: {
    fontFamily: fonts.displayBold, fontSize: 14,
    letterSpacing: 3, textAlign: 'center',
  },
  blocks: { fontSize: 17, textAlign: 'center', marginTop: space.md, letterSpacing: 1 },
  parLine: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textDim,
    textAlign: 'center', marginBottom: space.sm,
  },
  card: { marginTop: space.sm },
  words: { gap: 6 },
  word: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, paddingHorizontal: space.md,
    borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  wordFound: { backgroundColor: 'rgba(61, 220, 151, 0.16)' },
  wordText: {
    fontFamily: fonts.bodySemi, fontSize: 14,
    color: colors.textDim, letterSpacing: 1.5,
  },
  wordTextFound: { color: colors.success },
  wordScore: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint },
  footnote: {
    fontFamily: fonts.body, fontSize: 11, color: colors.textFaint,
    marginTop: space.md, textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.primaryDim, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.primaryEdge,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text, letterSpacing: 0.6 },
  actions: { gap: space.sm, marginTop: space.lg },
});

export default ResultsScreen;
