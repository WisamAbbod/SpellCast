import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Card } from '../components/Stat.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import {
  ABILITIES, BOT_LEVELS, BOT_NAMES, DEFAULT_BOT_LEVEL, HUMAN_NAMES,
  LONG_WORD_BONUS, LONG_WORD_MIN, MAX_PLAYERS, MIN_PLAYERS,
  POINTS_PER_LEFTOVER_GEM, SLOW_ROUNDS, TURN_EXTEND_SECONDS, TURN_SECONDS,
} from '../game/slow/rules.js';
import {
  NAME_MAX_LENGTH, loadSlowSetup, makePlayerId, saveSlowSetup,
} from '../storage/slowSetup.js';

/** Declaration order in rules.js is the difficulty ladder, so cycling is just +1. */
const LEVEL_KEYS = Object.keys(BOT_LEVELS);

const Pill = ({ label, onPress, active, tint, accessibilityLabel }) => (
  <Pressable
    onPress={onPress}
    hitSlop={8}
    style={[styles.pill, active && styles.pillActive]}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
  >
    <Text
      style={[styles.pillText, active && styles.pillTextActive, tint ? { color: tint } : null]}
      numberOfLines={1}
    >
      {label}
    </Text>
  </Pressable>
);

const Note = ({ icon, tint, children }) => (
  <View style={styles.note}>
    <Text style={[styles.noteIcon, tint ? { color: tint } : null]}>{icon}</Text>
    <Text style={styles.noteText}>{children}</Text>
  </View>
);

/** The first name in a pool nobody else is using, ignoring the slot being named. */
const pickName = (pool, players, index) => {
  const taken = new Set(
    players.map((player, i) => (i === index ? '' : player.name.trim().toLowerCase())),
  );
  return pool.find((name) => !taken.has(name.toLowerCase())) || `Player ${index + 1}`;
};

/**
 * The slow-mode lobby.
 *
 * Deliberately not a settings panel - a group that plays every evening should
 * reach the board in two taps, which is why the roster is remembered and why
 * every slot arrives already named.
 */
