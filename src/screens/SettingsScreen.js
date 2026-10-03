import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import Sheet from '../components/Sheet.js';
import Slider from '../components/Slider.js';
import { Card } from '../components/Stat.js';
import { useSettings } from '../hooks/useSettings.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import { resetSettings, saveSettings } from '../storage/settings.js';
import { NAME_LIMIT, cleanName, cleanVolume } from '../storage/schema.js';
import { nameIssue } from '../game/names.js';
import { clearProfileCache, resetProfile } from '../storage/profile.js';
import { clearDailyHistory } from '../storage/dailyResults.js';
import { clearQueue } from '../storage/queue.js';
import { previewMusicVolume, startMusic, stopMusic, tapFeedback } from '../audio/audio.js';
import { backgroundFor } from '../theme/backgrounds.js';
import { trackFor } from '../audio/tracks.js';

const Row = ({ label, hint, value, onValueChange }) => (
  <View style={styles.row}>
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.primary }}
      thumbColor="#FFFFFF"
      accessibilityLabel={label}
    />
  </View>
);

/**
 * A row that leads somewhere instead of toggling. The choosing happens in the
 * shop, where the previews are; this is only a signpost showing what is on.
 */
const LinkRow = ({ label, hint, value, onPress }) => (
  <Pressable
    onPress={() => {
      tapFeedback();
      onPress();
    }}
    style={styles.row}
    accessibilityRole="button"
    accessibilityLabel={`${label}. Currently ${value}. Opens the shop.`}
  >
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
    </View>
    <Text style={styles.rowValue}>{value}</Text>
    <Text style={styles.rowChevron}>›</Text>
  </Pressable>
);

/** A labelled slider with its value as a percentage. */
const VolumeRow = ({ label, hint, value, dimmed, onChange, onCommit }) => {
  const percent = Math.round(value * 100);
  return (
    <View style={styles.volume}>
      <View style={styles.volumeHead}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
        </View>
        <Text style={[styles.volumeValue, dimmed && styles.volumeValueDim]}>
          {percent === 0 ? 'Silent' : `${percent}%`}
        </Text>
      </View>
      <Slider label={label} value={value} dimmed={dimmed} onChange={onChange} onCommit={onCommit} />
    </View>
  );
};

