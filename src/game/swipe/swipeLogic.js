/**
 * Pure geometry + path rules behind the swipe. No React, no react-native, no
 * side effects - so it can be reasoned about (and tested) on its own.
 *
 * The solver's adjacency table is built from isAdjacent() below, so the words a
 * board is credited with are exactly the words a finger can physically trace.
 */

export const cellKey = (row, col) => `${row},${col}`;

export const sameCell = (a, b) => !!a && !!b && a.row === b.row && a.col === b.col;

export const containsCell = (cells, cell) => cells.some((other) => sameCell(other, cell));

/** Neighbouring cells, diagonals included. */
export const isAdjacent = (a, b) =>
  Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1;

/**
 * Cells strictly between two cells that share a row, a column, or a perfect
 * diagonal. Returns null when they don't line up at all.
 */
export const cellsBetween = (a, b) => {
  const rowStep = b.row - a.row;
  const colStep = b.col - a.col;
  const steps = Math.max(Math.abs(rowStep), Math.abs(colStep));

  if (steps === 0) return [];
  if (rowStep !== 0 && colStep !== 0 && Math.abs(rowStep) !== Math.abs(colStep)) {
    return null;
  }

  const between = [];
  for (let i = 1; i < steps; i++) {
    between.push({
      row: a.row + (rowStep / steps) * i,
      col: a.col + (colStep / steps) * i,
    });
  }
  return between;
};

/**
 * Nearest cell center to a point, as long as it is within `radius`.
 * `cells` is anything with a forEach yielding { row, col, x, y }.
 *
 * Nearest-wins means a cell owns everything closer to it than to its
 * neighbours, and `radius` decides how early it lights up. The gaps left over
 * where four cells meet are deliberate: they stop a diagonal swipe from
 * clipping a corner and grabbing a letter the player never aimed at.
 */
export const findNearestCell = (cells, x, y, radius) => {
  let best = null;
  let bestDistance = radius * radius;

  cells.forEach((cell) => {
    const dx = x - cell.x;
    const dy = y - cell.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = cell;
    }
  });

  return best ? { row: best.row, col: best.col } : null;
};

/**
 * Points to hit-test between two consecutive touch events. Touch events arrive
 * far apart when a finger moves quickly, so the gap gets walked rather than
 * jumped - otherwise fast swipes skip letters.
 */
export const sampleSegment = (from, to, spacing, maxSamples) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.min(maxSamples, Math.max(1, Math.ceil(distance / spacing)));

  const points = [];
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    points.push({ x: from.x + dx * progress, y: from.y + dy * progress });
  }
  return points;
};

/**
 * The selection rules. Returns null when the touch changes nothing, otherwise
 * the next path and whether it grew (worth a haptic tick).
 *
 *  - first cell starts the word
 *  - a neighbour extends it
 *  - the cell before the last one undoes the last one (drag backwards to erase)
 *  - anything already used is ignored, so a wandering finger can't corrupt a word
 *  - a cell that lines up but isn't touching gets bridged, for flings that
 *    outrun the sampler
 */
export const foldCell = (path, cell) => {
  const length = path.length;
  if (length === 0) return { path: [cell], grew: true };

  const last = path[length - 1];
  if (sameCell(last, cell)) return null; // finger still on the same tile

  if (length >= 2 && sameCell(path[length - 2], cell)) {
    return { path: path.slice(0, length - 1), grew: false }; // backtrack = undo
  }

  if (containsCell(path, cell)) return null;

  if (isAdjacent(last, cell)) {
    return { path: [...path, cell], grew: true };
  }

  const between = cellsBetween(last, cell);
  if (!between || between.length === 0) return null;
  if (between.some((step) => containsCell(path, step))) return null;

  return { path: [...path, ...between, cell], grew: true };
};
