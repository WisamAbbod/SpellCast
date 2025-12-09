import { GRID_SIZE } from 'C:/Users/Wisam/SpellCast/game_constants.js';

/**
 * Generates a test grid with "TESTSTESTSTESTSTESTSTESTS"
 */ /*
export const generateTestGrid = () => {
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
    */

/**
 * Generates a random 5x5 grid with letters
 * Places seeded words strategically in the grid
 * Fills remaining spaces with weighted letters
 */
export const generateTestGrid = () => {
  // Weighted alphabet using hashmap - letters with higher weights are more likely to appear
  const letterWeights = new Map([
    // High frequency letters (weight 4)
    ['E', 4], ['T', 4], ['A', 4], ['O', 4], ['I', 4], 
    ['N', 4], ['S', 4], ['H', 4], ['R', 4],
    
    // Medium frequency letters (weight 3)
    ['D', 3], ['L', 3], ['C', 3], ['U', 3], ['M', 3], 
    ['W', 3], ['F', 3], ['G', 3], ['Y', 3], ['P', 3], ['B', 3],
    
    // Low frequency letters (weight 2)
    ['V', 2], ['K', 2], ['J', 2], ['X', 2], ['Q', 2], ['Z', 2]
  ]);

  // Seeded words to place in the grid
  const seededWords = [
    { word: 'QUEST', minLength: 5 },
    { word: 'JAZZ', minLength: 4 },
    { word: 'ZONE', minLength: 4 },
    { word: 'FIRE', minLength: 4 },
    { word: 'DREAM', minLength: 5 },
    { word: 'MAGIC', minLength: 5 },
    { word: 'STORM', minLength: 5 },
    { word: 'POWER', minLength: 5 },
    { word: 'SWORD', minLength: 5 },
    { word: 'LIGHT', minLength: 5 }
  ];

  // Create weighted selection using cumulative weights
  const getWeightedLetter = (letters) => {
    const totalWeight = letters.reduce((sum, letter) => sum + letterWeights.get(letter), 0);
    let random = Math.random() * totalWeight;
    
    for (const letter of letters) {
      random -= letterWeights.get(letter);
      if (random <= 0) return letter;
    }
    return letters[letters.length - 1]; // fallback
  };

  // Separate vowels and consonants
  const vowels = ['A', 'E', 'I', 'O', 'U'];
  const consonants = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'];

  const getWeightedVowel = () => getWeightedLetter(vowels);
  const getWeightedConsonant = () => getWeightedLetter(consonants);

  let grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  let placedPositions = new Set();

  // Function to check if a word can be placed at a position
  const canPlaceWord = (word, startRow, startCol, direction) => {
    const directions = {
      horizontal: { dr: 0, dc: 1 },
      vertical: { dr: 1, dc: 0 },
      diagonal: { dr: 1, dc: 1 },
      diagonalUp: { dr: -1, dc: 1 }
    };

    const { dr, dc } = directions[direction];
    
    for (let i = 0; i < word.length; i++) {
      const row = startRow + (i * dr);
      const col = startCol + (i * dc);
      
      // Check bounds
      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return false;
      }
      
      // Check if position is already occupied
      if (grid[row][col] !== null) {
        return false;
      }
    }
    return true;
  };

  // Function to place a word in the grid
  const placeWord = (word, startRow, startCol, direction) => {
    const directions = {
      horizontal: { dr: 0, dc: 1 },
      vertical: { dr: 1, dc: 0 },
      diagonal: { dr: 1, dc: 1 },
      diagonalUp: { dr: -1, dc: 1 }
    };

    const { dr, dc } = directions[direction];
    
    for (let i = 0; i < word.length; i++) {
      const row = startRow + (i * dr);
      const col = startCol + (i * dc);
      grid[row][col] = word[i];
      placedPositions.add(`${row},${col}`);
    }
  };

  // Attempt to place seeded words
  const directionsArray = ['horizontal', 'vertical', 'diagonal', 'diagonalUp'];
  const wordsToPlace = seededWords.slice(0, 3 + Math.floor(Math.random() * 3)); // Place 3-5 words
  
  for (const seedWord of wordsToPlace) {
    let placed = false;
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!placed && attempts < maxAttempts) {
      const direction = directionsArray[Math.floor(Math.random() * directionsArray.length)];
      const startRow = Math.floor(Math.random() * GRID_SIZE);
      const startCol = Math.floor(Math.random() * GRID_SIZE);
      
      if (canPlaceWord(seedWord.word, startRow, startCol, direction)) {
        placeWord(seedWord.word, startRow, startCol, direction);
        placed = true;
      }
      attempts++;
    }
  }

  // Count vowels already placed
  let vowelCount = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[row][col] && vowels.includes(grid[row][col])) {
        vowelCount++;
      }
    }
  }

  // Ensure at least 8 vowels total in random positions
  const minVowels = 8;
  while (vowelCount < minVowels) {
    let row = Math.floor(Math.random() * GRID_SIZE);
    let col = Math.floor(Math.random() * GRID_SIZE);
    
    if (grid[row][col] === null) {
      grid[row][col] = getWeightedVowel();
      vowelCount++;
    }
  }

  // Fill remaining spaces with weighted consonants and vowels
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[row][col] === null) {
        // 30% chance for vowel, 70% for consonant in remaining spaces
        if (Math.random() < 0.3) {
          grid[row][col] = getWeightedVowel();
        } else {
          grid[row][col] = getWeightedConsonant();
        }
      }
    }
  }

  return grid;
};

/**
 * Enhanced scoring system based on letter rarity
 */
export const calculateScore = (word) => {
  // Letter rarity scores (inverse of frequency weights)
  const letterScores = new Map([
    // High frequency letters (low score)
    ['E', 1], ['T', 1], ['A', 1], ['O', 1], ['I', 1], 
    ['N', 1], ['S', 1], ['H', 1], ['R', 1],
    
    // Medium frequency letters (medium score)
    ['D', 2], ['L', 2], ['C', 2], ['U', 2], ['M', 2], 
    ['W', 2], ['F', 2], ['G', 2], ['Y', 2], ['P', 2], ['B', 2],
    
    // Low frequency letters (high score)
    ['V', 5], ['K', 5], ['J', 8], ['X', 8], ['Q', 10], ['Z', 10]
  ]);

  // Calculate base score from letter rarity
  let letterScore = 0;
  for (const letter of word.toUpperCase()) {
    letterScore += letterScores.get(letter) || 1;
  }

  // Length multipliers
  let lengthMultiplier = 1;
  if (word.length >= 5) lengthMultiplier = 1.5;
  if (word.length >= 6) lengthMultiplier = 2;
  if (word.length >= 7) lengthMultiplier = 3;

  // Length bonuses
  let lengthBonus = 0;
  if (word.length >= 5) lengthBonus += 25;
  if (word.length >= 6) lengthBonus += 50;
  if (word.length >= 7) lengthBonus += 100;

  // Final score calculation
  const finalScore = Math.floor((letterScore * lengthMultiplier) + lengthBonus);
  
  return finalScore;
};

/**
 * Format time in MM:SS format
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Check if two cells are adjacent (including diagonals)
 */
export const isAdjacent = (last, current) => {
  if (!last) return true;
  const rowDiff = Math.abs(last.row - current.row);
  const colDiff = Math.abs(last.col - current.col);
  return rowDiff <= 1 && colDiff <= 1;
};

/**
 * Check if a cell is already selected
 */
export const isAlreadySelected = (current, selectedCells) => {
  return selectedCells.some(cell => cell.row === current.row && cell.col === current.col);
};