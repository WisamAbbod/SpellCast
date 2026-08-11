import { CELL_COUNT, GRID_SIZE } from './rules.js';
import { isAdjacent } from './swipe/swipeLogic.js';

/**
 * Boards are a flat array of 25 uppercase letters, indexed row-major.
 * The renderer wants rows of strings, so adapters live here.
 */

export const toIndex = (row, col) => row * GRID_SIZE + col;

export const toRowCol = (index) => ({
  row: (index / GRID_SIZE) | 0,
  col: index % GRID_SIZE,
});

export const boardToRows = (board) => {
  const rows = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    rows.push(board.slice(row * GRID_SIZE, row * GRID_SIZE + GRID_SIZE));
  }
  return rows;
};

export const rowsToBoard = (rows) => {
  const board = new Array(CELL_COUNT);
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      board[toIndex(row, col)] = rows[row][col];
    }
  }
  return board;
};

export const cellsToIndices = (cells) => cells.map((cell) => toIndex(cell.row, cell.col));

export const wordFromIndices = (board, indices) =>
  indices.map((index) => board[index]).join('');

/**
 * NEIGHBOURS[i] = indices reachable from i in one swipe step.
 *
 * Built from the swipe engine's own isAdjacent() rather than re-deriving the
 * rule, so the solver can never credit a board with a word the player's finger
 * cannot actually trace.
 */
const buildNeighbourTable = () => {
  const table = new Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    const from = toRowCol(i);
    const neighbours = [];
    for (let j = 0; j < CELL_COUNT; j++) {
      if (i === j) continue;
      if (isAdjacent(from, toRowCol(j))) neighbours.push(j);
    }
    table[i] = neighbours;
  }
  return table;
};

export const NEIGHBOURS = buildNeighbourTable();
