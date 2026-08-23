import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import Confetti from '../components/Confetti.js';
import { Card } from '../components/Stat.js';
import { useSettings } from '../hooks/useSettings.js';
import { GENERATOR_VERSION } from '../config.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import { standings, winnerOf } from '../game/slow/game.js';
import { POINTS_PER_LEFTOVER_GEM, SLOW_ROUNDS } from '../game/slow/rules.js';

const plural = (count, noun) => `${noun}${count === 1 ? '' : 's'}`;

/** "Nova", then "Nova and Vega", then "Nova, Vega and Atlas". */
const listNames = (names) =>
  names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * A rematch keeps the roster but must not replay the board that was just
 * finished, so the seed gets a fresh token rather than reusing the old one.
 */
const rematchSeed = () =>
  `spellcast:${GENERATOR_VERSION}:slow:${Date.now().toString(36)}:${Math.floor(
    Math.random() * 1e9,
  ).toString(36)}`;

/** Banked points, and the gems that turned into points at the whistle. */
const breakdownOf = (entry) =>
  entry.gems > 0
    ? `${entry.score} + ${entry.gemPoints} from ${entry.gems} ${plural(entry.gems, 'gem')}`
    : `${entry.score} ${plural(entry.score, 'point')}`;

/** One sentence per row - a screen reader picking through six fragments is unusable. */
const rowLabel = (entry) =>
  [
    `Rank ${entry.rank}`,
    entry.isBot ? `${entry.name}, bot` : entry.name,
    `${entry.total} ${plural(entry.total, 'point')}`,
    breakdownOf(entry),
    entry.best
      ? `${entry.words.length} ${plural(entry.words.length, 'word')}, best ${entry.best.word} for ${entry.best.score}`
      : 'no words played',
  ].join('. ');

/**
 * How the game ended.
 *
 * Every number comes from the engine's standings() - the screen must not hold
 * its own opinion about who won, or a tie would be broken twice and
 * differently.
 */
