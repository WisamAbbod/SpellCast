/**
 * Replays simulated finger paths through the real swipe logic.
 *
 *   node swipe_logic.test.js      (or: npm test)
 *
 * swipe_logic.js is ES module source in a CommonJS package, so it is loaded by
 * stripping the `export ` keywords and evaluating it - no test runner, no
 * dependencies, nothing to install.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs
  .readFileSync(path.join(__dirname, 'swipe_logic.js'), 'utf8')
  .replace(/^export /gm, '');

const names = [
  'cellKey', 'sameCell', 'containsCell', 'isAdjacent',
  'cellsBetween', 'findNearestCell', 'sampleSegment', 'foldCell',
];
const context = { module: { exports: {} } };
vm.runInNewContext(`${source}\nmodule.exports = { ${names.join(', ')} };`, context);
const { findNearestCell, sampleSegment, foldCell, cellsBetween } = context.module.exports;

/* ------------------------------------------------------------- fixtures -- */

const GRID = 5;
const PITCH = 66;      // matches CELL_SIZE 54 + 2 * CELL_MARGIN 6 on a 390pt screen
const HIT_RADIUS = PITCH * 0.58;
const SPACING = Math.max(4, PITCH * 0.25);
const MAX_SAMPLES = 64;

const centers = new Map();
for (let row = 0; row < GRID; row++) {
  for (let col = 0; col < GRID; col++) {
    centers.set(`${row},${col}`, { row, col, x: col * PITCH + PITCH / 2, y: row * PITCH + PITCH / 2 });
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

const show = (path) => path.map((c) => `(${c.row},${c.col})`).join('');

/* ---------------------------------------------------------------- tests -- */

let failures = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        expected ${expected}\n        actual   ${actual}`);
};

// 1. Slow, well-behaved drag across the top row.
check(
  'slow drag selects every cell it crosses, in order',
  show(swipe([center(0, 0), center(0, 1), center(0, 2), center(0, 3), center(0, 4)]).path),
  '(0,0)(0,1)(0,2)(0,3)(0,4)',
);

// 2. Fast fling: two events, the whole row in between. This is the case the old
//    code dropped letters on.
check(
  'fast fling across the row still catches every cell',
  show(swipe([center(0, 0), center(0, 4)]).path),
  '(0,0)(0,1)(0,2)(0,3)(0,4)',
);

// 3. Diagonals.
check(
  'diagonal swipe',
  show(swipe([center(0, 0), center(4, 4)]).path),
  '(0,0)(1,1)(2,2)(3,3)(4,4)',
);

// 4. Drag back over the previous letter to erase it.
check(
  'backtracking removes the last letter',
  show(swipe([center(0, 0), center(0, 1), center(0, 2), center(0, 1)]).path),
  '(0,0)(0,1)',
);

// 5. ...and keeps unwinding all the way back.
check(
  'backtracking unwinds the whole word',
  show(swipe([center(0, 0), center(0, 1), center(0, 2), center(0, 0)]).path),
  '(0,0)',
);

// 6. Retracing the drag backwards unwinds letter by letter, even across a
//    diagonal.
check(
  'retracing a drag backwards unwinds it',
  show(swipe([center(0, 0), center(1, 1), center(0, 2), center(1, 1), center(0, 0)]).path),
  '(0,0)',
);

// 6b. Looping round to a letter already used (arriving from somewhere other
//     than the previous letter) is a no-op rather than a reset.
check(
  'closing a loop back onto an old letter is ignored',
  show(swipe([center(0, 0), center(0, 1), center(1, 1), center(1, 0), center(0, 0)]).path),
  '(0,0)(0,1)(1,1)(1,0)',
);

// 7. The gap where four tiles meet is dead, so corner-clipping can't steal a letter.
check(
  'the point where four tiles meet selects nothing',
  show(swipe([{ x: PITCH, y: PITCH }]).path),
  '',
);

// 8. Sampling capped to a single point: the fold still bridges a straight line.
check(
  'a jump along a line is bridged',
  show(swipe([center(0, 0), center(0, 3)], { maxSamples: 1 }).path),
  '(0,0)(0,1)(0,2)(0,3)',
);

// 9. ...but a jump that lines up with nothing is refused rather than guessed at.
check(
  'a jump that is not on a line is refused',
  show(swipe([center(0, 0), center(1, 2)], { maxSamples: 1 }).path),
  '(0,0)',
);

// 10. Bridging never runs through letters already in the word.
check(
  'bridging refuses to reuse a letter',
  show(swipe([center(0, 1), center(0, 0), center(0, 2)], { maxSamples: 1 }).path),
  '(0,1)(0,0)',
);

// 11. Holding still does not re-add or duplicate anything.
check(
  'holding still is a no-op',
  show(swipe([center(2, 2), center(2, 2), center(2, 2)]).path),
  '(2,2)',
);

// 12. One haptic tick per letter added, never on backtrack.
check(
  'one tick per letter added',
  String(swipe([center(0, 0), center(0, 2), center(0, 1)]).ticks),
  '3',
);

// 13. Touching well outside the board selects nothing.
check(
  'touches outside the board are ignored',
  show(swipe([{ x: -200, y: -200 }, { x: -180, y: -190 }]).path),
  '',
);

// 14. A realistic wobbly swipe: the finger drifts into the gutters and cuts
//     corners, and the selection follows the tiles it was actually nearest to.
//     Traced by hand: (0,0) at the start; (60,40) stays nearest (0,0) [27.9 vs
//     39.6]; (99,36) is (0,1); (130,70) sits in the dead gap [nearest 42.5 >
//     38.3] so nothing changes; the run to (165,99) passes 30.3 from (1,2);
//     then (186,136) is 36.1 from (2,2) and the endpoint (200,160) is nearer
//     (2,3) [31.4] than (2,2) [35.4].
check(
  'a wobbly swipe follows the tiles the finger was nearest to',
  show(swipe([
    { x: 33, y: 30 },
    { x: 60, y: 40 },   // drifting toward the gutter between (0,0) and (0,1)
    { x: 99, y: 36 },
    { x: 130, y: 70 },  // cutting the corner toward (1,2)
    { x: 165, y: 99 },
    { x: 200, y: 160 },
  ]).path),
  '(0,0)(0,1)(1,2)(2,2)(2,3)',
);

// 15. cellsBetween sanity.
check('cellsBetween on a column', JSON.stringify(cellsBetween({ row: 0, col: 2 }, { row: 3, col: 2 })), '[{"row":1,"col":2},{"row":2,"col":2}]');
check('cellsBetween on neighbours is empty', JSON.stringify(cellsBetween({ row: 0, col: 0 }, { row: 1, col: 1 })), '[]');
check('cellsBetween off any line is null', String(cellsBetween({ row: 0, col: 0 }, { row: 1, col: 3 })), 'null');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures ? 1 : 0);
