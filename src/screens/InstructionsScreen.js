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
