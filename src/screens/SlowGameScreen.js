import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Screen from '../components/Screen.js';
import Board from '../components/Board.js';
import Button from '../components/Button.js';
import Sheet from '../components/Sheet.js';
import Confetti from '../components/Confetti.js';
import MusicButton from '../components/MusicButton.js';
import Mascot from '../components/Mascot.js';
import BotAvatar from '../components/BotAvatar.js';
import { thinkingLine } from '../game/slow/characters.js';
import { gazeForCell, moodForRound, moodForWord } from '../game/mascot.js';
import { useSettings } from '../hooks/useSettings.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useBoardLayout, radius, space } from '../theme/layout.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import {
  playGameOver, playInvalid, playSelect, playShuffle, playStart, playTick, playWord,
  startMusic,
} from '../audio/audio.js';
import { useSwipeSelection } from '../game/swipe/useSwipeSelection.js';
import { cellsToIndices, toIndex, toRowCol } from '../game/board.js';
import { CELL_COUNT, MIN_WORD_LENGTH } from '../game/rules.js';
import { isValidWord } from '../game/dictionary.js';
import { deadlineFrom, resumeDeadline } from '../game/time.js';
import {
  ABILITIES, ABILITY_ORDER, MAX_GEMS, TURN_SECONDS,
} from '../game/slow/rules.js';
import {
  applyAbility, createSlowGame, currentPlayer, passTurn, standings, submitWord, totalTurns,
} from '../game/slow/game.js';
import { chooseBotWord, planBotTurn } from '../game/slow/bot.js';
import { slowLetterValue } from '../game/slow/scoring.js';
import { finishOnlineGame, finishSlowGame } from '../session/round.js';
import { runWhenIdle } from '../session/idle.js';
import { useOnlineSlowGame } from '../online/useOnlineSlowGame.js';
import { finishRoom, isMySeat } from '../online/rooms.js';

/**
 * Slow mode: the turn-based game.
 *
 * Params: { config: { seed, players, timerEnabled } }
 *
 * The screen owns no rules. Every legal question - whose turn is it, does that
 * word count, can they afford that - is answered by src/game/slow/game.js, and
 * the screen's only job is to make the answer look like something.
 *
 * The one piece of stagecraft worth knowing about: a played word is celebrated
 * on the OLD board, and only then is the new state applied. Applying it
 * immediately would refill the tiles underneath the pop animation, so the
 * celebration would land on the letters that replaced the word rather than the
 * word itself.
 */

/*
 * The beat between turns, in order: the tiles pop (~420ms), the word's score is
 * readable, then the state applies and the used letters are thrown off the
 * board while their replacements drop in (~590ms, in Tile). Trimmed from 950 to
 * make room for the flight without the gap between turns dragging.
 */
const CELEBRATION_MS = 760;
const BOT_STEP_MS = 135;
const BOT_SUBMIT_PAUSE_MS = 420;
const HINT_MS = 4200;

const LETTER_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'];

