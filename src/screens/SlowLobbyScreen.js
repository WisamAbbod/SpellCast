import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import { Card } from '../components/Stat.js';
import Sheet from '../components/Sheet.js';
import BotAvatar from '../components/BotAvatar.js';
import { subscribeToRoom } from '../online/channel.js';
import {
  fetchRoom, leaveRoom, rosterToPlayers, setBots, startRoom, MAX_ROOM_PLAYERS, MIN_ROOM_PLAYERS,
} from '../online/rooms.js';
import { CHARACTERS, CHARACTER_ORDER } from '../game/slow/characters.js';
import { BOT_LEVELS, BOT_NAMES, DEFAULT_BOT_LEVEL, SLOW_ROUNDS } from '../game/slow/rules.js';

const LEVEL_KEYS = Object.keys(BOT_LEVELS);
const levelLabel = (key) => (BOT_LEVELS[key] || BOT_LEVELS[DEFAULT_BOT_LEVEL]).label;
import { tapFeedback } from '../audio/audio.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';

/**
 * The waiting room.
 *
 * Two different things are on screen at once and they are not the same: the
 * ROSTER is who has taken a seat (durable, in the room row), and PRESENCE is
 * who has the app open right now (ephemeral, from the realtime channel). A
 * player can be seated and away, which is worth showing before you start a
 * timed game with them.
 */