const SlowResultsScreen = ({ nav, state, config }) => {
  const settings = useSettings();

  // A game handed over half-built - or not at all - should not take the app down.
  if (!state || !Array.isArray(state.players) || state.players.length === 0) {
    return (
      <Screen>
        <View style={styles.blank}>
          <Text style={styles.blankTitle}>No game to show</Text>
          <Text style={styles.blankBlurb}>
            There is no finished game to tot up. Start one from the menu.
          </Text>
        </View>
        <Button label="Back to menu" onPress={() => nav.reset('menu')} />
      </Screen>
    );
  }

  const table = standings(state);
  const winner = winnerOf(state);
  const leaders = table.filter((entry) => entry.total === winner.total);
  const rounds = state.rounds || SLOW_ROUNDS;

  const playAgain = () => {
    // No config means no roster to rebuild, so send them back to pick one.
    if (!config) return nav.replace('slowSetup');
    nav.replace('slowGame', { config: { ...config, seed: rematchSeed() } });
  };

  return (
    <Screen padded stars={settings.reducedMotion ? 0 : 24}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>{`SLOW MODE · ${rounds} ${plural(rounds, 'ROUND').toUpperCase()}`}</Text>
        <Text style={styles.score}>{winner.total.toLocaleString()}</Text>

        {winner.tied ? (
          <>
            <Text style={styles.headline}>TIE GAME</Text>
            <Text style={styles.subhead} numberOfLines={3}>
              {`${listNames(leaders.map((entry) => entry.name))} ${
                leaders.length === 2 ? 'both' : 'all'
              } finished on ${winner.total}.`}
            </Text>
          </>
        ) : (
          <Text style={styles.headline} numberOfLines={2}>{`${winner.name} wins!`}</Text>
        )}

        <Card title="Final standings" style={styles.card}>
          <View style={styles.table}>
            {table.map((entry) => {
              // A tie has no single winner to point at, so the whole top block lights up.
              const isLeader = entry.total === winner.total;

              return (
                <View
                  key={entry.id}
                  style={[styles.row, isLeader && styles.rowLeader]}
                  accessible
                  accessibilityLabel={rowLabel(entry)}
                >
                  <Text style={[styles.rank, isLeader && styles.rankLeader]}>{entry.rank}</Text>

                  <View style={styles.body}>
                    <View style={styles.nameLine}>
                      <Text style={styles.name} numberOfLines={1}>
                        {entry.name}
                      </Text>
                      {entry.isBot && <Text style={styles.bot}>BOT</Text>}
                    </View>

                    <Text style={styles.breakdown} numberOfLines={1}>
                      {breakdownOf(entry)}
                    </Text>

                    {entry.best ? (
                      <Text style={styles.meta} numberOfLines={1}>
                        {`${entry.words.length} ${plural(entry.words.length, 'word')} · best `}
                        <Text style={styles.metaBest}>{entry.best.word}</Text>
                        {` for ${entry.best.score}`}
                      </Text>
                    ) : (
                      <Text style={styles.meta} numberOfLines={1}>
                        No words played
                      </Text>
                    )}

                    {entry.words.length > 0 && (
                      <View style={styles.chips}>
                        {entry.words.map((played) => (
                          <View key={`${played.round}-${played.word}`} style={styles.chip}>
                            <Text style={styles.chipWord} numberOfLines={1}>
                              {played.word}
                            </Text>
                            <Text style={styles.chipScore}>{played.score}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <Text style={styles.rowTotal}>{entry.total.toLocaleString()}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.footnote}>
            {`Every gem still in hand at the end was worth ${POINTS_PER_LEFTOVER_GEM} ${plural(
              POINTS_PER_LEFTOVER_GEM,
              'point',
            )}.`}
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            label="Play again"
            icon="↺"
            onPress={playAgain}
            accessibilityLabel="Play again with the same players on a new board"
          />
          <Button
            label="New game"
            variant="secondary"
            // Popping rather than replacing: the lobby is already underneath
            // this screen, and replacing would stack a second copy of it.
            onPress={() => nav.pop()}
            accessibilityLabel="Set up a new game"
          />
          <Button label="Back to menu" variant="ghost" onPress={() => nav.reset('menu')} />
        </View>
      </ScrollView>

      <Confetti burstKey={1} count={40} enabled={!settings.reducedMotion} />
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
  headline: {
    fontFamily: fonts.displayBold, fontSize: 16, color: colors.gold,
    letterSpacing: 2, textAlign: 'center',
  },
  subhead: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textDim,
    textAlign: 'center', marginTop: space.xs, lineHeight: 18,
  },
  card: { marginTop: space.sm },
  table: { gap: space.xs },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    paddingVertical: space.sm, paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    // Transparent rather than absent, so highlighting a row cannot shift the layout.
    borderWidth: 1, borderColor: 'transparent',
  },
  rowLeader: { backgroundColor: colors.primaryDim, borderColor: colors.primaryEdge },
  rank: {
    fontFamily: fonts.displayMedium, fontSize: 13,
    color: colors.textFaint, minWidth: 18, paddingTop: 2,
  },
  rankLeader: { color: colors.gold },
  body: { flex: 1, gap: 3 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  bot: {
    fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1, color: colors.accent,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  breakdown: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  metaBest: { fontFamily: fonts.bodySemi, color: colors.accent, letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primaryDim, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.primaryEdge,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  chipWord: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.text, letterSpacing: 0.6 },
  chipScore: { fontFamily: fonts.body, fontSize: 10, color: colors.textFaint },
  rowTotal: {
    fontFamily: fonts.display, fontSize: 18, color: colors.text,
    minWidth: 46, textAlign: 'right', paddingTop: 1,
  },
  footnote: {
    fontFamily: fonts.body, fontSize: 11, color: colors.textFaint,
    marginTop: space.md, textAlign: 'center',
  },
  actions: { gap: space.sm, marginTop: space.lg },
  blank: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  blankTitle: {
    fontFamily: fonts.display, fontSize: 22, color: colors.text,
    letterSpacing: 2, textAlign: 'center',
  },
  blankBlurb: {
    fontFamily: fonts.body, fontSize: 13, color: colors.textDim,
    textAlign: 'center', lineHeight: 19,
  },
});

export default SlowResultsScreen;
