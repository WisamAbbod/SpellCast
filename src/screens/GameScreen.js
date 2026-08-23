import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
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
import MuteButton from '../components/MuteButton.js';
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
import { cellsToIndices, toIndex } from '../game/board.js';
import { getBoard } from '../game/generator.js';
import { generateBonusCells } from '../game/bonusCells.js';
import { MAX_WORD_LENGTH, isValidWord } from '../game/dictionary.js';
import { comboMultiplier, letterScore, scoreWord } from '../game/scoring.js';
import { deadlineFrom, formatTime, resumeDeadline } from '../game/time.js';
import { shuffleSeed } from '../game/daily.js';
import {
  COMBO_WINDOW_MS, GAME_DURATION, MIN_WORD_LENGTH,
  SHUFFLES_PER_ROUND, SHUFFLE_COOLDOWN_MS,
} from '../game/rules.js';
import { buildResult, finishRound } from '../session/round.js';
import { checkpointDaily, startDailyAttempt } from '../storage/dailyResults.js';

const CHECKPOINT_MS = 5000;

/**
 * A round of SpellCast.
 *
 * Params: { mode: 'daily' | 'practice', dateKey, seed, cellSeed, resume }
 *
 * Board generation happens in an effect, never during render - the old screen
 * called the generator inside useState(), which re-ran it on every single
 * render. That cost nothing when it was a handful of Math.random() calls and
 * would cost ~40ms a frame now.
 */