const SlowLobbyScreen = ({ nav, room: initialRoom, uid }) => {
  const [room, setRoom] = useState(initialRoom);
  const [present, setPresent] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState(false);
  const launched = useRef(false);

  const roomId = initialRoom.id;
  const isHost = room.hostId === uid;
  const players = rosterToPlayers(room.roster);
  const seatsLeft = MAX_ROOM_PLAYERS - players.length;

  useEffect(() => {
    let alive = true;

    const unsubscribe = subscribeToRoom({
      roomId,
      onRoom: (next) => alive && setRoom(next),
      onPresence: (uids) => alive && setPresent(uids),
      onStatus: (status) => alive && setConnection(status),
    });

    // Realtime can miss the very update that matters if the socket connects a
    // beat late, so read the room directly too - once now, then every few
    // seconds while waiting. Realtime makes it instant; this makes it certain.
    const read = () =>
      fetchRoom({ roomId }).then((result) => {
        if (alive && result.ok) setRoom(result.room);
      });
    read();
    const poll = setInterval(read, 3000);

    return () => {
      alive = false;
      clearInterval(poll);
      unsubscribe();
      // Leaving the lobby any way at all - the Leave button, Android's back
      // button, the app being closed - frees the seat, unless it was to start
      // the game. Otherwise a ghost player sits in the lobby and whoever is
      // matched in next waits for somebody who has gone. leave_slow_room is a
      // no-op once a game is running, so a late call here cannot hurt one.
      if (!launched.current) leaveRoom({ roomId });
    };
  }, [roomId]);

  /* The host flips status to 'playing'; everyone else finds out here and
     follows. One guard, because a re-render must not push twice. */
  useEffect(() => {
    if (room.status !== 'playing' || launched.current) return;
    launched.current = true;
    nav.replace('slowGame', { online: { room, uid } });
  }, [room, uid, nav]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);

    // Bots fill the empty seats so a game can start without waiting for
    // strangers who may never arrive.
    const bots = [];
    if (players.length < MIN_ROOM_PLAYERS) {
      const wanted = MIN_ROOM_PLAYERS - players.length;
      const taken = new Set(players.map((player) => player.name.toLowerCase()));
      BOT_NAMES.filter((botName) => !taken.has(botName.toLowerCase()))
        .slice(0, wanted)
        .forEach((botName, index) => {
          bots.push({
            uid: null,
            id: `bot-${index}`,
            name: botName,
            isBot: true,
            level: DEFAULT_BOT_LEVEL,
          });
        });
    }

    const result = await startRoom({ roomId, bots });
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    // The host does not wait for its own start to come back over realtime -
    // the server just said it happened. Everyone else hears it over realtime,
    // or from the poll below if that never arrives.
    setRoom(result.room);
  }, [players, roomId]);

  /*
   * Bots, managed by the host. The whole line-up goes to the server in one call
   * and the room comes back; everyone else gets the same room over realtime, so
   * a bot the host adds appears on every phone in the lobby.
   */
  const bots = players.filter((player) => player.isBot).map((bot) => ({ name: bot.name, level: bot.level }));
  const seatedNames = new Set(players.map((player) => player.name.trim().toLowerCase()));
  const available = CHARACTER_ORDER.filter((key) => !seatedNames.has(CHARACTERS[key].name.toLowerCase()));

  const applyBots = async (next) => {
    setError(null);
    const result = await setBots({ roomId, bots: next });
    if (result.ok) setRoom(result.room);
    else setError(result.reason);
  };

  const addBot = (key) => {
    tapFeedback();
    setPicking(false);
    applyBots([...bots, { name: CHARACTERS[key].name, level: DEFAULT_BOT_LEVEL }]);
  };

  const removeBot = (name) => {
    tapFeedback();
    applyBots(bots.filter((bot) => bot.name !== name));
  };

  const cycleLevel = (name) => {
    tapFeedback();
    applyBots(bots.map((bot) => {
      if (bot.name !== name) return bot;
      const at = LEVEL_KEYS.indexOf(bot.level);
      return { ...bot, level: LEVEL_KEYS[(at + 1) % LEVEL_KEYS.length] };
    }));
  };

  // Leaving frees the seat on unmount (above), so this only has to navigate.
  const quit = () => nav.reset('menu');

  const share = () => {
    tapFeedback();
    Share.share({
      message: `Join my Spacewrite game — code ${room.code}`,
    }).catch(() => {});
  };

  const live = connection === 'live';

  return (
    <Screen>
      <Text style={styles.title}>LOBBY</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <Card>
        <Text style={styles.codeLabel}>ROOM CODE</Text>
        <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={`Room code ${room.code.split('').join(' ')}. Share it.`}>
          <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit>
            {room.code}
          </Text>
        </Pressable>
        <Text style={styles.hint}>
          {room.isPublic
            ? 'Public — anyone tapping Find a game can drop in.'
            : 'Private — only people with this code can join.'}
        </Text>
        <Button label="Share code" variant="secondary" icon="↗" onPress={share} style={styles.action} />
      </Card>

      <Card
        title={`Players (${players.length}/${MAX_ROOM_PLAYERS})`}
        style={styles.card}
        action={
          <Text style={[styles.status, live && styles.statusLive]}>
            {live ? 'LIVE' : connection.toUpperCase()}
          </Text>
        }
      >
        {players.map((player, index) => {
          const here = player.isBot || present.includes(player.uid);
          return (
            <View key={player.id} style={styles.seat}>
              <View style={[styles.dot, here && styles.dotHere]} />
              {player.isBot && <BotAvatar player={player} size={20} />}
              <Text style={styles.seatName} numberOfLines={1}>
                {player.name}
                {player.uid === uid ? ' (you)' : ''}
              </Text>
              {room.hostId === player.uid && <Text style={styles.tag}>HOST</Text>}
              {!here && <Text style={styles.away}>away</Text>}
              {player.isBot && isHost ? (
                <>
                  <Pressable
                    onPress={() => cycleLevel(player.name)}
                    hitSlop={6}
                    style={styles.level}
                    accessibilityRole="button"
                    accessibilityLabel={`${player.name} plays ${levelLabel(player.level)}. Change difficulty.`}
                  >
                    <Text style={styles.levelText}>{levelLabel(player.level)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeBot(player.name)}
                    hitSlop={8}
                    style={styles.remove}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${player.name}`}
                  >
                    <Text style={styles.removeIcon}>{'\u2715'}</Text>
                  </Pressable>
                </>
              ) : player.isBot ? (
                <Text style={styles.tag}>{levelLabel(player.level).toUpperCase()}</Text>
              ) : (
                <Text style={styles.seatOrder}>{index + 1}</Text>
              )}
            </View>
          );
        })}

        {isHost && seatsLeft > 0 && available.length > 0 && (
          <Button
            label="Add bot"
            variant="secondary"
            icon="+"
            onPress={() => setPicking(true)}
            style={styles.action}
          />
        )}

        {seatsLeft > 0 && (
          <Text style={styles.hint}>
            {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} still open. Players take turns
            in the order they joined, then the bots.
          </Text>
        )}
      </Card>
      </ScrollView>

      <View style={styles.grow} />

      {!!error && <Text style={styles.error}>{error}</Text>}

      {isHost ? (
        <>
          <Button
            label={busy ? 'Starting…' : `Start · ${SLOW_ROUNDS} rounds`}
            disabled={busy}
            icon="◐"
            onPress={start}
          />
          {players.length < MIN_ROOM_PLAYERS && (
            <Text style={styles.hint}>
              Starting now fills the empty seats with bots.
            </Text>
          )}
        </>
      ) : (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.waitingText}>Waiting for the host to start…</Text>
        </View>
      )}

      <Button label="Leave" variant="ghost" onPress={quit} />

      {/* The same cast as slow mode, minus anyone already at the table. */}
      <Sheet
        visible={picking}
        title="Add a bot"
        subtitle="They play at Medium. Tap their difficulty in the lobby to change it."
        onRequestClose={() => setPicking(false)}
      >
        {available.map((key) => {
          const character = CHARACTERS[key];
          return (
            <Pressable
              key={key}
              onPress={() => addBot(key)}
              style={({ pressed }) => [styles.castRow, pressed && styles.castPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${character.name}, ${character.title}. ${character.style}. Add to the game.`}
            >
              <BotAvatar characterKey={key} size={38} />
              <View style={styles.castText}>
                <Text style={styles.castName}>{`${character.name} \u00b7 ${character.title}`}</Text>
                <Text style={styles.castStyle}>{character.style}</Text>
              </View>
            </Pressable>
          );
        })}
        <Button label="Cancel" variant="ghost" onPress={() => setPicking(false)} />
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display, fontSize: 26, color: colors.text,
    letterSpacing: 4, textAlign: 'center', marginVertical: space.md,
  },
  card: { marginTop: space.sm },
  scroll: { paddingBottom: space.sm },
  level: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: space.sm, paddingVertical: 3,
  },
  levelText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.accent },
  remove: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removeIcon: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint },
  castRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: 6, paddingHorizontal: space.sm, borderRadius: radius.sm,
  },
  castPressed: { backgroundColor: colors.primaryDim },
  castText: { flex: 1 },
  castName: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  castStyle: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  grow: { flex: 1 },
  codeLabel: {
    fontFamily: fonts.body, fontSize: 10, letterSpacing: 2,
    color: colors.textFaint, textAlign: 'center',
  },
  code: {
    fontFamily: fonts.display, fontSize: 44, color: colors.stardust,
    letterSpacing: 12, textAlign: 'center', marginVertical: space.sm,
    // The tracking pushes the last glyph off-centre; this pulls it back.
    marginLeft: 12,
  },
  action: { marginTop: space.sm },
  status: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1.4, color: colors.textFaint },
  statusLive: { color: colors.success },
  seat: {
    flexDirection: 'row', alignItems: 'center',
    gap: space.sm, paddingVertical: 7,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.textFaint, opacity: 0.5,
  },
  dotHere: { backgroundColor: colors.success, opacity: 1 },
  seatName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  tag: {
    fontFamily: fonts.body, fontSize: 9, letterSpacing: 1,
    color: colors.textFaint, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 2,
  },
  away: { fontFamily: fonts.body, fontSize: 10, color: colors.textFaint },
  seatOrder: {
    fontFamily: fonts.display, fontSize: 13, color: colors.textFaint, minWidth: 18,
    textAlign: 'right',
  },
  hint: {
    fontFamily: fonts.body, fontSize: 11, color: colors.textFaint,
    marginTop: space.sm, lineHeight: 16, textAlign: 'center',
  },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  waitingText: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  error: {
    fontFamily: fonts.bodySemi, fontSize: 13, color: colors.danger,
    textAlign: 'center', marginBottom: space.sm,
  },
});

export default SlowLobbyScreen;
