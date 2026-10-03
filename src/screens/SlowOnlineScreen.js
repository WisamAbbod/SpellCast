import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { nameIssue } from '../game/names.js';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Card } from '../components/Stat.js';
import { isRemoteEnabled } from '../leaderboard/index.js';
import { createRoom, findRoom, joinRoom } from '../online/rooms.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import { loadSlowSetup } from '../storage/slowSetup.js';
import { NAME_MAX_LENGTH } from '../storage/slowSetup.js';
import { SLOW_ROUNDS, TURN_SECONDS } from '../game/slow/rules.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';

/**
 * Getting into an online game: host one, type a code, or be matched.
 *
 * The name is kept in settings alongside the leaderboard name rather than in
 * the slow-mode roster, because online it is who YOU are across every game,
 * not a seat on one shared phone.
 */
const CODE_LENGTH = 5;

const SlowOnlineScreen = ({ nav }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const configured = isRemoteEnabled();

  useEffect(() => {
    // Prefer the leaderboard name, fall back to whatever they called themselves
    // on this device last time they played locally.
    const settings = getSettings();
    if (settings.displayName) {
      setName(settings.displayName);
      return;
    }
    loadSlowSetup().then((setup) => {
      const first = (setup.players || []).find((player) => !player.isBot);
      if (first) setName(first.name);
    });
  }, []);

  const go = async (kind, action) => {
    const trimmed = name.trim().slice(0, NAME_MAX_LENGTH);
    if (!trimmed) {
      setError('Pick a name first');
      return;
    }
    // Everyone at the table sees it, so it goes through the same filter as
    // the leaderboard name.
    if (nameIssue(trimmed)) {
      setError('That name is not allowed - pick another');
      return;
    }

    setBusy(kind);
    setError(null);

    // Remembered for next time, and it is the same name the leaderboard uses.
    if (trimmed !== getSettings().displayName) saveSettings({ displayName: trimmed });

    const result = await action(trimmed);
    setBusy(null);

    if (!result.ok) {
      setError(result.reason);
      return;
    }
    nav.replace('slowLobby', { room: result.room, uid: result.uid });
  };

  if (!configured) {
    return (
      <Screen>
        <Text style={styles.title}>PLAY ONLINE</Text>
        <Card style={styles.card}>
          <Text style={styles.body}>
            Online play needs a Supabase project. There isn't one configured on
            this build, so every game here would be a game of one.
            {'\n\n'}
            The setup is about five minutes and free: see{' '}
            <Text style={styles.mono}>supabase/schema.sql</Text> and the README.
            Everything else in the app works without it.
          </Text>
        </Card>
        <View style={styles.grow} />
        <Button
          label="Play on one phone instead"
          variant="secondary"
          icon="◐"
          onPress={() => nav.replace('slowSetup')}
        />
        <Button label="Back" variant="ghost" onPress={() => nav.pop()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>PLAY ONLINE</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Card title="Your name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Player"
            placeholderTextColor={colors.textFaint}
            maxLength={NAME_MAX_LENGTH}
            style={styles.input}
            autoCorrect={false}
            accessibilityLabel="Your name in online games"
          />
          <Text style={styles.hint}>Everyone in the game sees this.</Text>
        </Card>

        <Card title="Join a game" style={styles.card}>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="CODE"
            placeholderTextColor={colors.textFaint}
            maxLength={CODE_LENGTH}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, styles.codeInput]}
            accessibilityLabel="Room code"
          />
          <Button
            label={busy === 'join' ? 'Joining…' : 'Join with code'}
            variant="secondary"
            disabled={code.length < 4 || !!busy}
            onPress={() => go('join', (player) => joinRoom({ code, name: player }))}
            style={styles.action}
          />
        </Card>

        <Card title="Find anyone" style={styles.card}>
          <Text style={styles.body}>
            Puts you in the first public game that still has a seat. If there
            isn't one, you open one and wait.
          </Text>
          <Button
            label={busy === 'find' ? 'Looking…' : 'Find a game'}
            variant="secondary"
            icon="◍"
            disabled={!!busy}
            onPress={() =>
              go('find', (player) => findRoom({ name: player, rounds: SLOW_ROUNDS, timerEnabled }))
            }
            style={styles.action}
          />
        </Card>

        <Card title="Host a game" style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{TURN_SECONDS} seconds a turn</Text>
              <Text style={styles.rowHint}>
                Online games are timed by default — an untimed turn with nobody
                in the room is a game that never ends.
              </Text>
            </View>
            <Switch
              value={timerEnabled}
              onValueChange={setTimerEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.text}
              accessibilityLabel="Turn timer"
            />
          </View>

          <Button
            label={busy === 'private' ? 'Creating…' : 'Create private game'}
            disabled={!!busy}
            onPress={() =>
              go('private', (player) =>
                createRoom({ name: player, isPublic: false, rounds: SLOW_ROUNDS, timerEnabled }))
            }
            style={styles.action}
          />
          <Button
            label={busy === 'public' ? 'Creating…' : 'Create public game'}
            variant="secondary"
            disabled={!!busy}
            onPress={() =>
              go('public', (player) =>
                createRoom({ name: player, isPublic: true, rounds: SLOW_ROUNDS, timerEnabled }))
            }
            style={styles.action}
          />
          <Text style={styles.hint}>
            A private game is only reachable with its code. A public one also
            shows up for anyone tapping Find a game.
          </Text>
        </Card>

        {!!error && (
          <Card style={styles.card}>
            <Text style={styles.error}>{error}</Text>
          </Card>
        )}

        {!!busy && (
          <View style={styles.spinner}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </ScrollView>

      <Button label="Back" variant="ghost" onPress={() => nav.pop()} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display, fontSize: 26, color: colors.text,
    letterSpacing: 4, textAlign: 'center', marginVertical: space.md,
  },
  scroll: { paddingBottom: space.lg },
  card: { marginTop: space.sm },
  grow: { flex: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  codeInput: {
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: 10,
    textAlign: 'center',
    paddingVertical: space.md,
  },
  action: { marginTop: space.sm },
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs,
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  rowHint: {
    fontFamily: fonts.body, fontSize: 11,
    color: colors.textFaint, marginTop: 2, lineHeight: 16,
  },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  hint: {
    fontFamily: fonts.body, fontSize: 11, color: colors.textFaint,
    marginTop: space.sm, lineHeight: 16,
  },
  mono: { color: colors.accent },
  error: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.danger, textAlign: 'center' },
  spinner: { marginTop: space.md, alignItems: 'center' },
});

export default SlowOnlineScreen;