const SlowGameScreen = ({ nav, config: localConfig, online }) => {
  const settings = useSettings();
  const layout = useBoardLayout();

  /*
   * Online and local are the same screen.
   *
   * The hook is called unconditionally and simply does nothing without a room,
   * because the alternative - two components - would mean duplicating eight
   * hundred lines of board, HUD and swipe handling to change where the state
   * comes from.
   *
   * What makes this cheap is that replay is deterministic: the state a local
   * submitWord() returns is byte-for-byte the state every other device will
   * derive from the same move. So the optimistic path below is not a guess that
   * needs reconciling - it is the answer, arriving early. All the existing
   * celebration stagecraft survives untouched.
   */
  const session = useOnlineSlowGame({
    room: online ? online.room : null,
    uid: online ? online.uid : null,
  });
  const isOnline = session.enabled;

  const config = useMemo(
    () =>
      isOnline
        ? {
            seed: session.room.seed,
            players: session.players,
            rounds: session.room.rounds,
            timerEnabled: session.room.timerEnabled,
          }
        : localConfig,
    [isOnline, session.room, session.players, localConfig],
  );

  const [game, setGame] = useState(null);

  /*
   * Every move that has to reach the other phones goes through here, and the
   * acting player decides how it is sent. A bot's move is sent by the host on a
   * seat that is not the host's own, so it must be forced past the "is it your
   * turn?" check - without that, every bot word, shuffle and pass was silently
   * refused, the host's screen carried on alone, and every phone froze on the
   * next human turn waiting for a move that had never been sent.
   */
  const publish = useCallback(
    (type, payload, actor) => {
      if (!isOnline) return;
      session.play(type, payload || {}, { force: !!(actor && actor.isBot) });
    },
    [isOnline, session],
  );
  // idle -> handoff -> playing -> celebrating, with bot turns running
  // thinking -> tracing -> celebrating instead.
  const [phase, setPhase] = useState('idle');
  const [botPath, setBotPath] = useState([]);
  const [hint, setHint] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [popKeys, setPopKeys] = useState({});
  const [replaceKeys, setReplaceKeys] = useState({});
  const [burst, setBurst] = useState(0);
  const [paused, setPaused] = useState(false);
  const [swapping, setSwapping] = useState(null); // { index } once a tile is picked
  const [deadline, setDeadline] = useState(null);
  const [mascotReaction, setMascotReaction] = useState(null);
  const [boardSpace, setBoardSpace] = useState(null);
  const react = useCallback((mood) => {
    setMascotReaction((previous) => ({ mood, key: (previous ? previous.key : 0) + 1 }));
  }, []);

  const timers = useRef([]);
  // Mirrored so resume can rebuild the deadline without the countdown's value
  // becoming a dependency of every callback above it.
  const secondsLeftRef = useRef(0);
  const feedbackTimer = useRef(null);
  const startedTurn = useRef(-1);
  const popCounter = useRef(0);
  const replaceCounter = useRef(0);
  const finishing = useRef(false);

  /** Every timer goes through here so a quit mid-bot-turn can cancel the lot. */
  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [clearTimers],
  );

  /**
   * Marks tiles as replaced so they throw their old letter off the board and
   * drop the new one in. Stamped rather than toggled, so the same tile changing
   * twice in a row still animates the second time.
   */
  const markReplaced = useCallback((indices) => {
    replaceCounter.current += 1;
    const stamp = replaceCounter.current;
    setReplaceKeys((previous) => {
      const next = { ...previous };
      indices.forEach((index) => {
        next[index] = stamp;
      });
      return next;
    });
  }, []);

  const ALL_CELLS = useMemo(() => Array.from({ length: CELL_COUNT }, (_, i) => i), []);

  const flash = useCallback((text, tone = 'error') => {
    setFeedback({ text, tone });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1600);
  }, []);

  /* ------------------------------------------------------------- setup -- */

  useEffect(() => {
    if (!config) {
      nav.replace('slowSetup');
      return undefined;
    }

    // Online, the opening state arrives from the replayed move log rather than
    // being built here - the effect below adopts it as soon as it exists.
    if (isOnline) return undefined;

    let cancelled = false;
    // Building the opening board runs the generator and the solver. Two frames
    // after the transition settles, so the screen paints first.
    const task = runWhenIdle(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (cancelled) return;
          setGame(
            createSlowGame({
              seed: config.seed,
              players: config.players,
              rounds: config.rounds,
              timerEnabled: !!config.timerEnabled,
            }),
          );
          playStart();
          startMusic();
        }),
      );
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [config, isOnline, nav]);

  /*
   * Adopting somebody else's move.
   *
   * The replayed state is the truth, but it must not simply be rendered - a
   * word played on another device has to be celebrated on the board it was
   * played on, exactly like a local one, or the tiles pop over letters that
   * have already been replaced.
   *
   * A move this device made itself is already on screen (the optimistic path in
   * commit), and the turn index will match, so this does nothing for it.
   */
  useEffect(() => {
    if (!isOnline || !session.game) return;
    const incoming = session.game;

    if (!game) {
      setGame(incoming);
      playStart();
      startMusic();
      return;
    }
    if (incoming.turnIndex === game.turnIndex && incoming.board.version === game.board.version) {
      return;
    }
    // Behind by at least one move. Replay is deterministic, so this is the same
    // object our own submitWord would have produced.
    if (incoming.turnIndex < game.turnIndex) return; // a stale echo; ignore

    const event = incoming.lastEvent;
    if (event && event.type === 'word' && Array.isArray(event.indices)) {
      setPhase('celebrating');
      popCounter.current += 1;
      const stamp = popCounter.current;
      setPopKeys((previous) => {
        const next = { ...previous };
        event.indices.forEach((index) => {
          next[index] = stamp;
        });
        return next;
      });
      flash(`${event.playerName}: ${event.word}  +${event.scored.score}`, 'success');
      playWord(1);
      react('happy');
      later(() => {
        setGame(incoming);
        markReplaced(event.indices);
      }, CELEBRATION_MS);
      return;
    }

    setGame(incoming);
  }, [isOnline, session.game, game, flash, later, markReplaced, react]);

  // Once the game is finished turnIndex sits one past the last turn, which
  // would wrap round to player 0 and a round that never happened. The HUD stays
  // on the last real turn for the beat before the results screen replaces it.
  const shown = useMemo(() => {
    if (!game) return null;
    const last = Math.max(0, totalTurns(game) - 1);
    const index = Math.min(game.turnIndex, last);
    const seat = index % game.players.length;
    return {
      seat,
      player: game.players[seat],
      round: Math.floor(index / game.players.length) + 1,
      turn: index + 1,
    };
  }, [game]);

  const player = shown ? shown.player : null;
  const humans = useMemo(
    () => (game ? game.players.filter((entry) => !entry.isBot).length : 0),
    [game],
  );

  /* -------------------------------------------------------------- turns -- */

  const beginHumanTurn = useCallback(() => {
    setPhase('playing');
    setDeadline(config?.timerEnabled ? deadlineFrom(TURN_SECONDS) : null);
  }, [config]);

  /**
   * Pause has to do more than hide the board.
   *
   * A bot's turn is a queue of timers, and a deadline is an absolute wall-clock
   * time - so a naive pause leaves the bot playing behind the dialog and lets
   * the turn clock run down while nobody is looking. A bot's performance is
   * therefore thrown away and replayed from the top on resume; a human's clock
   * is rebuilt from whatever was left on it.
   */
  const botInterrupted = useRef(false);

  const pauseGame = useCallback(() => {
    if (phase === 'thinking' || phase === 'tracing') {
      clearTimers();
      setBotPath([]);
      botInterrupted.current = true;
    }
    setPaused(true);
  }, [clearTimers, phase]);

  const resumeGame = useCallback(() => {
    setPaused(false);
    if (botInterrupted.current) {
      botInterrupted.current = false;
      startedTurn.current = -1; // let the turn effect deal the bot's turn again
      return;
    }
    if (phase === 'playing' && deadline) setDeadline(resumeDeadline(secondsLeftRef.current));
  }, [deadline, phase]);

  /**
   * A bot turn, played out rather than applied: think, maybe shuffle, trace the
   * word one tile at a time, then submit. A bot that simply changed the score
   * would be indistinguishable from a bug.
   */
  const runBotTurn = useCallback(
    (state) => {
      setPhase('thinking');
      setDeadline(null);

      const plan = planBotTurn(state);

      later(() => {
        let working = state;

        if (plan.shuffle) {
          const shuffled = applyAbility(working, 'shuffle');
          if (shuffled.ok) {
            // Published, or the bot's word below is traced on a board that only
            // exists on this phone, and every other phone rejects it.
            publish('shuffle', {}, currentPlayer(working));
            working = shuffled.state;
            setGame(working);
            playShuffle();
          }
        }

        // Chosen AFTER any shuffle, against the board as it now stands.
        const move = chooseBotWord(working);

        if (!move) {
          flash(`${currentPlayer(working).name} passed`);
          const passed = passTurn(working, 'no word found');
          publish('pass', { reason: 'no word found' }, currentPlayer(working));
          later(() => setGame(passed.state), 700);
          return;
        }

        setPhase('tracing');
        const cells = move.indices.map(toRowCol);

        cells.forEach((_, step) => {
          later(() => {
            setBotPath(cells.slice(0, step + 1));
            playSelect(step + 1);
          }, step * BOT_STEP_MS);
        });

        later(() => {
          setBotPath([]);
          // If the engine refuses it for any reason, pass rather than stall:
          // a turn that never ends is the one bug a player cannot recover from.
          if (!commitRef.current(working, move.indices)) {
            const passed = passTurn(working, 'move rejected');
            publish('pass', { reason: 'move rejected' }, currentPlayer(working));
            later(() => setGame(passed.state), 400);
          }
        }, cells.length * BOT_STEP_MS + BOT_SUBMIT_PAUSE_MS);
      }, plan.thinkMs);
    },
    [flash, later, publish],
  );

  /**
   * Plays a word for whoever has the turn, then holds the celebration on the
   * board that produced it before advancing.
   */
  const commit = useCallback(
    (state, indices) => {
      const result = submitWord(state, indices);

      if (!result.ok) {
        flash(result.reason);
        playInvalid();
        react('oops');
        return false;
      }

      const { event } = result;
      setPhase('celebrating');
      setHint(null);
      setDeadline(null);

      popCounter.current += 1;
      const stamp = popCounter.current;
      setPopKeys((previous) => {
        const next = { ...previous };
        indices.forEach((index) => {
          next[index] = stamp;
        });
        return next;
      });

      const notes = [
        `${event.word}  +${event.scored.score}`,
        event.scored.doubleWord ? '2x WORD' : null,
        event.scored.longWord ? `+${event.scored.longBonus} LONG` : null,
        // What they actually banked, not what was on the board: at the cap the
        // rest is lost, and announcing gems nobody received is a lie.
        event.gemsFound - event.gemsWasted > 0
          ? `+${event.gemsFound - event.gemsWasted} GEM${
              event.gemsFound - event.gemsWasted === 1 ? '' : 'S'
            }`
          : null,
      ].filter(Boolean);
      flash(notes.join('   '), 'success');

      playWord(event.scored.doubleWord ? 1.5 : 1);
      react(moodForWord({ length: event.word.length }));
      if (event.scored.longWord || event.scored.doubleWord) setBurst((value) => value + 1);

      // Publishing happens after the engine has accepted the word, so an
      // illegal move never reaches anybody else's device.
      publish('word', { indices }, currentPlayer(state));

      later(() => {
        // Batched with setGame so the tile re-renders with its new letter and
        // its new stamp in one commit - split across two, it would animate a
        // letter that had already changed.
        setGame(result.state);
        markReplaced(indices);
      }, CELEBRATION_MS);
      return true;
    },
    [flash, later, markReplaced, publish, react],
  );

  // runBotTurn closes over `commit`, which is defined after it. Keeping the
  // live one in a ref avoids reordering the file around a circular dependency.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  /** Starts whatever the new turn is, exactly once per turn. */
  useEffect(() => {
    if (!game || paused) return;

    if (game.status === 'finished') {
      if (finishing.current) return;
      finishing.current = true;
      clearTimers();
      playGameOver();

      // Paid here rather than on the results screen, because finishing.current
      // already guarantees this runs once per game - the results screen remounts
      // if somebody navigates back to it, and would pay again.
      // Online pays by this phone's seat; one shared phone pays the table.
      const award = isOnline ? finishOnlineGame(game, online.uid) : finishSlowGame(game); // never rejects

      /*
       * Online, every device writes the standings and the server keeps the
       * first. Doing it on one nominated client would mean the game has no
       * result at all if that one person's connection died on the last turn -
       * which is exactly when it is most likely to.
       */
      const published = isOnline
        ? finishRoom({
            roomId: session.room.id,
            results: standings(game).map((entry) => ({
              // The engine's roster keeps `id`, not `uid`; the join RPCs set
              // both to auth.uid(), so for a human they are the same string.
              uid: entry.isBot ? null : entry.id,
              name: entry.name,
              isBot: entry.isBot,
              rank: entry.rank,
              total: entry.total,
              score: entry.score,
              gems: entry.gems,
              wordCount: entry.words.length,
              bestWord: entry.best ? entry.best.word : null,
              bestWordScore: entry.best ? entry.best.score : 0,
            })),
          })
        : Promise.resolve(null);

      later(() => {
        Promise.all([award, published]).then(([earned]) =>
          nav.replace('slowResults', {
            state: game,
            config,
            earned,
            online: isOnline ? { room: session.room, uid: online.uid } : null,
          }),
        );
      }, 600);
      return;
    }

    if (startedTurn.current === game.turnIndex) return;
    startedTurn.current = game.turnIndex;
    clearTimers(); // nothing the last turn queued should still be pending

    setBotPath([]);
    setHint(null);
    setSwapping(null);

    const next = currentPlayer(game);

    if (isOnline) {
      /*
       * Online there is no handoff - everybody has their own screen. What
       * matters instead is who is allowed to act:
       *
       *   - your seat        -> play
       *   - somebody else's  -> watch, and let their move arrive
       *   - a bot's          -> ONLY the host plays it out. If every client ran
       *                         the bot, all of them would race to write the
       *                         same move and the unique index would reject all
       *                         but one anyway - but they would each pick a
       *                         different word first, so the one that landed
       *                         would not be the one most of them animated.
       */
      if (next.isBot) {
        if (session.isHost) runBotTurn(game);
        else setPhase('waiting');
      } else if (isMySeat(session.room.roster, online.uid, game.turnIndex)) {
        // Judged on the board on screen, not on the server's replay - which can
        // be a moment behind it, and was how a dropped bot move turned into a
        // permanent "waiting" screen.
        beginHumanTurn();
      } else {
        setPhase('waiting');
      }
      return;
    }

    if (next.isBot) runBotTurn(game);
    else if (humans > 1) setPhase('handoff');
    else beginHumanTurn();
  }, [beginHumanTurn, clearTimers, config, game, humans, later, nav, paused, runBotTurn,
      isOnline, session.isHost, session.room, online]);

  /* -------------------------------------------------------------- clock -- */

  const handleTimeout = useCallback(() => {
    if (!game || phase !== 'playing') return;
    setPhase('celebrating'); // anything but 'playing' - the board is closed now
    flash(`${currentPlayer(game).name} ran out of time`);
    playInvalid();
    const passed = passTurn(game, 'timed out');
    // Only the device whose turn it is may write the timeout, or six clients
    // race to pass the same turn and five of them lose on the unique index.
    publish('pass', { reason: 'timed out' }, currentPlayer(game));
    later(() => setGame(passed.state), 500);
  }, [flash, game, later, phase, publish]);

  const secondsLeft = useCountdown(deadline, {
    running: phase === 'playing' && !paused && !!deadline,
    onExpire: handleTimeout,
    onTick: (left) => {
      secondsLeftRef.current = left;
      if (left <= 5 && left > 0) playTick();
    },
  });

  /* ------------------------------------------------------------- swipe -- */

  const handleCommit = useCallback(
    (cells) => {
      if (!game || phase !== 'playing') return;
      commit(game, cellsToIndices(cells));
    },
    [commit, game, phase],
  );

  const swipe = useSwipeSelection({
    enabled: !!game && phase === 'playing' && !paused && !swapping,
    onCommit: handleCommit,
    onSelect: useCallback((path, grew) => {
      if (grew) playSelect(path.length);
    }, []),
  });

  const clearSelection = swipe.clearSelection;
  useEffect(() => {
    if (phase !== 'playing' || paused) clearSelection();
  }, [clearSelection, paused, phase]);

  /* --------------------------------------------------------- abilities -- */

  const spend = useCallback(
    (key, payload) => {
      if (!game || phase !== 'playing') return;

      const result = applyAbility(game, key, payload);
      if (!result.ok) {
        flash(result.reason);
        playInvalid();
        return;
      }

      // An ability never ends the turn, so the new state is applied at once -
      // there is no celebration to hold the old board for.
      startedTurn.current = result.state.turnIndex;
      setGame(result.state);
      publish(key, payload, currentPlayer(game));

      if (key === 'shuffle') {
        react('dizzy');
        // Any hint on screen now points at letters that have moved.
        setHint(null);
        markReplaced(ALL_CELLS);
        playShuffle();
        flash('Board shuffled', 'success');
      } else if (key === 'swap') {
        setHint(null);
        markReplaced([payload.index]);
        playShuffle();
        setSwapping(null);
        flash(`Swapped in ${payload.letter}`, 'success');
      } else if (key === 'hint') {
        setHint(result.event.hint);
        flash(`Try ${result.event.hint.word}`, 'success');
        later(() => setHint(null), HINT_MS);
      } else if (key === 'extend') {
        // Back to a full turn. Only this device runs this turn's clock, so
        // there is nothing to tell the other players' phones.
        setDeadline(deadlineFrom(TURN_SECONDS));
        flash('Timer reset', 'success');
      }
    },
    [ALL_CELLS, flash, game, later, markReplaced, phase, publish, react],
  );

  const passNow = useCallback(() => {
    if (!game || phase !== 'playing') return;
    setPhase('celebrating'); // close the board before the state catches up
    flash(`${currentPlayer(game).name} passed`);
    const passed = passTurn(game, 'passed');
    publish('pass', { reason: 'passed' }, currentPlayer(game));
    later(() => setGame(passed.state), 400);
  }, [flash, game, later, phase, publish]);

  const beginSwap = useCallback(() => {
    if (!game) return;
    if (currentPlayer(game).gems < ABILITIES.swap.cost) {
      flash(`Swap costs ${ABILITIES.swap.cost} gems`);
      return;
    }
    setSwapping({ index: null });
    flash('Pick a tile to replace');
  }, [flash, game]);

  /* -------------------------------------------------------------- view -- */

  // The player's own finger outranks a hint: once they start tracing, the board
  // has to follow them, or for four seconds their swipe draws nothing.
  const selection = botPath.length
    ? botPath
    : swipe.path.length
      ? swipe.path
      : hint
        ? hint.indices.map(toRowCol)
        : [];

  const currentWord = useMemo(
    () =>
      game && swipe.path.length
        ? swipe.path.map((cell) => game.board.letters[toIndex(cell.row, cell.col)]).join('')
        : '',
    [game, swipe.path],
  );

  // Turns the trail green while the word being traced would actually score.
  const wordWillScore =
    !!game &&
    currentWord.length >= MIN_WORD_LENGTH &&
    !game.usedWords.includes(currentWord) &&
    isValidWord(currentWord);

  const quit = () => {
    clearTimers();
    setPaused(false);
    nav.reset('menu');
  };

  if (!game) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Dealing the board…</Text>
        </View>
      </Screen>
    );
  }

  const round = shown.round;
  const showTimer = !!config?.timerEnabled && phase === 'playing';

  /*
   * The astronaut, in the space above the board (see GameScreen). It watches
   * whatever is being traced - your finger, or a bot playing its word out tile
   * by tile - and looks thoughtful while it is somebody else's turn.
   */
  const band = boardSpace ? (boardSpace.height - layout.frameWidth) / 2 : 0;
  const astronautSize = Math.min(96, Math.floor(band - 4));
  const astronautAbove = astronautSize >= 52;
  const watched = selection.length ? selection[selection.length - 1] : null;
  // Plain, not useMemo: this runs after the early return above, where a hook
  // would change the hook count between renders. Mascot only reads the numbers.
  const gaze = watched ? gazeForCell(watched) : null;
  const astronautMood =
    phase === 'thinking' || phase === 'tracing' || phase === 'waiting'
      ? 'thinking'
      : moodForRound({
          secondsLeft,
          running: showTimer && !paused,
          tracing: swipe.path.length > 0,
        });
  const isHumanTurn = phase === 'playing';

  return (
    <Screen padded={false} stars={settings.reducedMotion ? 0 : 24}>
      <View style={styles.hud}>
        <Pressable
          onPress={pauseGame}
          style={styles.pause}
          accessibilityRole="button"
          accessibilityLabel="Pause game"
        >
          <Text style={styles.pauseIcon}>❚❚</Text>
        </Pressable>

        <MusicButton size={44} />

        <View style={styles.hudCenter}>
          <View style={styles.turnNameRow}>
            {player.isBot && <BotAvatar player={player} size={20} />}
            <Text style={styles.turnName} numberOfLines={1}>
              {player.name}
            </Text>
          </View>
          <Text style={styles.hudLabel}>ROUND {round} OF {game.rounds}</Text>
        </View>

        <View style={styles.hudRight}>
          {showTimer ? (
            <Text style={[styles.timer, secondsLeft <= 5 && styles.timerCritical]}>
              {secondsLeft}s
            </Text>
          ) : (
            <Text style={styles.turnCount}>{shown.turn}/{totalTurns(game)}</Text>
          )}
          <Text style={styles.hudLabel}>{showTimer ? 'LEFT' : 'TURN'}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.railWrap}
        contentContainerStyle={styles.rail}
      >
        {game.players.map((entry, index) => {
          // shown.seat, not the raw turn index: on the finished frame the raw
          // one has wrapped back to seat 0 and would light up the wrong player.
          const active = index === shown.seat;
          return (
            <View key={entry.id} style={[styles.playerChip, active && styles.playerChipActive]}>
              <View style={styles.playerNameRow}>
                {entry.isBot && <BotAvatar player={entry} size={14} />}
                <Text style={[styles.playerName, active && styles.playerNameActive]} numberOfLines={1}>
                  {entry.name}
                </Text>
              </View>
              <View style={styles.playerMeta}>
                <Text style={styles.playerScore}>{entry.score}</Text>
                <View style={styles.gemDot} />
                <Text style={styles.playerGems}>{entry.gems}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.wordBar}>
        {/* Thoughtful while it is somebody else's move - a bot's or, online,
            another player's - and at rest when it is yours. */}
        {!astronautAbove && (
          <Mascot
            size={40}
            mood={astronautMood}
            reaction={mascotReaction}
            lookAt={gaze}
            style={styles.wordMascot}
          />
        )}
        {feedback ? (
          <Text
            style={[
              styles.feedback,
              feedback.tone === 'success' ? styles.feedbackGood : styles.feedbackBad,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {feedback.text}
          </Text>
        ) : currentWord ? (
          <Text style={styles.currentWord} numberOfLines={1} adjustsFontSizeToFit>
            {currentWord}
          </Text>
        ) : (
          <Text style={styles.hint} numberOfLines={1}>
            {phase === 'thinking'
              ? thinkingLine(player)
              : phase === 'tracing'
                ? `${player.name} is playing…`
                : phase === 'waiting'
                  ? `Waiting for ${player.name}…`
                  : swapping
                    ? 'Pick a tile to replace'
                    : 'Swipe letters to spell a word'}
          </Text>
        )}
      </View>

      <View
        style={styles.boardArea}
        onLayout={(event) => setBoardSpace(event.nativeEvent.layout)}
        {...(swapping ? {} : swipe.panHandlers)}
      >
        {astronautAbove && (
          <Mascot
            size={astronautSize}
            mood={astronautMood}
            reaction={mascotReaction}
            lookAt={gaze}
            style={[styles.astronaut, { top: Math.max(0, (band - astronautSize) / 2) }]}
          />
        )}
        <Board
          board={game.board.letters}
          layout={layout}
          selection={selection}
          modifiers={game.board.modifiers}
          gems={game.board.gems}
          popKeys={popKeys}
          replaceKeys={replaceKeys}
          letterValue={slowLetterValue}
          swipe={swipe}
          valid={wordWillScore}
          pathTone={botPath.length ? 'bot' : !swipe.path.length && hint ? 'hint' : undefined}
          reducedMotion={settings.reducedMotion}
          onTilePress={swapping ? (index) => setSwapping({ index }) : undefined}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.gemPurse}>
          <View style={styles.gemDotLarge} />
          <Text style={styles.gemCount}>
            {player.gems}
            <Text style={styles.gemCap}>/{MAX_GEMS}</Text>
          </Text>
        </View>

        {/* Without a clock there is otherwise no way out of a turn nobody can
            see a word in, and the whole game stops on that player. */}
        <Pressable
          onPress={passNow}
          disabled={!isHumanTurn}
          style={[styles.pass, !isHumanTurn && styles.abilityOff]}
          accessibilityRole="button"
          accessibilityLabel="Give up this turn and pass to the next player"
        >
          <Text style={styles.passLabel}>Pass</Text>
        </Pressable>

        <View style={styles.abilities}>
          {ABILITY_ORDER.map((key) => {
            const ability = ABILITIES[key];
            const affordable = player.gems >= ability.cost;
            const usable = isHumanTurn && affordable && !swapping;
            return (
              <Pressable
                key={key}
                onPress={() => (key === 'swap' ? beginSwap() : spend(key))}
                disabled={!usable}
                style={[styles.ability, !usable && styles.abilityOff]}
                accessibilityRole="button"
                accessibilityLabel={`${ability.label}, costs ${ability.cost} gems. ${ability.blurb}`}
              >
                <Text style={styles.abilityIcon}>{ability.icon}</Text>
                <Text style={styles.abilityLabel} numberOfLines={1}>{ability.label}</Text>
                <Text style={styles.abilityCost}>{ability.cost}◆</Text>
              </Pressable>
            );
          })}

          {config?.timerEnabled && (
            <Pressable
              onPress={() => spend('extend')}
              disabled={!isHumanTurn || player.gems < ABILITIES.extend.cost}
              style={[
                styles.ability,
                (!isHumanTurn || player.gems < ABILITIES.extend.cost) && styles.abilityOff,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Reset the turn timer to ${TURN_SECONDS} seconds for ${ABILITIES.extend.cost} gem`}
            >
              <Text style={styles.abilityIcon}>{ABILITIES.extend.icon}</Text>
              <Text style={styles.abilityLabel} numberOfLines={1}>{ABILITIES.extend.label}</Text>
              <Text style={styles.abilityCost}>{ABILITIES.extend.cost}◆</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Confetti burstKey={burst} enabled={!settings.reducedMotion} />

      {/* Pass and play: nobody should start a turn they did not know had begun. */}
      <Sheet
        visible={phase === 'handoff' && !paused}
        title={`Pass to ${player.name}`}
        subtitle={`Round ${round} of ${game.rounds} · ${player.score} points · ${player.gems} gems`}
        dismissable={false}
      >
        <Button label="Start turn" onPress={beginHumanTurn} />
      </Sheet>

      <Sheet
        visible={!!swapping && swapping.index !== null}
        title="Swap in a letter"
        subtitle={`Replacing ${game.board.letters[swapping?.index ?? 0]} · costs ${ABILITIES.swap.cost} gems`}
        onRequestClose={() => setSwapping(null)}
      >
        <View style={styles.keyboard}>
          {LETTER_ROWS.map((row) => (
            <View key={row} style={styles.keyRow}>
              {row.split('').map((letter) => (
                <Pressable
                  key={letter}
                  onPress={() => spend('swap', { index: swapping.index, letter })}
                  style={styles.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Swap in ${letter}`}
                >
                  <Text style={styles.keyText}>{letter}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        <Button label="Cancel" variant="ghost" onPress={() => setSwapping(null)} />
      </Sheet>

      {/* onRequestClose covers both the backdrop tap and Android back, and both
          are a resume - calling setPaused directly there would skip rebuilding
          the turn clock and re-dealing an interrupted bot turn. */}
      <Sheet
        visible={paused}
        title="Paused"
        subtitle={`${player.name} · round ${round} of ${game.rounds}`}
        onRequestClose={resumeGame}
      >
        <Button label="Resume" onPress={resumeGame} />
        <Button label="End game" variant="danger" onPress={quit} />
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  loadingText: {
    color: colors.text, fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: 1.5,
  },

  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.md,
  },
  pause: {
    width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  pauseIcon: { color: colors.text, fontSize: 15, letterSpacing: 1 },
  hudCenter: { flex: 1, alignItems: 'center' },
  hudRight: { minWidth: 64, alignItems: 'flex-end' },
  turnName: {
    color: colors.text, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1, flexShrink: 1,
  },
  turnCount: { color: colors.textDim, fontFamily: fonts.display, fontSize: 18 },
  timer: { color: colors.accent, fontFamily: fonts.display, fontSize: 22 },
  timerCritical: { color: colors.danger },
  hudLabel: {
    color: colors.textFaint, fontFamily: fonts.body, fontSize: 9,
    letterSpacing: 2, marginTop: 2,
  },

  railWrap: { maxHeight: 58, flexGrow: 0 },
  rail: { gap: space.sm, paddingHorizontal: space.lg, alignItems: 'center' },
  playerChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 84,
  },
  playerChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  playerName: {
    color: colors.textDim, fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.4, flexShrink: 1,
  },
  playerNameActive: { color: colors.text },
  playerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  playerScore: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 13 },
  playerGems: { color: colors.gem, fontFamily: fonts.bodySemi, fontSize: 11 },
  gemDot: {
    width: 7, height: 7, backgroundColor: colors.gem,
    transform: [{ rotate: '45deg' }], marginLeft: 3,
  },

  // Padded symmetrically past the mascot, so the text stays centred and a long
  // feedback line shrinks before it can run underneath it.
  wordBar: {
    height: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 58,
  },
  wordMascot: { position: 'absolute', left: space.md, top: 3 },
  turnNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  currentWord: {
    color: colors.text, fontFamily: fonts.display, fontSize: 24, letterSpacing: 4,
  },
  feedback: { fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.8 },
  feedbackGood: { color: colors.success },
  feedbackBad: { color: colors.danger },
  hint: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },

  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  astronaut: { position: 'absolute', right: space.md },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    minHeight: 72,
  },
  gemPurse: { alignItems: 'center', minWidth: 44 },
  gemDotLarge: {
    width: 14, height: 14, backgroundColor: colors.gem,
    transform: [{ rotate: '45deg' }], marginBottom: 6,
  },
  gemCount: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 14 },
  gemCap: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10 },

  // The buttons SHARE what is left rather than each insisting on a width:
  // with the turn timer on there are four, and at fixed widths they overflowed
  // leftwards straight over the Pass button on an ordinary phone.
  abilities: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  ability: {
    flex: 1,
    minWidth: 0,
    maxWidth: 72,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primaryEdge,
  },
  abilityOff: { opacity: 0.35 },
  pass: {
    minHeight: 44,
    flexShrink: 0,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passLabel: { color: colors.textDim, fontFamily: fonts.bodySemi, fontSize: 12 },
  abilityIcon: { color: colors.text, fontSize: 15 },
  abilityLabel: {
    color: colors.text, fontFamily: fonts.bodySemi, fontSize: 10, marginTop: 1,
  },
  abilityCost: { color: colors.gem, fontFamily: fonts.bodySemi, fontSize: 10, marginTop: 1 },

  keyboard: { gap: space.sm },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  key: {
    width: 30, height: 38, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  keyText: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 14 },
});

export default SlowGameScreen;
