import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ImageBackground, PanResponder, Animated, Dimensions, TouchableOpacity, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Game constants
const GRID_SIZE = 5; // 5x5 grid
const CELL_SIZE = 55; // Size of each cell in pixels
const CELL_MARGIN = 15; // Margin between cells
const HITBOX_SCALE = 0.8; // 80% of cell size for hitbox
const SCREEN_HEIGHT = Dimensions.get("window").height; // Get device screen height
const GAME_DURATION = 60; // 1 minute in seconds

// Import the JSON word list
import wordList from 'C:/Users/Wisam/SpellCast/assets/words.json';

/**
 * Generates a test grid with "TESTSTESTSTESTSTESTSTESTS"
 */
const generateTestGrid = () => {
  const testString = "TESTSTESTSTESTSTESTSTESTS";
  let grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  
  let index = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      grid[row][col] = testString[index];
      index++;
    }
  }
  
  return grid;
};

/**
 * Generates a random 5x5 grid with letters
 * Ensures at least 7 vowels are placed randomly
 * Fills remaining spaces with consonants
 */
/*
const generateRandomGrid = () => {
  const vowels = "AEIOU";
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
  let grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

  // Ensure at least 7 vowels in random positions
  let vowelPositions = new Set();
  while (vowelPositions.size < 8) {
    let row = Math.floor(Math.random() * GRID_SIZE);
    let col = Math.floor(Math.random() * GRID_SIZE);
    if (!vowelPositions.has(`${row},${col}`)) {
      grid[row][col] = vowels[Math.floor(Math.random() * vowels.length)];
      vowelPositions.add(`${row},${col}`);
    }
  }

  // Fill remaining spaces with random consonants
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!grid[row][col]) {
        grid[row][col] = consonants[Math.floor(Math.random() * consonants.length)];
      }
    }
  }

  return grid;
};
*/
const SpellcastGrid = ({ goToMenu }) => {
  // State management
  const [gridData, setGridData] = useState(generateRandomGrid());
  const [selectedCells, setSelectedCells] = useState([]);
  const [trail, setTrail] = useState([]);
  const [savedWords, setSavedWords] = useState([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameActive, setGameActive] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  
  // Refs
  const fadeAnims = useRef(gridData.map(row => row.map(() => new Animated.Value(1)))).current;
  const gridLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const selectedCellsRef = useRef([]);
  const timerRef = useRef(null);

  // File path
  const wordsFilePath = `C:/Users/Wisam/SpellCast/assets/words.txt`;

  // Update ref when selectedCells changes
  useEffect(() => {
    selectedCellsRef.current = selectedCells;
  }, [selectedCells]);

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
  };

  const endGame = () => {
    setGameActive(false);
    Alert.alert(
      "Time's Up!",
      `Game Over!\nWords Found: ${savedWords.length}\nTotal Score: ${score}`,
      [
        { text: "Play Again", onPress: startGame },
        { text: "Main Menu", onPress: goToMenu }
      ]
    );
  };

  const pauseGame = () => {
    setGameActive(false);
    Alert.alert(
      "Game Paused",
      `Time Remaining: ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`,
      [
        { text: "Resume", onPress: () => setGameActive(true) },
        { text: "Main Menu", onPress: goToMenu }
      ]
    );
  };

  const shuffleGrid = () => {
    const newGrid = generateRandomGrid();
    setGridData(newGrid);
    setSelectedCells([]);
    newGrid.forEach((row, rowIndex) => {
      row.forEach((_, colIndex) => {
        fadeAnims[rowIndex][colIndex].setValue(1);
      });
    });
  };
/*
  const calculateScore = (word) => {
    // Basic scoring: 1 point per letter, bonus for longer words
    let baseScore = word.length;
    if (word.length >= 5) baseScore += 2;
    if (word.length >= 6) baseScore += 3;
    if (word.length >= 7) baseScore += 5;
    return baseScore;
  };
*/

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        };
        
        Animated.timing(newTrailPoint.opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setTrail(prev => prev.filter(p => p.id !== newTrailPoint.id));
        });
        
        setTrail(prev => [...prev, newTrailPoint]);
      }
    },
    
    onPanResponderRelease: () => {
      if (gameActive) {
        const currentWord = selectedCellsRef.current.map(cell => cell.letter).join('');
        if (currentWord.length >= 3 && wordList.includes(currentWord.toUpperCase()) && !savedWords.includes(currentWord.toUpperCase())) {
          const wordScore = calculateScore(currentWord);
          setSavedWords(prev => [...prev, currentWord.toUpperCase()]);
          setScore(prev => prev + wordScore);
          console.log(`Valid word found: ${currentWord} (${wordScore} points)`);
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
        const centerY = gridY + 80 + row * cellSize + cellSize / 2;
        
        // Distance from touch to cell center
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        
        // Only register if within hitbox radius (smaller than cell size)
        if (distance < cellSize * HITBOX_SCALE / 2) {
          const newCell = { row, col, letter: gridData[row][col] };
          const lastCell = selectedCells[selectedCells.length - 1];
          
          if (isFirst || (isAdjacent(lastCell, newCell) && !isAlreadySelected(newCell))) {
            setSelectedCells(prev => [...prev, newCell]);
            Animated.timing(fadeAnims[row][col], {
              toValue: 0.5,
              duration: 100,
              useNativeDriver: true,
            }).start();
            return; // Exit after finding the first matching cell
          }
        }
      }
    }
  };

  const isAdjacent = (last, current) => {
    if (!last) return true;
    const rowDiff = Math.abs(last.row - current.row);
    const colDiff = Math.abs(last.col - current.col);
    return rowDiff <= 1 && colDiff <= 1;
  };

  const isAlreadySelected = (current) => {
    return selectedCells.some(cell => cell.row === current.row && cell.col === current.col);
  };

  const resetAnimations = () => {
    selectedCells.forEach(({ row, col }) => {
      Animated.timing(fadeAnims[row][col], {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
    setSelectedCells([]);
  };

  // Show start screen if game hasn't started
  if (!gameStarted) {
    return (
      <ImageBackground
        source={require("./assets/stars.jpg")}
        style={styles.background}
      >
        <View style={styles.startContainer}>
          <Text style={styles.startTitle}>Ready to Play?</Text>
          <Text style={styles.startSubtitle}>Find as many words as you can in 60 seconds!</Text>
          <TouchableOpacity 
            onPress={startGame} 
            style={styles.startButton}
            activeOpacity={0.7}
          >
            <Text style={styles.startButtonText}>Start Game</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={goToMenu} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require("./assets/stars.jpg")}
      style={styles.background}
      {...panResponder.panHandlers}
    >
      <View
        style={styles.container}
        onLayout={(event) => {
          gridLayout.current = event.nativeEvent.layout;
        }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Wabbod SpellCast</Text>
          <View style={styles.gameInfo}>
            <Text style={[styles.timer, timeLeft <= 10 ? styles.timerWarning : null]}>
              {formatTime(timeLeft)}
            </Text>
            <Text style={styles.scoreText}>Score: {score}</Text>
          </View>
          <TouchableOpacity 
            onPress={pauseGame} 
            style={styles.pauseButton}
            activeOpacity={0.7}
          >
            <Text style={styles.pauseText}>Pause</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.grid}>
          {gridData.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((letter, colIndex) => (
                <Animated.View 
                  key={colIndex} 
                  style={[styles.cell, { opacity: fadeAnims[rowIndex][colIndex] }]}
                > 
                  <Text style={styles.letter}>{letter}</Text>
                </Animated.View>
              ))}
            </View>
          ))}
        </View>
      </View>
      
      {trail.map((point) => (
        <Animated.View
          key={point.id}
          style={{
            position: 'absolute',
            left: point.x - 10,
            top: point.y - 10,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            opacity: point.opacity,
            shadowColor: '#fff',
            shadowRadius: 3,
            shadowOpacity: 0.8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 3,
          }}
        />
      ))}

      <View style={styles.selectedTextContainer}>
        <Text style={styles.selectedText}>
          Selected: {selectedCells.map(cell => cell.letter).join('')}
        </Text>
      </View>

      {savedWords.length > 0 && (
        <View style={styles.savedWordsContainer}>
          <Text style={styles.savedWordsTitle}>Words Found ({savedWords.length}):</Text>
          <View style={styles.savedWordsList}>
            {savedWords.map((word, index) => (
              <Text key={index} style={styles.savedWord}>{word}</Text>
            ))}
          </View>
        </View>
      )}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    textShadowColor: "rgba(16, 15, 15, 0.8)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
    flex: 1,
  },
  gameInfo: {
    alignItems: 'center',
    flex: 1,
  },
  timer: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  timerWarning: {
    color: '#ff4444',
    fontSize: 32,
  },
  scoreText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 2,
  },
  pauseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#fff',
    flex: 1,
    alignItems: 'center',
  },
  pauseText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  startContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  startTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  startSubtitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: 'rgba(0, 255, 0, 0.7)',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 20,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fff',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  shuffleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  shuffleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  grid: {
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: CELL_MARGIN,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#000000",
    borderRadius: 7,
  },
  letter: {
    fontSize: 24,
    fontWeight: "bold",
  },
  selectedTextContainer: {
    position: "absolute",
    bottom: 120,
    width: "100%",
    alignItems: "center",
  },
  selectedText: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "bold",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 10,
    borderRadius: 10,
    textAlign: "center",
  },
  savedWordsContainer: {
    position: "absolute",
    bottom: 20,
    width: "90%",
    maxHeight: 100,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 10,
    padding: 10,
  },
  savedWordsTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 5,
  },
  savedWordsList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  savedWord: {
    color: "#fff",
    marginRight: 10,
    marginBottom: 5,
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 25,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  instructionsContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  instructionsText: {
    color: 'white',
    fontSize: 18,
    lineHeight: 28,
    marginVertical: 20,
    textAlign: 'left',
  },
});

