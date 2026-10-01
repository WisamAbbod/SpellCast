import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import Mascot from '../components/Mascot.js';
import { saveSettings } from '../storage/settings.js';
import { NAME_LIMIT, cleanName } from '../storage/schema.js';
import { loadSlowSetup, saveSlowSetup } from '../storage/slowSetup.js';
import { HUMAN_NAMES } from '../game/slow/rules.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';

/**
 * The first thing a new player sees: what should we call you?
 *
 * One name, used everywhere a name appears - the daily leaderboard, online
 * games, and the first seat in slow mode - so nobody plays a week as
 * "Anonymous" and "Player 1" without ever being asked. Skippable, and asked
 * exactly once either way (settings.welcomed); Settings can change it later.
 */
const WelcomeScreen = ({ nav }) => {
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const [cheer, setCheer] = useState({ mood: 'wave', key: 1 });
  const leaving = useRef(false);
  const cleaned = cleanName(name);

  // Wave hello again after a moment, in case the first one was missed while
  // the screen was still settling.
  useEffect(() => {
    const timer = setTimeout(() => setCheer({ mood: 'wave', key: 2 }), 2600);
    return () => clearTimeout(timer);
  }, []);

  const finish = async (chosen) => {
    if (leaving.current) return;
    leaving.current = true;

    await saveSettings({ displayName: chosen, welcomed: true });

    // The first human seat in slow mode takes the name too - but only if it
    // still has the placeholder; a name someone typed there is theirs.
    if (chosen) {
      const setup = await loadSlowSetup();
      const index = setup.players.findIndex((player) => !player.isBot);
      if (index >= 0 && HUMAN_NAMES.includes(setup.players[index].name)) {
        const players = setup.players.map((player, i) => (i === index ? { ...player, name: chosen } : player));
        saveSlowSetup({ ...setup, players });
      }
      setCheer({ mood: 'ecstatic', key: 3 });
      setTimeout(() => nav.reset('menu'), 900); // long enough to land the backflip
      return;
    }
    nav.reset('menu');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.top}>
          {/* It watches the box while you type, and waves before you do. */}
          <Mascot
            size={150}
            mood="idle"
            reaction={cheer}
            lookAt={focused ? { x: 0, y: 0.9 } : null}
            roam={1.6}
          />
          <Text style={styles.title}>WELCOME</Text>
          <Text style={styles.question}>What should we call you?</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => cleaned && finish(cleaned)}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            maxLength={NAME_LIMIT}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="done"
            style={styles.input}
            accessibilityLabel="Your name"
          />
          <Text style={styles.hint}>
            On the leaderboard and to other players online. You can change it any
            time in Settings.
          </Text>

          <Button
            label={cleaned ? `Let's go, ${cleaned}` : "Let's go"}
            disabled={!cleaned}
            onPress={() => finish(cleaned)}
            style={styles.go}
          />
          <Button label="Skip for now" variant="ghost" onPress={() => finish('')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center' },
  top: { alignItems: 'center', marginBottom: space.xl },
  title: {
    fontFamily: fonts.display, fontSize: 30, color: colors.text,
    letterSpacing: 5, marginTop: space.md,
  },
  question: {
    fontFamily: fonts.body, fontSize: 15, color: colors.textDim,
    marginTop: space.sm, letterSpacing: 0.4,
  },
  form: { gap: space.sm },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryEdge,
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 22,
    letterSpacing: 1.5,
    textAlign: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  hint: {
    fontFamily: fonts.body, fontSize: 12, color: colors.textFaint,
    textAlign: 'center', lineHeight: 17, marginBottom: space.sm,
  },
  go: { marginTop: space.xs },
});

export default WelcomeScreen;
