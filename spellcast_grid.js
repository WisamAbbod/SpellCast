import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, TouchableOpacity, Alert } from 'react-native';
import { styles } from './styles.js';
import {
  GRID_SIZE,
  GAME_DURATION,
  MIN_WORD_LENGTH,
  isValidWord,
} from './game_constants.js';
import {
  generateTestGrid,
  calculateScore,
  formatTime,
} from './game_utils.js';
import StarField from './starfield_component.js'; // Import the reusable StarField component
import { useSwipeSelection } from './swipe_selection.js';
import SwipePath from './swipe_path.js';

const SpellcastGrid = ({ goToMenu }) => {
  // State management
  const [gridData, setGridData] = useState(generateTestGrid());
  const [savedWords, setSavedWords] = useState([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameActive, setGameActive] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [multiplierCell, setMultiplierCell] = useState(null); // New state for 2x cell
  const [feedback, setFeedback] = useState(null); // { text, tone }

  // Refs
  const scaleAnims = useRef(
    Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => new Animated.Value(1)),
    ),
  ).current;
  const popAnims = useRef(
    Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => new Animated.Value(1)),
    ),
  ).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const gridDataRef = useRef(gridData);
  const timerRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  useEffect(() => {
    gridDataRef.current = gridData;
  }, [gridData]);

  const flashFeedback = (text, tone = 'error') => {
    setFeedback({ text, tone });
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 1300);
  };

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  // Check if a cell is the multiplier cell
  const isMultiplierCell = (row, col) =>
    !!multiplierCell && multiplierCell.row === row && multiplierCell.col === col;

  // Generate random multiplier cell
  const generateMultiplierCell = () => {
    setMultiplierCell({
      row: Math.floor(Math.random() * GRID_SIZE),
      col: Math.floor(Math.random() * GRID_SIZE),
    });
  };

  // Calculate score with multiplier
  const calculateScoreWithMultiplier = (word, usedMultiplier) => {
    const baseScore = calculateScore(word);
    return usedMultiplier ? baseScore * 2 : baseScore;
  };

  /* ------------------------------------------------------------- swipe -- */

  // Called once, when the finger lifts, with the cells that were traced.
  const handleWordSubmitted = (cells) => {
    const grid = gridDataRef.current;
    const word = cells
      .map(({ row, col }) => grid[row]?.[col] ?? '')
      .join('')
      .toUpperCase();

    if (word.length < MIN_WORD_LENGTH) {
      if (word.length > 1) flashFeedback(`${MIN_WORD_LENGTH} letters minimum`);
      return;
    }
    if (savedWords.includes(word)) {
      flashFeedback(`${word} already found`);
      return;
    }
    if (!isValidWord(word)) {
      flashFeedback(`${word} isn't in the dictionary`);
      return;
    }

    const usedMultiplier = cells.some(({ row, col }) => isMultiplierCell(row, col));
    const wordScore = calculateScoreWithMultiplier(word, usedMultiplier);

    setSavedWords((previous) => [...previous, word]);
    setScore((previous) => previous + wordScore);
    flashFeedback(`${word}  +${wordScore}${usedMultiplier ? '  2X!' : ''}`, 'success');

    // Celebration pop on the letters that made the word.
    cells.forEach(({ row, col }) => {
      Animated.sequence([
        Animated.timing(popAnims[row][col], {
          toValue: isMultiplierCell(row, col) ? 1.45 : 1.28,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(popAnims[row][col], {
          toValue: 1,
          friction: 4,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    });

    if (usedMultiplier) {
      setTimeout(generateMultiplierCell, 400);
    }
  };

  const {
    panHandlers,
    path,
    clearSelection,
    gridRef,
    onGridLayout,
    onCellLayout,
    getCellCenter,
    subscribeToLivePoint,
    geometryVersion,
  } = useSwipeSelection({
    enabled: gameActive,
    onCommit: handleWordSubmitted,
  });

  // Animate tiles as they join / leave the current selection.
  const previousPathRef = useRef([]);
  useEffect(() => {
    const key = (cell) => `${cell.row},${cell.col}`;
    const previousKeys = new Set(previousPathRef.current.map(key));
    const currentKeys = new Set(path.map(key));

    const animate = ({ row, col }, toValue, duration) => {
      Animated.timing(scaleAnims[row][col], {
        toValue,
        duration,
        useNativeDriver: true,
      }).start();
    };

    path.forEach((cell) => {
      if (!previousKeys.has(key(cell))) animate(cell, 1.12, 90);
    });
    previousPathRef.current.forEach((cell) => {
      if (!currentKeys.has(key(cell))) animate(cell, 1, 140);
    });

    previousPathRef.current = path;
  }, [path, scaleAnims]);

  // Never leave a half-drawn word behind when play stops.
  useEffect(() => {
    if (!gameActive) clearSelection();
  }, [gameActive, clearSelection]);

  const currentWord = useMemo(
    () => path.map(({ row, col }) => gridData[row]?.[col] ?? '').join(''),
    [path, gridData],
  );
  const currentWordIsValid =
    isValidWord(currentWord) && !savedWords.includes(currentWord.toUpperCase());
  const currentWordUsesMultiplier = path.some(({ row, col }) =>
    isMultiplierCell(row, col),
  );

  /* -------------------------------------------------------------- game -- */

  // Pulse animation for timer warning
  useEffect(() => {
    if (timeLeft <= 10 && gameActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [timeLeft, gameActive]);

  // Timer effect
  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft((previous) => previous - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameActive) {
      endGame();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeLeft, gameActive]);

  const startGame = () => {
    setGameActive(true);
    setGameStarted(true);
    setTimeLeft(GAME_DURATION);
    setSavedWords([]);
    setScore(0);
    setFeedback(null);
    shuffleGrid();
    generateMultiplierCell(); // Generate initial multiplier cell
  };

  const endGame = () => {
    setGameActive(false);
    Alert.alert(
      "🎉 Game Complete!",
      `Amazing work!\n\n🎯 Words Found: ${savedWords.length}\n⭐ Final Score: ${score}\n\nReady for another round?`,
      [
        { text: "🚀 Play Again", onPress: startGame },
        { text: "🏠 Main Menu", onPress: goToMenu }
      ]
    );
  };

  const pauseGame = () => {
    setGameActive(false);
    Alert.alert(
      "⏸️ Game Paused",
      `Time Remaining: ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`,
      [
        { text: "▶️ Resume", onPress: () => setGameActive(true) },
        { text: "🏠 Main Menu", onPress: goToMenu }
      ]
    );
  };

  const shuffleGrid = () => {
    clearSelection();
    setGridData(generateTestGrid());

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        scaleAnims[row][col].setValue(1);
        popAnims[row][col].setValue(1);
      }
    }

    // Generate new multiplier cell after shuffle
    if (gameActive) {
      generateMultiplierCell();
    }
  };

  // Show start screen if game hasn't started
  if (!gameStarted) {
    return (
      <View style={styles.modernBackground}>
        <StarField numStars={50} intensity={0.8} />
        <View style={styles.startContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.modernTitle}>SpellCast</Text>
            <Text style={styles.titleGlow}>SpellCast</Text>
          </View>
          <Text style={styles.startSubtitle}>✨ Find words in the cosmic grid ✨</Text>
          <Text style={styles.startDescription}>
            Swipe to connect letters • 60 seconds • Look for 2X multiplier cells! 🔥
          </Text>

          <TouchableOpacity
            onPress={startGame}
            style={styles.modernStartButton}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>🚀 Start Adventure</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goToMenu}
            style={styles.modernBackButton}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>← Back to Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.modernBackground} {...panHandlers}>
      <View style={styles.gameContainer}>
        <View style={styles.modernHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.modernGameTitle}>SpellCast</Text>
          </View>

          <View style={styles.headerCenter}>
            <Animated.View style={[styles.timerContainer, { transform: [{ scale: timeLeft <= 10 ? pulseAnim : 1 }] }]}>
              <Text style={[styles.modernTimer, timeLeft <= 10 ? styles.timerCritical : null]}>
                {formatTime(timeLeft)}
              </Text>
            </Animated.View>
            <View style={styles.scoreContainer}>
              <Text style={styles.modernScore}>{score.toLocaleString()}</Text>
              <Text style={styles.scoreLabel}>POINTS</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={pauseGame}
            style={styles.modernPauseButton}
            activeOpacity={0.7}
          >
            <Text style={styles.pauseIcon}>⏸️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modernGrid}>
          {/* One flat, measured surface: the swipe engine owns its geometry. */}
          <View
            ref={gridRef}
            onLayout={onGridLayout}
            collapsable={false}
            style={styles.gridSurface}
          >
            <SwipePath
              path={path}
              getCellCenter={getCellCenter}
              subscribeToLivePoint={subscribeToLivePoint}
              geometryVersion={geometryVersion}
              valid={currentWordIsValid}
            />

            {gridData.map((row, rowIndex) =>
              row.map((letter, colIndex) => {
                const isSelected = path.some(
                  (cell) => cell.row === rowIndex && cell.col === colIndex,
                );
                const isMultiplier = isMultiplierCell(rowIndex, colIndex);

                return (
                  <Animated.View
                    key={`${rowIndex}-${colIndex}`}
                    onLayout={onCellLayout(rowIndex, colIndex)}
                    style={[
                      styles.modernCell,
                      isSelected ? styles.selectedCell : null,
                      isMultiplier ? styles.multiplierCell : null,
                      {
                        transform: [
                          { scale: scaleAnims[rowIndex][colIndex] },
                          { scale: popAnims[rowIndex][colIndex] },
                        ],
                      },
                    ]}
                  >
                    <Text style={[
                      styles.modernLetter,
                      isSelected ? styles.selectedLetter : null,
                      isMultiplier ? styles.multiplierLetter : null
                    ]}>
                      {letter}
                    </Text>
                    {isSelected && <View style={styles.cellGlow} />}
                    {isMultiplier && <View style={styles.multiplierGlow} />}
                    {isMultiplier && (
                      <View style={styles.multiplierBadge}>
                        <Text style={styles.multiplierText}>2X</Text>
                      </View>
                    )}
                  </Animated.View>
                );
              }),
            )}
          </View>
        </View>
      </View>

      {/* Current Word Display */}
      <View style={styles.currentWordContainer}>
        <Text style={styles.currentWordLabel}>CURRENT WORD</Text>
        <Text
          style={[
            styles.currentWord,
            currentWordIsValid ? styles.currentWordValid : null,
          ]}
        >
          {currentWord || '- - -'}
        </Text>
        {currentWordUsesMultiplier && (
          <Text style={styles.multiplierIndicator}>🔥 2X MULTIPLIER! 🔥</Text>
        )}
        {feedback && (
          <Text
            style={[
              styles.feedbackText,
              feedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError,
            ]}
          >
            {feedback.text}
          </Text>
        )}
      </View>

      {/* Found Words Panel */}
      {savedWords.length > 0 && (
        <View style={styles.wordsPanel}>
          <View style={styles.wordsPanelHeader}>
            <Text style={styles.wordsPanelTitle}>Found Words</Text>
            <Text style={styles.wordCount}>{savedWords.length}</Text>
          </View>
          <View style={styles.wordsList}>
            {savedWords.slice(-6).map((word, index) => (
              <View key={index} style={styles.wordChip}>
                <Text style={styles.wordText}>{word}</Text>
                <Text style={styles.wordScore}>+{calculateScore(word)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default SpellcastGrid;
