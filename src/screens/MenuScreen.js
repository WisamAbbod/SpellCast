import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import MusicButton from '../components/MusicButton.js';
import IconButton, { Gear, Question } from '../components/IconButton.js';
import StardustBadge from '../components/StardustBadge.js';
import Mascot from '../components/Mascot.js';
import { Stat, StatRow } from '../components/Stat.js';
import { useNow } from '../hooks/useNow.js';
import { useProfile } from '../hooks/useProfile.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';
import {
  formatCountdown, msUntilNextPuzzle, puzzleNumber, utcDateKey,
} from '../game/daily.js';
import { getDailyRecord } from '../storage/dailyResults.js';
import { displayedStreak } from '../storage/streak.js';
import { idleMoodFor } from '../game/mascot.js';
import { tapFeedback } from '../audio/audio.js';

const TAP_TRICKS = ['wave', 'flip', 'boost', 'ecstatic', 'dizzy', 'wow'];
// How long a woken astronaut stays up with nobody tapping him.
const STAY_AWAKE_MS = 45000;
// The hero is never sized down to make room for what is below it: the title
// and the astronaut ARE the menu. When the buttons do not all fit, the list
// scrolls and the dock stays put.
const MASCOT_SIZE = 150;

// The cyan of the accent button, at the same strengths as primaryDim/Edge.
const TURNS_DIM = 'rgba(74, 222, 222, 0.08)';
const TURNS_EDGE = 'rgba(74, 222, 222, 0.32)';

/** A panel holding one style of play: its name, what it is, and its buttons. */
const ModeGroup = ({ title, blurb, tint, dim, edge, children }) => (
  <View style={[styles.group, { backgroundColor: dim, borderColor: edge }]}>
    <View style={styles.groupHeader}>
      <Text style={[styles.groupTitle, { color: tint }]}>{title.toUpperCase()}</Text>
      <Text style={styles.groupBlurb} numberOfLines={1}>{blurb}</Text>
    </View>
    {children}
  </View>
);

