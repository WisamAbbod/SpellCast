import { Dimensions } from 'react-native';

// Game constants
export const GRID_SIZE = 5; // 5x5 grid
export const CELL_SIZE = 65; // Increased size for better visibility
export const CELL_MARGIN = 8; // Reduced margin for tighter grid
export const HITBOX_SCALE = 0.8; // 80% of cell size for hitbox
export const SCREEN_HEIGHT = Dimensions.get("window").height; // Get device screen height
export const GAME_DURATION = 60; // 1 minute in seconds

// Word list - in a real app, this would be imported from a JSON file
export const wordList = ["TEST", "TESTS", "BEST", "NEST", "REST", "SET", "NET", "TEN", "END", "THE", "JAZZ"];