const GameScreen = ({ nav, mode = 'practice', dateKey, seed, cellSeed, resume }) => {
  const settings = useSettings();
  const layout = useBoardLayout();

  const [boardData, setBoardData] = useState(null);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [deadline, setDeadline] = useState(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [found, setFound] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [popKeys, setPopKeys] = useState({});
  const [burst, setBurst] = useState(0);
  const [combo, setCombo] = useState(0);
  const [shufflesLeft, setShufflesLeft] = useState(SHUFFLES_PER_ROUND);
  const [shuffleReadyAt, setShuffleReadyAt] = useState(0);
  const [generationMs, setGenerationMs] = useState(0);

  const foundRef = useRef([]);
  const scoreRef = useRef(0);
  const bestRef = useRef({ word: null, score: 0 });
  const comboRef = useRef({ chain: 0, at: 0 });
  const finishedRef = useRef(false);
  const feedbackTimer = useRef(null);
  const popCounter = useRef(0);
  // The clock goes through a ref so the checkpoint interval isn't torn down and
  // rebuilt every second.
  const secondsRef = useRef(0);

  const bonus = useMemo(() => (cellSeed ? generateBonusCells(cellSeed) : null), [cellSeed]);

  /* ------------------------------------------------------------- board -- */

  const activeSeed = shuffleIndex === 0 ? seed : shuffleSeed(seed, shuffleIndex);

  useEffect(() => {
    let cancelled = false;
    setBoardData(null);

    // Two frames after the transition settles, so the screen has painted before
    // the generator takes the thread.
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const started = Date.now();
          const generated = getBoard(activeSeed);
          if (cancelled) return;
          setGenerationMs(Date.now() - started);
          setBoardData(generated);
        }),
      );
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [activeSeed]);

  /* ------------------------------------------------------------ start -- */

  useEffect(() => {
    if (!boardData || deadline) return;

    const begin = async () => {
      if (mode === 'daily' && dateKey) {
        const record = await startDailyAttempt(dateKey, boardData);
        if (resume && record?.checkpoint) {
          scoreRef.current = record.checkpoint.score;
          foundRef.current = record.checkpoint.words || [];
          setScore(record.checkpoint.score);
          setFound(record.checkpoint.words || []);
          setDeadline(resumeDeadline(record.checkpoint.secondsLeft));
          setRunning(true);
          startMusic();
          return;
        }
      }
      setDeadline(deadlineFrom(GAME_DURATION));
      setRunning(true);
      playStart();
      startMusic();
    };

    begin();
  }, [boardData, dateKey, deadline, mode, resume]);

  /* ------------------------------------------------------------ timer -- */

  const handleExpire = useCallback(() => {
    if (finishedRef.current || !boardData) return;
    finishedRef.current = true;
    setRunning(false);
    playGameOver();

    const result = buildResult({
      mode,
      dateKey,
      board: boardData,
      score: scoreRef.current,
      words: foundRef.current,
      bestWord: bestRef.current.word,
      bestWordScore: bestRef.current.score,
    });

    finishRound(result).then((outcome) => {
      nav.replace('results', { outcome, board: boardData, seed, cellSeed, dateKey, mode });
    });
  }, [boardData, cellSeed, dateKey, mode, nav, seed]);

  const secondsLeft = useCountdown(deadline, {
    running: running && !paused,
    onExpire: handleExpire,
    onTick: (left) => {
      secondsRef.current = left;
      if (left <= 10 && left > 0) playTick();
    },
  });

  /* ------------------------------------------------------- checkpoint -- */

  useEffect(() => {
    if (mode !== 'daily' || !dateKey || !running || paused) return undefined;
    const interval = setInterval(() => {
      checkpointDaily(dateKey, {
        score: scoreRef.current,
        words: foundRef.current,
        secondsLeft: secondsRef.current,
      });
    }, CHECKPOINT_MS);
    return () => clearInterval(interval);
  }, [dateKey, mode, paused, running]);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const flash = useCallback((text, tone = 'error') => {
    setFeedback({ text, tone });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1400);
  }, []);

  /* ------------------------------------------------------------ words -- */

  const handleCommit = useCallback(
    (cells) => {
      if (!boardData || !running || paused) return;

      const indices = cellsToIndices(cells);
      const word = indices.map((index) => boardData.board[index]).join('');

      if (word.length < MIN_WORD_LENGTH) {
        if (word.length > 1) flash(`${MIN_WORD_LENGTH} letters minimum`);
        return;
      }
      if (word.length > MAX_WORD_LENGTH) {
        flash(`${MAX_WORD_LENGTH} letters maximum`);
        return;
      }
      if (foundRef.current.includes(word)) {
        flash(`${word} already found`);
        playInvalid();
        return;
      }
      if (!isValidWord(word)) {
        flash(`${word} isn't a word`);
        playInvalid();
        return;
      }

      const now = Date.now();
      const chain =
        now - comboRef.current.at <= COMBO_WINDOW_MS ? comboRef.current.chain + 1 : 0;
      comboRef.current = { chain, at: now };

      const scored = scoreWord(word, indices, bonus, chain);

      foundRef.current = [...foundRef.current, word];
      scoreRef.current += scored.score;
      if (scored.score > bestRef.current.score) {
        bestRef.current = { word, score: scored.score };
      }

      setFound(foundRef.current);
      setScore(scoreRef.current);
      setCombo(chain);

      const label = [
        `${word}  +${scored.score}`,
        scored.usedWordMultiplier ? '2x WORD' : null,
        scored.usedLetterBonus ? '3x LETTER' : null,
        chain > 0 ? `${scored.combo.toFixed(2)}x COMBO` : null,
      ]
        .filter(Boolean)
        .join('   ');
      flash(label, 'success');

      // Bump each tile's pop counter so only the tiles in this word animate.
      popCounter.current += 1;
      const stamp = popCounter.current;
      setPopKeys((previous) => {
        const next = { ...previous };
        indices.forEach((index) => {
          next[index] = stamp;
        });
        return next;
      });

      playWord(scored.combo);
      if (word.length >= 6 || scored.usedWordMultiplier) setBurst((value) => value + 1);
    },
    [boardData, bonus, flash, paused, running],
  );

  const swipe = useSwipeSelection({
    enabled: !!boardData && running && !paused,
    onCommit: handleCommit,
    onSelect: useCallback((path, grew) => {
      if (grew) playSelect(path.length);
    }, []),
  });

  const clearSelection = swipe.clearSelection;
  useEffect(() => {
    if (!running || paused) clearSelection();
  }, [clearSelection, paused, running]);

  /* ---------------------------------------------------------- shuffle -- */

  const shuffleNow = useCallback(() => {
    if (shufflesLeft <= 0 || Date.now() < shuffleReadyAt) return;
    setShufflesLeft((left) => left - 1);
    setShuffleReadyAt(Date.now() + SHUFFLE_COOLDOWN_MS);
    setShuffleIndex((index) => index + 1);
    playShuffle();
  }, [shuffleReadyAt, shufflesLeft]);

  const shuffleReady = shufflesLeft > 0 && Date.now() >= shuffleReadyAt;

  /* ------------------------------------------------------------- view -- */

  const currentWord = useMemo(
    () =>
      boardData
        ? swipe.path.map((cell) => boardData.board[toIndex(cell.row, cell.col)]).join('')
        : '',
    [boardData, swipe.path],
  );

  const currentIsValid =
    currentWord.length >= MIN_WORD_LENGTH &&
    !foundRef.current.includes(currentWord) &&
    isValidWord(currentWord);

  const quit = () => {
    setPaused(false);
    nav.pop();
  };

  if (!boardData) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparing board…</Text>
          <Text style={styles.loadingHint}>
            Every board is checked for good words before you see it
          </Text>
        </View>
      </Screen>
    );
  }

  const critical = secondsLeft <= 10;

  return (
    <Screen padded={false} stars={settings.reducedMotion ? 0 : 30}>
      <View style={styles.hud}>
        <Pressable
          onPress={() => setPaused(true)}
          style={styles.pause}
          accessibilityRole="button"
          accessibilityLabel="Pause game"
        >
          <Text style={styles.pauseIcon}>❚❚</Text>
        </Pressable>

        <MuteButton size={44} />

        <View style={styles.hudCenter}>
          <Text style={[styles.timer, critical && styles.timerCritical]}>
            {formatTime(secondsLeft)}
          </Text>
          <Text style={styles.hudLabel}>
            {mode === 'daily' ? 'DAILY' : 'PRACTICE'}
          </Text>
        </View>

        <View style={styles.hudRight}>
          <Text style={styles.score} numberOfLines={1} adjustsFontSizeToFit>
            {score.toLocaleString()}
          </Text>
          <Text style={styles.hudLabel}>POINTS</Text>
        </View>
      </View>

      <View style={styles.wordBar}>
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
          <Text
            style={[styles.currentWord, currentIsValid && styles.currentWordValid]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {currentWord}
          </Text>
        ) : (
          <Text style={styles.hint}>
            {combo > 0
              ? `${comboMultiplier(combo).toFixed(2)}x combo — keep going!`
              : 'Swipe letters to spell a word'}
          </Text>
        )}
      </View>

      <View style={styles.boardArea} {...swipe.panHandlers}>
        <Board
          board={boardData.board}
          layout={layout}
          selection={swipe.path}
          bonus={bonus}
          letterValue={letterScore}
          popKeys={popKeys}
          swipe={swipe}
          valid={currentIsValid}
          reducedMotion={settings.reducedMotion}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={shuffleNow}
          disabled={!shuffleReady}
          style={[styles.shuffle, !shuffleReady && styles.shuffleDisabled]}
          accessibilityRole="button"
          accessibilityLabel={`Shuffle board, ${shufflesLeft} left`}
        >
          <Text style={styles.shuffleIcon}>⇄</Text>
          <Text style={styles.shuffleLabel}>{shufflesLeft}</Text>
        </Pressable>

        <View style={styles.foundArea}>
          <Text style={styles.foundCount}>
            {found.length} word{found.length === 1 ? '' : 's'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {found.length === 0 ? (
              <Text style={styles.foundEmpty}>Nothing yet</Text>
            ) : (
              [...found].reverse().map((word) => (
                <View key={word} style={styles.chip}>
                  <Text style={styles.chipText}>{word}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <Confetti burstKey={burst} enabled={!settings.reducedMotion} />

      <Sheet
        visible={paused}
        title="Paused"
        subtitle={`${formatTime(secondsLeft)} left · ${score.toLocaleString()} points`}
        onRequestClose={() => setPaused(false)}
      >
        <Button
          label="Resume"
          onPress={() => {
            // Rebuild the deadline so pausing doesn't cost the player time.
            setDeadline(resumeDeadline(secondsLeft));
            setPaused(false);
          }}
        />
        <Button label="Give up" variant="danger" onPress={handleExpire} />
        <Button label="Back to menu" variant="ghost" onPress={quit} />
        {__DEV__ && generationMs > 0 && (
          <Text style={styles.debug}>board generated in {generationMs}ms</Text>
        )}
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  loadingText: {
    color: colors.text, fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: 1.5,
  },
  loadingHint: {
    color: colors.textFaint, fontFamily: fonts.body, fontSize: 12,
    textAlign: 'center', paddingHorizontal: space.xxl,
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
  hudRight: { minWidth: 84, alignItems: 'flex-end' },
  timer: {
    color: colors.text, fontFamily: fonts.display, fontSize: 30, letterSpacing: 1,
  },
  timerCritical: { color: colors.danger },
  score: { color: colors.accent, fontFamily: fonts.display, fontSize: 22 },
  hudLabel: {
    color: colors.textFaint, fontFamily: fonts.body, fontSize: 9,
    letterSpacing: 2, marginTop: 2,
  },

  wordBar: {
    height: 54, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  currentWord: {
    color: colors.text, fontFamily: fonts.display, fontSize: 26, letterSpacing: 4,
  },
  currentWordValid: { color: colors.success },
  feedback: { fontFamily: fonts.bodyBold, fontSize: 15, letterSpacing: 0.8 },
  feedbackGood: { color: colors.success },
  feedbackBad: { color: colors.danger },
  hint: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },

  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    minHeight: 76,
  },
  shuffle: {
    width: 52, height: 52, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryDim,
    borderWidth: 1, borderColor: colors.primaryEdge,
  },
  shuffleDisabled: { opacity: 0.35 },
  shuffleIcon: { color: colors.text, fontSize: 20 },
  shuffleLabel: { color: colors.textDim, fontFamily: fonts.body, fontSize: 10 },

  foundArea: { flex: 1 },
  foundCount: {
    color: colors.textFaint, fontFamily: fonts.body, fontSize: 10,
    letterSpacing: 1.4, marginBottom: 4,
  },
  chips: { gap: 6, alignItems: 'center', paddingRight: space.lg },
  chip: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.primaryEdge,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.6 },
  foundEmpty: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12 },

  debug: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 10, textAlign: 'center' },
});

export default GameScreen;