const MenuScreen = ({ nav }) => {
  const now = useNow(1000);
  const today = utcDateKey(now);
  // Subscribed rather than fetched, so the balance and the streak are already
  // right when a finished round lands back here - and so the badge below and
  // this screen cannot disagree about what the profile says.
  const profile = useProfile();
  const [record, setRecord] = useState(null);
  const [greeting, setGreeting] = useState(null);
  // When he was last woken. Asleep only in the small hours, and only once
  // nobody has tapped him for a while.
  const [wokenAt, setWokenAt] = useState(0);
  const { width } = useWindowDimensions();
  // The wordmark at its full 42px wherever the WINDOW can hold it - it is
  // allowed to run into the screen's side padding (see styles.bleed), which
  // is what makes 42 fit an ordinary phone. Measured in the browser, it is
  // 7.81x its font size plus ten letters of tracking; the 8 is slack, because
  // a fit with a pixel to spare truncated in practice. A 390pt phone holds 42
  // with a point less tracking; only a narrower one gets a smaller wordmark.
  // adjustsFontSizeToFit is the fallback on phones (web does not support it).
  const tracking = width >= 402 ? 6 : 5;
  const titleSize = Math.max(24, Math.min(42, Math.floor((width - 10 * tracking - 8) / 7.81)));

  const refresh = useCallback(async () => {
    setRecord(await getDailyRecord(today));
  }, [today]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const streak = displayedStreak(profile.streak, today);
  const asleep = idleMoodFor(new Date(now).getHours()) === 'sleepy' && now - wokenAt > STAY_AWAKE_MS;
  const donetoday = record?.status === 'complete';

  return (
    <Screen>
      {/* Scrolls only when it has to: on a tall phone the content fits and the
          buttons sit centred as before; on a short one nothing is cut off. */}
      <ScrollView
        style={[styles.fill, styles.bleed]}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* How to play and Settings live up here as icons rather than as a row
            of buttons under everything else, so the whole menu fits one screen. */}
        <View style={styles.topBar}>
          <StardustBadge onPress={() => nav.push('shop')} />
          <View style={styles.topActions}>
            <IconButton onPress={() => nav.push('instructions')} accessibilityLabel="How to play">
              <Question />
            </IconButton>
            <IconButton onPress={() => nav.push('settings')} accessibilityLabel="Settings">
              <Gear />
            </IconButton>
            <MusicButton />
          </View>
        </View>

        <View style={styles.header}>
          {/* Asleep in the small hours by the player's own clock. A tap wakes
              him with a stretch and a yawn, and he stays up until he has been
              left alone for a while. */}
          <Mascot
            size={MASCOT_SIZE}
            mood={asleep ? 'sleepy' : 'idle'}
            reaction={greeting}
            restless
            roam={2.4}
            onPress={() => {
              tapFeedback();
              const wasAsleep = asleep;
              setWokenAt(Date.now());
              // Woken, he stretches; awake, each tap gets the next trick.
              setGreeting((previous) => {
                const key = (previous ? previous.key : 0) + 1;
                return { mood: wasAsleep ? 'stretch' : TAP_TRICKS[key % TAP_TRICKS.length], key };
              });
            }}
            style={styles.mascot}
          />
          {/* Ten letters of Orbitron at 42px with 6px of tracking overruns a
              360dp phone. Shrink to fit rather than wrap: a wordmark on two
              lines stops being a wordmark. */}
          <Text
            // The window's width, not the padded column's - stated outright,
            // because a one-line Text will not stretch past its parent.
            style={[styles.title, { fontSize: titleSize, letterSpacing: tracking, width, maxWidth: width }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            SPACEWRITE
          </Text>
          <Text style={styles.tagline}>Trace words across the stars</Text>
        </View>

        <View style={styles.stats}>
          <StatRow>
            <Stat label="Puzzle" value={`#${puzzleNumber(today)}`} />
            <Stat label="Streak" value={streak} tint={streak > 0 ? colors.gold : undefined} />
            <Stat label="Best" value={(profile?.daily.bestScore || 0).toLocaleString()} />
          </StatRow>
        </View>

        <View style={styles.actions}>
          {/* Two ways to play, and they are genuinely different games: a timed
              solo sprint, and a turn-based game against other players. Each
              gets its own panel, named and coloured to match its lead button,
              so the split reads at a glance rather than as six similar rows. */}
          <ModeGroup
            title="Sprint"
            blurb="60 seconds on your own, against the clock"
            tint={colors.primary}
            dim={colors.primaryDim}
            edge={colors.primaryEdge}
          >
            <Button
              label={donetoday ? 'Daily complete' : 'Play daily'}
              subtitle={
                donetoday
                  ? `Next puzzle in ${formatCountdown(msUntilNextPuzzle(now))}`
                  : 'One scored attempt \u00b7 same board for everyone'
              }
              icon="❖"
              onPress={() => nav.push('daily')}
            />
            <Button
              label="Practice"
              subtitle="Unlimited rounds, nothing at stake"
              variant="secondary"
              icon="◈"
              onPress={() => nav.push('practice')}
            />
          </ModeGroup>

          <ModeGroup
            title="Turns"
            blurb="Take turns against friends, strangers or bots"
            tint={colors.accent}
            dim={TURNS_DIM}
            edge={TURNS_EDGE}
          >
            <Button
              label="Play online"
              subtitle="Live · share a code or find anyone"
              variant="accent"
              icon="◍"
              onPress={() => nav.push('slowOnline')}
            />
            <Button
              label="Offline mode"
              subtitle="Pass one phone around · 2-6 players"
              variant="secondary"
              icon="◐"
              onPress={() => nav.push('slowSetup')}
            />
          </ModeGroup>

        </View>
      </ScrollView>

      {/* Docked below the scroll, never inside it. At the end of the list they
          started below the fold on most real phones - under the home bar - and
          nothing on screen said they were there at all. */}
      <View style={styles.dock}>
        <Button
          label="Shop"
          variant="secondary"
          icon="✦"
          onPress={() => nav.push('shop')}
          style={styles.half}
          fit
        />
        <Button
          label="Leaderboard"
          variant="secondary"
          icon="▲"
          onPress={() => nav.push('stats')}
          accessibilityLabel="Stats and leaderboard"
          style={styles.half}
          fit
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  // In the flow, not absolutely placed. An absolute child is positioned from
  // the parent's border box, so top: 0 ignored the safe-area padding and put
  // the button up under the notch where it could not be reached.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  header: { alignItems: 'center', marginTop: space.xs, marginBottom: space.lg },
  mascot: { marginBottom: space.sm },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    color: colors.text,
    letterSpacing: 6,
    textAlign: 'center',
    // Edge to edge: wider than the padded column it sits in (its width is set
    // inline, from the window).
    marginHorizontal: -space.lg,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    letterSpacing: 2,
    marginTop: space.sm,
  },
  stats: { marginBottom: space.xl },
  fill: { flex: 1 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dock: {
    flexDirection: 'row',
    gap: space.md,
    paddingTop: space.sm,
    marginTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  group: {
    borderWidth: 1,
    borderRadius: radius.lg + 4,
    padding: space.sm,
    gap: space.sm,
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'baseline', gap: space.sm,
    paddingHorizontal: space.xs, paddingTop: 2,
  },
  groupTitle: { fontFamily: fonts.displayBold, fontSize: 12, letterSpacing: 2.5 },
  groupBlurb: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  half: { flex: 1, paddingHorizontal: space.sm, minHeight: 48, paddingVertical: space.sm },
  // The scroll view reaches the screen's edges and puts the padding back
  // inside, so the wordmark can use the full width without being clipped.
  bleed: { marginHorizontal: -space.lg },
  scroll: { flexGrow: 1, paddingHorizontal: space.lg },
  actions: { flex: 1, justifyContent: 'center', gap: space.md },
});

export default MenuScreen;
