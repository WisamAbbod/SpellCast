import React, { useState, useRef, useEffect } from 'react';
import { View, Text, PanResponder, Animated, TouchableOpacity, Alert } from 'react-native';
import { styles } from 'C:/Users/Wisam/SpellCast/styles.js';
import { 
  GRID_SIZE, 
  GAME_DURATION, 
  HITBOX_SCALE, 
  wordList 
} from 'C:/Users/Wisam/SpellCast/game_constants.js';
import { 
  generateTestGrid, 
  calculateScore, 
  formatTime, 
  isAdjacent, 
  isAlreadySelected 
} from 'C:/Users/Wisam/SpellCast/game_utils.js';
import StarField from 'C:/Users/Wisam/SpellCast/starfield_component.js'; // Import the reusable StarField component

const SpellcastGrid = ({ goToMenu }) => {
  // State management
  const [gridData, setGridData] = useState(generateTestGrid());
  const [selectedCells, setSelectedCells] = useState([]);
  const [trail, setTrail] = useState([]);
  const [savedWords, setSavedWords] = useState([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameActive, setGameActive] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [multiplierCell, setMultiplierCell] = useState(null); // New state for 2x cell
  
  // Refs
  const fadeAnims = useRef(gridData.map(row => row.map(() => new Animated.Value(1)))).current;
  const scaleAnims = useRef(gridData.map(row => row.map(() => new Animated.Value(1)))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const gridLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const selectedCellsRef = useRef([]);
  const timerRef = useRef(null);

  // Update ref when selectedCells changes
  useEffect(() => {
    selectedCellsRef.current = selectedCells;
  }, [selectedCells]);

  // Generate random multiplier cell
  const generateMultiplierCell = () => {
    const row = Math.floor(Math.random() * GRID_SIZE);
    const col = Math.floor(Math.random() * GRID_SIZE);
    setMultiplierCell({ row, col });
  };

  // Check if a cell is the multiplier cell
  const isMultiplierCell = (row, col) => {
    return multiplierCell && multiplierCell.row === row && multiplierCell.col === col;
  };

  // Calculate score with multiplier
  const calculateScoreWithMultiplier = (word, usedMultiplier) => {
    const baseScore = calculateScore(word);
    return usedMultiplier ? baseScore * 2 : baseScore;
  };

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
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [timeLeft, gameActive]);

  // Timer effect
  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
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
    const newGrid = generateTestGrid();
    setGridData(newGrid);
    setSelectedCells([]);
    
    newGrid.forEach((row, rowIndex) => {
      row.forEach((_, colIndex) => {
        fadeAnims[rowIndex][colIndex].setValue(1);
        scaleAnims[rowIndex][colIndex].setValue(1);
      });
    });
    
    // Generate new multiplier cell after shuffle
    if (gameActive) {
      generateMultiplierCell();
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => gameActive,
    onMoveShouldSetPanResponder: () => gameActive,
    
    onPanResponderGrant: (event, gestureState) => {
      if (gameActive) {
        handleSelection(gestureState.x0, gestureState.y0, true);
      }
    },
    
    onPanResponderMove: (event, gestureState) => {
      if (gameActive) {
        handleSelection(gestureState.moveX, gestureState.moveY, false);
        
        const { moveX, moveY } = gestureState;
        const newTrailPoint = {
          id: Date.now(),
          x: moveX,
          y: moveY,
          opacity: new Animated.Value(1),
          scale: new Animated.Value(1),
        };
        
        // Enhanced trail animation
        Animated.parallel([
          Animated.timing(newTrailPoint.opacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(newTrailPoint.scale, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          })
        ]).start(() => {
          setTrail(prev => prev.filter(p => p.id !== newTrailPoint.id));
        });
        
        setTrail(prev => [...prev, newTrailPoint]);
      }
    },
    
    onPanResponderRelease: () => {
      if (gameActive) {
        const currentWord = selectedCellsRef.current.map(cell => cell.letter).join('');
        if (currentWord.length >= 3 && wordList.includes(currentWord.toUpperCase()) && !savedWords.includes(currentWord.toUpperCase())) {
          // Check if word uses multiplier cell
          const usedMultiplier = selectedCells.some(cell => 
            isMultiplierCell(cell.row, cell.col)
          );
          
          const wordScore = calculateScoreWithMultiplier(currentWord, usedMultiplier);
          setSavedWords(prev => [...prev, currentWord.toUpperCase()]);
          setScore(prev => prev + wordScore);
          
          console.log(`Valid word found: ${currentWord} (${wordScore} points)${usedMultiplier ? ' - 2X MULTIPLIER!' : ''}`);
          
          // Success animation
          selectedCells.forEach(({ row, col }) => {
            const isMultiplier = isMultiplierCell(row, col);
            Animated.sequence([
              Animated.timing(scaleAnims[row][col], {
                toValue: isMultiplier ? 1.5 : 1.3, // Bigger animation for multiplier
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnims[row][col], {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              })
            ]).start();
          });
          
          // If multiplier was used, generate new one
          if (usedMultiplier) {
            setTimeout(() => {
              generateMultiplierCell();
            }, 500);
          }
        }
        
        resetAnimations();
      }
    },
  });

  const handleSelection = (x, y, isFirst) => {
    const { y: gridY, width } = gridLayout.current;
    const gridX = gridLayout.current.x;
    const cellSize = width / GRID_SIZE;
    
    // Calculate center of each cell
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const centerX = gridX + col * cellSize + cellSize / 2;
        const centerY = gridY + 370 + row * cellSize + cellSize / 2;
        
        // Distance from touch to cell center
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        
        // Only register if within hitbox radius
        if (distance < cellSize * HITBOX_SCALE / 2) {
          const newCell = { row, col, letter: gridData[row][col] };
          const lastCell = selectedCells[selectedCells.length - 1];
          
          if (isFirst || (isAdjacent(lastCell, newCell) && !isAlreadySelected(newCell, selectedCells))) {
            setSelectedCells(prev => [...prev, newCell]);
            
            // Enhanced selection animation
            Animated.parallel([
              Animated.timing(fadeAnims[row][col], {
                toValue: 0.3,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnims[row][col], {
                toValue: 1.1,
                duration: 100,
                useNativeDriver: true,
              })
            ]).start();
            return;
          }
        }
      }
    }
  };

  const resetAnimations = () => {
    selectedCells.forEach(({ row, col }) => {
      Animated.parallel([
        Animated.timing(fadeAnims[row][col], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnims[row][col], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    });
    setSelectedCells([]);
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
    <View style={styles.modernBackground} {...panResponder.panHandlers}>
     
      <View
        style={styles.gameContainer}
        onLayout={(event) => {
          gridLayout.current = event.nativeEvent.layout;
        }}
      >
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
          {gridData.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {row.map((letter, colIndex) => {
                const isSelected = selectedCells.some(cell => cell.row === rowIndex && cell.col === colIndex);
                const isMultiplier = isMultiplierCell(rowIndex, colIndex);
                
                return (
                  <Animated.View 
                    key={colIndex} 
                    style={[
                      styles.modernCell,
                      isSelected ? styles.selectedCell : null,
                      isMultiplier ? styles.multiplierCell : null,
                      { 
                        opacity: fadeAnims[rowIndex][colIndex],
                        transform: [{ scale: scaleAnims[rowIndex][colIndex] }]
                      }
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
              })}
            </View>
          ))}
        </View>
      </View>
      
      {/* Enhanced Trail Effect */}
      {trail.map((point) => (
        <Animated.View
          key={point.id}
          style={[
            styles.modernTrailPoint,
            {
              left: point.x - 15,
              top: point.y - 15,
              opacity: point.opacity,
              transform: [{ scale: point.scale }]
            }
          ]}
        />
      ))}

      {/* Current Word Display */}
      <View style={styles.currentWordContainer}>
        <Text style={styles.currentWordLabel}>CURRENT WORD</Text>
        <Text style={styles.currentWord}>
          {selectedCells.map(cell => cell.letter).join('') || '- - -'}
        </Text>
        {selectedCells.some(cell => isMultiplierCell(cell.row, cell.col)) && (
          <Text style={styles.multiplierIndicator}>🔥 2X MULTIPLIER! 🔥</Text>
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