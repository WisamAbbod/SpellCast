'use strict';
/** Replays simulated finger paths through the real swipe logic. */
const { suite, check } = require('./harness.js');
const { loadSrc } = require('./load.js');

const { findNearestCell, sampleSegment, foldCell, cellsBetween } =
  loadSrc('src/game/swipe/swipeLogic.js');

suite('swipe');

const GRID = 5;
const PITCH = 66; // a 54px tile plus a 6px gap either side, on a ~390pt screen
const HIT_RADIUS = PITCH * 0.58;
const SPACING = Math.max(4, PITCH * 0.25);
const MAX_SAMPLES = 64;

const centers = new Map();
for (let row = 0; row < GRID; row++) {
  for (let col = 0; col < GRID; col++) {
    centers.set(`${row},${col}`, {
      row, col, x: col * PITCH + PITCH / 2, y: row * PITCH + PITCH / 2,
    });
  }
}
const center = (row, col) => ({ x: col * PITCH + PITCH / 2, y: row * PITCH + PITCH / 2 });

/** Replays the engine's per-event glue over a list of touch points. */
const swipe = (points, { maxSamples = MAX_SAMPLES } = {}) => {
  let path = [];
  let previous = null;
  let ticks = 0;

  points.forEach((point) => {
    const samples = previous ? sampleSegment(previous, point, SPACING, maxSamples) : [point];
    samples.forEach((sample) => {
      const hit = findNearestCell(centers, sample.x, sample.y, HIT_RADIUS);
      if (!hit) return;
      const folded = foldCell(path, hit);
      if (folded) {
        path = folded.path;
        if (folded.grew) ticks++;
      }
    });
    previous = point;
  });

  return { path, ticks };
};

const show = (path) => path.map((cell) => `(${cell.row},${cell.col})`).join('');

check(
  'slow drag selects every tile it crosses, in order',
  show(swipe([center(0, 0), center(0, 1), center(0, 2), center(0, 3), center(0, 4)]).path),
  '(0,0)(0,1)(0,2)(0,3)(0,4)',
);

// The case the old code dropped letters on.
check(
  'a fast fling across the row still catches every tile',
  show(swipe([center(0, 0), center(0, 4)]).path),
  '(0,0)(0,1)(0,2)(0,3)(0,4)',
);

check('diagonal swipe', show(swipe([center(0, 0), center(4, 4)]).path), '(0,0)(1,1)(2,2)(3,3)(4,4)');

check(
  'backtracking removes the last letter',
  show(swipe([center(0, 0), center(0, 1), center(0, 2), center(0, 1)]).path),
  '(0,0)(0,1)',
);
check(
  'backtracking unwinds the whole word',
  show(swipe([center(0, 0), center(0, 1), center(0, 2), center(0, 0)]).path),
  '(0,0)',
);
check(
  'retracing a drag backwards unwinds it, diagonals included',
  show(swipe([center(0, 0), center(1, 1), center(0, 2), center(1, 1), center(0, 0)]).path),
  '(0,0)',
);
check(
  'closing a loop back onto an old letter is ignored, not a reset',
  show(swipe([center(0, 0), center(0, 1), center(1, 1), center(1, 0), center(0, 0)]).path),
  '(0,0)(0,1)(1,1)(1,0)',
);

// The dead gap where four tiles meet stops corner-clipping stealing a letter.
check('the point where four tiles meet selects nothing', show(swipe([{ x: PITCH, y: PITCH }]).path), '');

check(
  'a jump along a line is bridged',
  show(swipe([center(0, 0), center(0, 3)], { maxSamples: 1 }).path),
  '(0,0)(0,1)(0,2)(0,3)',
);
check(
  'a jump that is not on a line is refused rather than guessed at',
  show(swipe([center(0, 0), center(1, 2)], { maxSamples: 1 }).path),
  '(0,0)',
);
check(
  'bridging refuses to reuse a letter',
  show(swipe([center(0, 1), center(0, 0), center(0, 2)], { maxSamples: 1 }).path),
  '(0,1)(0,0)',
);

check('holding still is a no-op', show(swipe([center(2, 2), center(2, 2), center(2, 2)]).path), '(2,2)');
check('one tick per letter added', String(swipe([center(0, 0), center(0, 2), center(0, 1)]).ticks), '3');
check(
  'touches outside the board are ignored',
  show(swipe([{ x: -200, y: -200 }, { x: -180, y: -190 }]).path),
  '',
);

// A wobbly real-world swipe: drifts into the gutters, cuts corners. Traced by
// hand - (60,40) stays nearest (0,0) [27.9 vs 39.6]; (130,70) sits in the dead
// gap [42.5 > 38.3]; the run to (165,99) passes 30.3 from (1,2); (186,136) is
// 36.1 from (2,2); the endpoint is nearer (2,3) [31.4] than (2,2) [35.4].
check(
  'a wobbly swipe follows the tiles the finger was nearest to',
  show(swipe([
    { x: 33, y: 30 }, { x: 60, y: 40 }, { x: 99, y: 36 },
    { x: 130, y: 70 }, { x: 165, y: 99 }, { x: 200, y: 160 },
  ]).path),
  '(0,0)(0,1)(1,2)(2,2)(2,3)',
);

check(
  'cellsBetween on a column',
  JSON.stringify(cellsBetween({ row: 0, col: 2 }, { row: 3, col: 2 })),
  '[{"row":1,"col":2},{"row":2,"col":2}]',
);
check('cellsBetween on neighbours is empty', JSON.stringify(cellsBetween({ row: 0, col: 0 }, { row: 1, col: 1 })), '[]');
check('cellsBetween off any line is null', String(cellsBetween({ row: 0, col: 0 }, { row: 1, col: 3 })), 'null');
