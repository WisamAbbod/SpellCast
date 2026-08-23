import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Card } from '../components/Stat.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { space } from '../theme/layout.js';
import { GAME_DURATION, MIN_WORD_LENGTH } from '../game/rules.js';
import { MAX_WORD_LENGTH } from '../game/dictionary.js';
import {
  ABILITIES, LONG_WORD_BONUS, LONG_WORD_MIN, MAX_GEMS, MAX_PLAYERS,
  MIN_PLAYERS, POINTS_PER_LEFTOVER_GEM, SLOW_ROUNDS, TURN_SECONDS,
} from '../game/slow/rules.js';

const Rule = ({ icon, title, children }) => (
  <View style={styles.rule}>
    <Text style={styles.icon}>{icon}</Text>
    <View style={styles.ruleText}>
      <Text style={styles.ruleTitle}>{title}</Text>
      <Text style={styles.ruleBody}>{children}</Text>
    </View>
  </View>
);

const InstructionsScreen = ({ nav }) => (
  <Screen>
    <Text style={styles.title}>HOW TO PLAY</Text>

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <Card>
        <Rule icon="✎" title="Trace a word">
          Drag through touching letters — sideways, up, down or diagonally. Words
          are {MIN_WORD_LENGTH}–{MAX_WORD_LENGTH} letters and no tile can be used
          twice. Drag back over the last letter to undo it.
        </Rule>
        <Rule icon="⏱" title={`${GAME_DURATION} seconds`}>
          Find as much as you can before the clock runs out. Longer words are
          worth far more than several short ones.
        </Rule>
        <Rule icon="①" title="Letter values">
          The small number in the corner of each tile is what that letter is
          worth. Rare letters pay far more — a Q or a Z is 10, a vowel is 1 —
          but length matters more here than rarity does.
        </Rule>
        <Rule icon="2x" title="Bonus tiles">
          The gold tile doubles the whole word. The cyan tile triples that single
          letter. They stay put for the whole round.
        </Rule>
        <Rule icon="⚡" title="Combos">
          Words found in quick succession build a multiplier, up to 2.5x. Keep
          moving and it keeps climbing.
        </Rule>
        <Rule icon="⇄" title="Shuffle">
          Three shuffles per round, on a short cooldown. The new board is still
          drawn from the puzzle's own seed, so it stays the same for everyone.
        </Rule>
      </Card>

      <Card title="The daily puzzle" style={styles.card}>
        <Text style={styles.body}>
          Everyone in the world gets the same board each day, and you get one
          scored attempt at it. Afterwards you can practise the same board as
          much as you like — it just won't count.
          {'\n\n'}
          Puzzles change at midnight UTC, which is why they're numbered rather
          than dated. Every past puzzle stays playable from the practice screen.
        </Text>
      </Card>

      <Card title="Slow mode" style={styles.card}>
        <Text style={styles.body}>
          A different game on the same board. {MIN_PLAYERS}–{MAX_PLAYERS} players
          share one phone and take turns, for {SLOW_ROUNDS} rounds each. Bots can
          fill any empty seat.
        </Text>
        <View style={styles.spacer} />
        <Rule icon="◆" title="Letters carry the value">
          Forget length multipliers — here a Q or a Z is worth eight points while
          A, E, I and O are worth one, so a short, expensive word can beat a
          long, cheap one. Words of {LONG_WORD_MIN} letters or more add a flat
          +{LONG_WORD_BONUS}. The number in the corner of each tile is that
          letter’s value — slow mode prices them 1 to 8, and most letters cost
          something different here to what they cost on the daily board.
        </Rule>
        <Rule icon="2x" title="Tiles move every turn">
          Double letter, triple letter and a 2x word tile are re-dealt after
          every word, and the letters you used are replaced — so the board the
          next player sees is never the one you played on.
        </Rule>
        <Rule icon="◇" title="Gems buy abilities">
          Cover a gem tile with your word to collect it, up to {MAX_GEMS}.
          Shuffle costs {ABILITIES.shuffle.cost}, swapping a letter costs{' '}
          {ABILITIES.swap.cost}, and a hint costs {ABILITIES.hint.cost}. Every
          gem you finish holding is worth {POINTS_PER_LEFTOVER_GEM} point, so
          hoarding is a real strategy.
        </Rule>
        <Rule icon="⏱" title="Optional clock">
          Switch the timer on and each turn lasts {TURN_SECONDS} seconds. One gem
          buys more time.
        </Rule>
      </Card>

      <Card title="Par" style={styles.card}>
        <Text style={styles.body}>
          Par is the total of the ten best words hiding in the board. Nobody
          finds all ten in a minute — 40% of par is a strong round, and because
          par adapts to how rich each board is, the percentage means the same
          thing from one day to the next.
        </Text>
      </Card>
    </ScrollView>

    <Button label="Back" variant="ghost" onPress={() => nav.pop()} />
  </Screen>
);

const styles = StyleSheet.create({
  spacer: { height: space.sm },
  title: {
    fontFamily: fonts.display, fontSize: 26, color: colors.text,
    letterSpacing: 4, textAlign: 'center', marginVertical: space.md,
  },
  scroll: { paddingBottom: space.lg },
  card: { marginTop: space.sm },
  rule: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  icon: {
    fontFamily: fonts.displayBold, fontSize: 16, color: colors.primary,
    width: 28, textAlign: 'center', marginTop: 2,
  },
  ruleText: { flex: 1 },
  ruleTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  ruleBody: {
    fontFamily: fonts.body, fontSize: 13, color: colors.textDim,
    lineHeight: 19, marginTop: 3,
  },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 20 },
});

export default InstructionsScreen;