const SettingsScreen = ({ nav }) => {
  const settings = useSettings();
  const [name, setName] = useState(settings.displayName);
  // The thumb's position mid-drag. Null when idle, so the slider otherwise
  // shows the saved value - including one changed elsewhere.
  const [dragVolume, setDragVolume] = useState(null);
  const musicVolume = dragVolume === null ? cleanVolume(settings.musicVolume) : dragVolume;
  const musicSilenced = settings.muted || !settings.music;
  const [confirmReset, setConfirmReset] = useState(false);

  const wipe = async () => {
    await Promise.all([clearDailyHistory(), clearQueue(), resetSettings()]);
    await resetProfile();
    clearProfileCache();
    setConfirmReset(false);
    nav.reset('menu');
  };

  return (
    <Screen>
      <Text style={styles.title}>SETTINGS</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Card title="Sound">
          {/* Above the per-channel switches, because it overrules them: without
              it here, turning "Music" on while muted would appear to do
              nothing. */}
          <Row
            label="Mute everything"
            hint="Silences music and effects without changing the rest"
            value={settings.muted}
            onValueChange={(value) => {
              saveSettings({ muted: value });
              if (value) stopMusic();
              else if (settings.music) startMusic();
            }}
          />
          <Row
            label="Music"
            hint="Plays from the menu onwards. Pick a track in the shop"
            value={settings.music}
            onValueChange={(value) => {
              saveSettings({ music: value });
              if (value && !settings.muted) startMusic();
              else stopMusic();
            }}
          />
          {/* Adjustable even while the music is off, just dimmed: it is a
              preference for when it comes back on, not a control of the
              moment. */}
          <VolumeRow
            label="Music volume"
            hint={musicSilenced ? 'Music is off' : null}
            value={musicVolume}
            dimmed={musicSilenced}
            onChange={(value) => {
              setDragVolume(value);
              previewMusicVolume(value);
            }}
            onCommit={(value) => {
              saveSettings({ musicVolume: cleanVolume(value) });
              setDragVolume(null);
            }}
          />
          <Row
            label="Sound effects"
            value={settings.sound}
            onValueChange={(value) => saveSettings({ sound: value })}
          />
          <Row
            label="Haptics"
            hint="A tick per letter as you swipe"
            value={settings.haptics}
            onValueChange={(value) => saveSettings({ haptics: value })}
          />
          <LinkRow
            label="Soundtrack"
            hint="Preview and unlock in the shop"
            value={trackFor(settings.trackKey).name}
            onPress={() => nav.push('shop', { tab: 'tracks' })}
          />
        </Card>

        <Card title="Display" style={styles.card}>
          <LinkRow
            label="Background"
            hint="Preview and unlock in the shop"
            value={backgroundFor(settings.backgroundKey).name}
            onPress={() => nav.push('shop', { tab: 'backgrounds' })}
          />
          <Row
            label="Reduced motion"
            hint="Stops the particles, confetti and tile animations"
            value={settings.reducedMotion}
            onValueChange={(value) => saveSettings({ reducedMotion: value })}
          />
        </Card>

        <Card title="Your name" style={styles.card}>
          <TextInput
            value={name}
            onChangeText={setName}
            // A name that fails the filter is simply not saved: the old one
            // stays, and the note below says why.
            onEndEditing={() => {
              if (!nameIssue(cleanName(name))) saveSettings({ displayName: cleanName(name), welcomed: true });
            }}
            placeholder="Anonymous"
            placeholderTextColor={colors.textFaint}
            maxLength={NAME_LIMIT}
            style={styles.input}
            accessibilityLabel="Your name"
          />
          {nameIssue(cleanName(name)) ? (
            <Text style={[styles.hint, styles.hintBad]}>
              That name is not allowed, so it has not been saved. Other players will see it - pick another.
            </Text>
          ) : (
            <Text style={styles.hint}>On the leaderboard and to other players online.</Text>
          )}
        </Card>

        {/* Players hidden from the leaderboard and online games (see PlayerSheet). */}
        {(settings.hiddenPlayers || []).length > 0 && (
          <Card title="Hidden players" style={styles.card}>
            <Text style={styles.hint}>
              {`${settings.hiddenPlayers.length} hidden: ${settings.hiddenPlayers.map((entry) => entry.name).filter(Boolean).join(', ')}`}
            </Text>
            <Button
              label="Show them again"
              variant="secondary"
              onPress={() => saveSettings({ hiddenPlayers: [] })}
              style={styles.reset}
            />
          </Card>
        )}

        <Card title="Data" style={styles.card}>
          <Text style={styles.hint}>
            Everything is stored on this device. There is no account, so a
            reinstall - or a reset here - loses your streak and history for good.
          </Text>
          <Button
            label="Reset all data"
            variant="danger"
            onPress={() => setConfirmReset(true)}
            style={styles.reset}
          />
        </Card>
      </ScrollView>

      <Button label="Back" variant="ghost" onPress={() => nav.pop()} />

      <Sheet
        visible={confirmReset}
        title="Reset everything?"
        subtitle="Your streak, history, stats and settings will be erased. This cannot be undone."
        onRequestClose={() => setConfirmReset(false)}
      >
        <Button label="Yes, erase it all" variant="danger" onPress={wipe} />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirmReset(false)} />
      </Sheet>
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
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: space.sm, gap: space.md,
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  rowHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  rowValue: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.stardust },
  rowChevron: { fontSize: 20, color: colors.textFaint, marginLeft: -6 },
  volume: { paddingTop: space.sm, paddingBottom: space.xs },
  volumeHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  volumeValue: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, minWidth: 44, textAlign: 'right' },
  volumeValueDim: { color: colors.textFaint },
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
  hintBad: { color: colors.danger },
  hint: {
    fontFamily: fonts.body, fontSize: 11, color: colors.textFaint,
    marginTop: space.sm, lineHeight: 17,
  },
  reset: { marginTop: space.md },
});

export default SettingsScreen;
