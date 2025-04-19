import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ImageBackground, PanResponder, Animated, Dimensions, TouchableOpacity } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Game constants
const GRID_SIZE = 5; // 5x5 grid
const CELL_SIZE = 55; // Size of each cell in pixels
const CELL_MARGIN = 15; // Margin between cells
const SCREEN_HEIGHT = Dimensions.get("window").height; // Get device screen height

/**
 * Generates a random 5x5 grid with letters
 * Ensures at least 7 vowels are placed randomly
 * Fills remaining spaces with consonants
 */
const generateRandomGrid = () => {
  const vowels = "AEIOU";
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
  let grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

  // Ensure at least 7 vowels in random positions
  let vowelPositions = new Set();
  while (vowelPositions.size < 7) {
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

const SpellcastGrid = () => {
  // State management
  const [gridData, setGridData] = useState(generateRandomGrid());
  const [selectedCells, setSelectedCells] = useState([]);
  const [trail, setTrail] = useState([]);
  const [savedWords, setSavedWords] = useState([]);
  
  // Refs
  const fadeAnims = useRef(gridData.map(row => row.map(() => new Animated.Value(1)))).current;
  const gridLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const selectedCellsRef = useRef([]);

  // File path
  const wordsFilePath = `C:/Users/Wisam/SpellCast/assets/words.txt`;

  // Initialize words file
  useEffect(() => {
    const initializeWordsFile = async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(wordsFilePath);
        if (!fileInfo.exists) {
          await FileSystem.writeAsStringAsync(wordsFilePath, '');
          console.log('found!');
        }
        const content = await FileSystem.readAsStringAsync(wordsFilePath);
        setSavedWords(content.split('\n').filter(word => word.length > 0));
      } catch (error) {
        console.error('Error initializing words file:', error);
      }
    };
    initializeWordsFile();
  }, []);

  // Update ref when selectedCells changes
  useEffect(() => {
    selectedCellsRef.current = selectedCells;
  }, [selectedCells]);

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

  const saveWordToFile = async (word) => {
    if (word.length < 3) return;
    
    try {
      await FileSystem.writeAsStringAsync(
        wordsFilePath,                    // Use the correct path variable
        `${word}\n`,                     // Save the actual word + newline
        { 
        //  encoding: FileSystem.EncodingType.UTF8, 
          //flag: FileSystem.StorageType.APPEND 
        }
      );
      setSavedWords(prev => [...prev, word]);
    } catch (error) {
      console.error('Error saving word:', error);
    }
};

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    
    onPanResponderGrant: (event, gestureState) => {
      handleSelection(gestureState.x0, gestureState.y0, true);
    },
    
    onPanResponderMove: (event, gestureState) => {
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
    },
    
    onPanResponderRelease: () => {
      const currentWord = selectedCellsRef.current.map(cell => cell.letter).join('');
      saveWordToFile(currentWord);
      resetAnimations();
    },
  });

  const handleSelection = (x, y, isFirst) => {
    const { y: gridY, width } = gridLayout.current;
    const gridX = gridLayout.current.x;
    const cellSize = width / GRID_SIZE;
    
    const col = Math.floor((x - gridX) / cellSize);
    const row = Math.floor((y - gridY - 80) / cellSize);
    
    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      const newCell = { row, col, letter: gridData[row][col] };
      const lastCell = selectedCells[selectedCells.length - 1];
      
      if (isFirst || (isAdjacent(lastCell, newCell) && !isAlreadySelected(newCell))) {
        setSelectedCells(prev => [...prev, newCell]);
        Animated.timing(fadeAnims[row][col], {
          toValue: 0.5,
          duration: 100,
          useNativeDriver: true,
        }).start();
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
          <TouchableOpacity 
            onPress={shuffleGrid} 
            style={styles.shuffleButton}
            activeOpacity={0.7}
          >
            <Text style={styles.shuffleText}>Shuffle</Text>
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
          <Text style={styles.savedWordsTitle}>Your Words:</Text>
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
    fontSize: 30,
    fontWeight: "bold",
    color: "#ffffff",
    textShadowColor: "rgba(16, 15, 15, 0.8)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
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
});

export default SpellcastGrid;