const SlowSetupScreen = ({ nav }) => {
  const [players, setPlayers] = useState([]);
  const [timerEnabled, setTimerEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSlowSetup().then((setup) => {
      if (cancelled) return;
      setPlayers(setup.players);
      setTimerEnabled(setup.timerEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Structural changes and blurs write; keystrokes do not. Awaiting AsyncStorage
  // on every letter is how a TextInput ends up dropping them.
  const commit = (next) => {
    setPlayers(next.players);
    setTimerEnabled(next.timerEnabled);
    saveSlowSetup(next);
  };

  const patch = (index, changes) =>
    players.map((player, i) => (i === index ? { ...player, ...changes } : player));

  const rename = (index, name) => setPlayers(patch(index, { name }));

  const toggleBot = (index) => {
    const player = players[index];
    const isBot = !player.isBot;
    const current = player.name.trim();
    // Only replace a name the lobby chose itself, so a typed one survives the flip.
    const chosen = !current || (isBot ? HUMAN_NAMES : BOT_NAMES).includes(current);
    commit({
      players: patch(index, {
        isBot,
        name: chosen ? pickName(isBot ? BOT_NAMES : HUMAN_NAMES, players, index) : player.name,
      }),
      timerEnabled,
    });
  };

  const cycleLevel = (index) => {
    const at = LEVEL_KEYS.indexOf(players[index].level);
    commit({
      players: patch(index, { level: LEVEL_KEYS[(at + 1) % LEVEL_KEYS.length] }),
      timerEnabled,
    });
  };

  const addPlayer = () =>
    commit({
      players: [
        ...players,
        // A bot: the reason to add a fifth or sixth slot is usually another opponent.
        {
          id: makePlayerId(),
          name: pickName(BOT_NAMES, players, players.length),
          isBot: true,
          level: DEFAULT_BOT_LEVEL,
        },
      ],
      timerEnabled,
    });

  const removePlayer = (index) =>
    commit({ players: players.filter((_, i) => i !== index), timerEnabled });

  const atMinimum = players.length <= MIN_PLAYERS;
  const canStart =
    players.length >= MIN_PLAYERS && players.every((player) => player.name.trim().length > 0);

  const start = () => {
    const roster = players.map((player) => ({ ...player, name: player.name.trim() }));
    const config = {
      players: roster,
      timerEnabled,
      // Fresh per game: the same roster twice in a row must not get the same board.
      seed: `slow:${Date.now()}:${Math.floor(Math.random() * 1e9)}`,
    };
    // Fire and forget, and navigate now. Waiting on a disk write to navigate
    // means a back press during those few milliseconds lands the player in a
    // game they have already walked away from.
    saveSlowSetup({ players: roster, timerEnabled });
    nav.push('slowGame', { config });
  };

  return (
    <Screen>
      <Text style={styles.title}>SLOW MODE</Text>
      <Text style={styles.blurb}>
        Pass one phone around: {MIN_PLAYERS}–{MAX_PLAYERS} players, {SLOW_ROUNDS} rounds,
        one shared board.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Card
          title="Players"
          action={
            <Text style={styles.count}>
              {players.length} of {MAX_PLAYERS}
            </Text>
          }
        >
          {players.map((player, index) => {
            const named = player.name.trim() || `Player ${index + 1}`;
            return (
              <View key={player.id} style={styles.player}>
                <TextInput
                  value={player.name}
                  onChangeText={(name) => rename(index, name)}
                  onEndEditing={() => commit({ players, timerEnabled })}
                  placeholder={`Player ${index + 1}`}
                  placeholderTextColor={colors.textFaint}
                  maxLength={NAME_MAX_LENGTH}
                  autoCorrect={false}
                  style={styles.name}
                  accessibilityLabel={`Name for player ${index + 1}`}
                />
                <Pill
                  label={player.isBot ? 'Bot' : 'Human'}
                  active={player.isBot}
                  onPress={() => toggleBot(index)}
                  accessibilityLabel={
                    player.isBot
                      ? `${named} is a bot. Switch to human.`
                      : `${named} is a human. Switch to bot.`
                  }
                />
                {player.isBot && (
                  <Pill
                    label={BOT_LEVELS[player.level].label}
                    tint={colors.accent}
                    onPress={() => cycleLevel(index)}
                    accessibilityLabel={`${named} plays ${BOT_LEVELS[player.level].label}. Change difficulty.`}
                  />
                )}
                <Pressable
                  onPress={() => removePlayer(index)}
                  disabled={atMinimum}
                  hitSlop={8}
                  style={[styles.remove, atMinimum && styles.removeOff]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${named}`}
                  accessibilityState={{ disabled: atMinimum }}
                >
                  <Text style={styles.removeIcon}>✕</Text>
                </Pressable>
              </View>
            );
          })}

          <Button
            label="Add player"
            variant="secondary"
            icon="+"
            disabled={players.length >= MAX_PLAYERS}
            onPress={addPlayer}
            style={styles.add}
          />
        </Card>

        <Card title="Turn timer" style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{TURN_SECONDS} seconds a turn</Text>
              <Text style={styles.rowHint}>
                Anyone stuck can spend a gem for {TURN_EXTEND_SECONDS} more seconds.
              </Text>
            </View>
            <Switch
              value={timerEnabled}
              onValueChange={(value) => commit({ players, timerEnabled: value })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.text}
              accessibilityLabel="Turn timer"
            />
          </View>
        </Card>

        <Card title="How scoring works" style={styles.card}>
          <Note icon="Az">
            The letters carry the score — Z and Q are worth 8, A/E/I/O just 1
            (U is 4). A short word of expensive letters beats a long cheap one.
          </Note>
          <Note icon="2x">
            DL and TL multiply that one letter; the gold tile doubles the whole word.
          </Note>
          <Note icon="✦">
            +{LONG_WORD_BONUS} for a word of {LONG_WORD_MIN} letters or more, added
            after the doubling.
          </Note>
          <Note icon="◆" tint={colors.gem}>
            Gems buy Shuffle ({ABILITIES.shuffle.cost}), Swap ({ABILITIES.swap.cost}) and
            Hint ({ABILITIES.hint.cost}), and every gem still held at the end is worth{' '}
            {POINTS_PER_LEFTOVER_GEM} point.
          </Note>
        </Card>
      </ScrollView>

      <Button
        label="Start game"
        icon="✦"
        disabled={!canStart}
        onPress={start}
        accessibilityLabel={canStart ? 'Start game' : 'Start game. Every player needs a name.'}
      />
      <Button label="Back" variant="ghost" onPress={() => nav.pop()} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display, fontSize: 26, color: colors.text,
    letterSpacing: 4, textAlign: 'center', marginTop: space.md,
  },
  blurb: {
    fontFamily: fonts.body, fontSize: 13, color: colors.textDim,
    textAlign: 'center', marginTop: space.sm, marginBottom: space.md,
  },
  scroll: { paddingBottom: space.md },
  card: { marginTop: space.sm },
  count: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },

  player: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  name: {
    flex: 1,
    minWidth: 80,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  pill: {
    minWidth: 56,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: space.sm,
  },
  pillActive: { backgroundColor: colors.primaryDim, borderColor: colors.primaryEdge },
  pillText: {
    fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textDim, letterSpacing: 0.4,
  },
  pillTextActive: { color: colors.text },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  removeOff: { opacity: 0.25 },
  removeIcon: { fontFamily: fonts.body, fontSize: 14, color: colors.textFaint },
  add: { marginTop: space.sm },

  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: space.md,
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  rowHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2 },

  note: { flexDirection: 'row', gap: space.md, paddingVertical: 5 },
  noteIcon: {
    fontFamily: fonts.displayBold, fontSize: 12, color: colors.primary,
    width: 24, textAlign: 'center', marginTop: 2,
  },
  noteText: {
    flex: 1, fontFamily: fonts.body, fontSize: 12,
    color: colors.textDim, lineHeight: 18,
  },
});

export default SlowSetupScreen;