const MenuScreen = ({ navigation }) => (
  <ImageBackground source={require("./assets/stars.jpg")} style={styles.background}>
    <View style={styles.menuContainer}>
      <Text style={styles.menuTitle}>SpellCast</Text>
      <TouchableOpacity style={styles.menuButton} onPress={() => navigation('play')}>
        <Text style={styles.buttonText}>Play</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuButton} onPress={() => navigation('instructions')}>
        <Text style={styles.buttonText}>Instructions</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuButton}>
        <Text style={styles.buttonText}>Settings (Coming Soon)</Text>
      </TouchableOpacity>
    </View>
  </ImageBackground>
);

const InstructionsScreen = ({ navigation }) => (
  <ImageBackground source={require("./assets/stars.jpg")} style={styles.background}>
    <View style={styles.instructionsContainer}>
      <Text style={styles.title}>How to Play</Text>
      <Text style={styles.instructionsText}>
        - You have 60 seconds to find words{"\n"}
        - Swipe to connect adjacent letters{"\n"}
        - Words must be at least 3 letters long{"\n"}
        - Longer words give bonus points{"\n"}
        - Each word can only be used once{"\n"}
        - Tap pause to pause the game
      </Text>
      <TouchableOpacity style={styles.menuButton} onPress={() => navigation('menu')}>
        <Text style={styles.buttonText}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  </ImageBackground>
);

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('menu');

  return (
    <>
      <StatusBar style="light" />
      {currentScreen === 'menu' && <MenuScreen navigation={setCurrentScreen} />}
      {currentScreen === 'play' && <SpellcastGrid goToMenu={() => setCurrentScreen('menu')} />}
      {currentScreen === 'instructions' && <InstructionsScreen navigation={setCurrentScreen} />}
    </>
  );
}