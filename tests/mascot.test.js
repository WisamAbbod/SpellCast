'use strict';
/**
 * The astronaut.
 *
 * Almost everything about it is data - the rig, the art and the choreography -
 * and almost every way that data can be wrong is silent: a truncated path draws
 * nothing, a track naming a part that does not exist animates nothing, and a
 * reaction that ends off its rest pose leaves an arm stuck in the air forever.
 * Those are what this file holds down, plus some real geometry: the facepalm
 * has to land on the face.
 */
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const rules = loadSrc('src/game/mascot.js');
const {
  EYES, MOUTHS, EXPRESSIONS, PART_KEYS, RIG, expressionFor, findPart,
} = loadSrc('src/theme/astronaut.js');
const moves = loadSrc('src/theme/astronautMoves.js');

/* ---------------------------------------------------------------- rules -- */

suite('mascot / rules');

check('an ordinary word earns a fist pump', rules.moodForWord({ length: 4 }), 'happy');
check('a seven-letter word earns the backflip', rules.moodForWord({ length: 7 }), 'ecstatic');
check('so does a long combo', rules.moodForWord({ length: 3, chain: 4 }), 'ecstatic');
check('platinum is ecstatic', rules.moodForResult('platinum'), 'ecstatic');
check('silver is happy', rules.moodForResult('silver'), 'happy');
check('no medal is a shrug, not sadness', rules.moodForResult('none'), 'thinking');
check('3am is asleep', rules.idleMoodFor(3), 'sleepy');
check('the afternoon is awake', rules.idleMoodFor(15), 'idle');

check('ten seconds left is panic', rules.moodForRound({ secondsLeft: 10 }), 'panic');
check('eleven is not', rules.moodForRound({ secondsLeft: 11 }), 'idle');
check('a finished round is not panic', rules.moodForRound({ secondsLeft: 0 }), 'idle');
check('a paused round is not panic', rules.moodForRound({ secondsLeft: 5, running: false }), 'idle');
check('a finger on the board is focus', rules.moodForRound({ secondsLeft: 40, tracing: true }), 'focused');
check('panic outranks focus', rules.moodForRound({ secondsLeft: 4, tracing: true }), 'panic');

const gaze = (row, col) => rules.gazeForCell({ row, col });
ok('a lower row is looked at lower', gaze(4, 2).y > gaze(0, 2).y);
ok('a righter column is looked at righter', gaze(2, 4).x > gaze(2, 0).x);
ok('floating above the board, it always looks down', [0, 1, 2, 3, 4].every((r) => gaze(r, 2).y > 0));
let gazeInRange = true;
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const g = gaze(r, c);
    if (!(g.x >= -1 && g.x <= 1 && g.y >= -1 && g.y <= 1)) gazeInRange = false;
  }
}
ok('every cell gives a gaze inside -1..1', gazeInRange);

/* --------------------------------------------------------- expressions -- */

suite('mascot / faces');

const allMoods = [...rules.MOODS, ...moves.FIDGET_KEYS];
check('every mood and fidget has an expression',
  allMoods.filter((mood) => !EXPRESSIONS[mood]).join(','), '');
check('every expression names real eyes',
  Object.entries(EXPRESSIONS).filter(([, e]) => !EYES[e.eyes]).map(([k]) => k).join(','), '');
check('every expression names a real mouth',
  Object.entries(EXPRESSIONS).filter(([, e]) => !MOUTHS[e.mouth]).map(([k]) => k).join(','), '');
ok('an unknown mood falls back to the resting face', expressionFor('furious') === EXPRESSIONS.idle);
ok('"constructor" does not find Object.prototype', expressionFor('constructor') === EXPRESSIONS.idle);

/* ------------------------------------------------------------------ rig -- */

suite('mascot / rig');

const TAGS = ['path', 'circle', 'ellipse', 'rect'];
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const completePath = (d) =>
  typeof d === 'string' && d.startsWith('M') && /[Zz\d]$/.test(d) && !d.includes('NaN');

const elementFault = (element) => {
  if (!TAGS.includes(element.tag)) return `unknown tag ${element.tag}`;
  if (element.tag === 'path' && !completePath(element.d)) return `broken path ${String(element.d).slice(0, 20)}`;
  if (element.tag === 'circle' && !(finite(element.cx) && finite(element.cy) && element.r > 0)) return 'bad circle';
  if (element.tag === 'ellipse' && !(finite(element.cx) && element.rx > 0 && element.ry > 0)) return 'bad ellipse';
  if (element.tag === 'rect' && !(element.width > 0 && element.height > 0)) return 'bad rect';
  return null;
};

check('part keys are unique', new Set(PART_KEYS).size, PART_KEYS.length);

let rigFault = null;
const walk = (part) => {
  if (rigFault) return;
  const { box, origin } = part;
  if (!box || !origin || ![box.x, box.y, box.w, box.h, origin.x, origin.y].every(finite)) {
    rigFault = `${part.key}: box or origin is not numeric`;
    return;
  }
  (part.art || []).forEach((element) => {
    const fault = !rigFault && elementFault(element);
    if (fault) rigFault = `${part.key}: ${fault}`;
  });
  if (part.face && !['eyes', 'mouth'].includes(part.face)) rigFault = `${part.key}: face "${part.face}"`;
  (part.children || []).forEach(walk);
};
walk(RIG);
ok('every part has a numeric box and pivot, and every shape is complete', !rigFault, rigFault);

let faceFault = null;
[...Object.entries(EYES), ...Object.entries(MOUTHS)].forEach(([name, elements]) => {
  elements.forEach((element) => {
    const fault = !faceFault && elementFault(element);
    if (fault) faceFault = `${name}: ${fault}`;
  });
});
ok('every eye and mouth shape is complete', !faceFault, faceFault);

/* --------------------------------------------------------- choreography -- */

suite('mascot / choreography');

const allTrackSets = [
  ...Object.entries(moves.IDLE).map(([name, tracks]) => [`idle.${name}`, tracks]),
  ...Object.entries(moves.REACTIONS).map(([name, move]) => [`reaction.${name}`, move.tracks]),
  ...Object.entries(moves.FIDGETS).map(([name, move]) => [`fidget.${name}`, move.tracks]),
];

let trackFault = null;
allTrackSets.forEach(([name, tracks]) => {
  tracks.forEach((item) => {
    if (trackFault) return;
    if (!PART_KEYS.includes(item.part)) trackFault = `${name}: no part "${item.part}"`;
    else if (!moves.PROPS.includes(item.prop)) trackFault = `${name}: no prop "${item.prop}"`;
    else if (!Array.isArray(item.keys) || item.keys.length < 2) trackFault = `${name}: ${item.part}.${item.prop} needs two keys`;
    else if (item.keys[0][0] !== 0) trackFault = `${name}: ${item.part}.${item.prop} does not start at 0`;
    else if (!item.keys.every((key, i) => i === 0 || key[0] > item.keys[i - 1][0])) {
      trackFault = `${name}: ${item.part}.${item.prop} goes backwards in time`;
    } else if (!item.keys.every((key) => finite(key[0]) && finite(key[1]))) {
      trackFault = `${name}: ${item.part}.${item.prop} has a non-number`;
    } else if (!item.keys.every((key) => key[2] === undefined || moves.EASINGS.includes(key[2]))) {
      trackFault = `${name}: ${item.part}.${item.prop} names an unknown easing`;
    }
  });
});
ok('every track names a real part and prop, and runs forward in time', !trackFault, trackFault);

check('every resting mood has an idle loop',
  rules.RESTING_MOODS.filter((mood) => !moves.IDLE[mood]).join(','), '');
check('every reaction mood has a move',
  rules.REACTION_MOODS.filter((mood) => !moves.REACTIONS[mood]).join(','), '');
check('reaction lengths agree with the rules',
  rules.REACTION_MOODS.filter((mood) => moves.REACTIONS[mood].duration !== rules.REACTION_MS[mood]).join(','), '');

// An idle loop that ends somewhere other than where it starts visibly jumps
// every time it comes round.
const seamFault = Object.entries(moves.IDLE).flatMap(([mood, tracks]) =>
  tracks
    .filter((item) => item.keys[0][1] !== item.keys[item.keys.length - 1][1])
    .map((item) => `${mood}: ${item.part}.${item.prop}`));
check('every idle loop ends where it starts', seamFault.join(', '), '');

// A one-shot move that ends off its rest pose leaves the astronaut stuck in it.
const atRest = (item) => {
  const last = item.keys[item.keys.length - 1][1];
  if (item.prop === 'rot') return last % 360 === 0; // a full turn looks the same as none
  return last === moves.ACT_REST[item.prop];
};
const restFault = [
  ...Object.entries(moves.REACTIONS),
  ...Object.entries(moves.FIDGETS),
].flatMap(([name, move]) =>
  move.tracks.filter((item) => !atRest(item)).map((item) => `${name}: ${item.part}.${item.prop}`));
check('every reaction and fidget lands back at rest', restFault.join(', '), '');

const overrun = [...Object.entries(moves.REACTIONS), ...Object.entries(moves.FIDGETS)]
  .filter(([, move]) => move.tracks.some((item) => moves.trackLength(item.keys) > move.duration))
  .map(([name]) => name);
check('no move has a track that outlasts it', overrun.join(','), '');

/* ---------------------------------------------------------------- reach -- */

/*
 * Forward kinematics on the real data: where does the glove end up? The arm
 * is shorter than the distance from shoulder to visor, which is exactly the
 * kind of thing that makes a "facepalm" land on the chest instead.
 */
const gloveAt = (armKey, rotation, dx = 0, dy = 0) => {
  const arm = findPart(armKey);
  const glove = arm.art.find((element) => element.tag === 'circle');
  const ox = arm.box.x + dx + arm.origin.x;
  const oy = arm.box.y + dy + arm.origin.y;
  const vx = glove.cx - arm.origin.x;
  const vy = glove.cy - arm.origin.y;
  const a = (rotation * Math.PI) / 180; // clockwise, screen coordinates
  return { x: ox + vx * Math.cos(a) - vy * Math.sin(a), y: oy + vx * Math.sin(a) + vy * Math.cos(a) };
};

const head = findPart('head');
const visor = findPart('visor');
const visorRect = {
  left: head.box.x + visor.box.x,
  right: head.box.x + visor.box.x + visor.box.w,
  top: head.box.y + visor.box.y,
  bottom: head.box.y + visor.box.y + visor.box.h,
};
const idleArmR = moves.IDLE.idle.find((item) => item.part === 'armR' && item.prop === 'rot').keys[0][1];

const oopsTrack = (prop) => moves.REACTIONS.oops.tracks.find((item) => item.part === 'armR' && item.prop === prop);
const palm = gloveAt('armR',
  idleArmR + moves.sampleTrack(oopsTrack('rot').keys, 500),
  moves.sampleTrack(oopsTrack('x').keys, 500),
  moves.sampleTrack(oopsTrack('y').keys, 500));
ok(`the facepalm lands on the visor (glove at ${palm.x.toFixed(0)},${palm.y.toFixed(0)})`,
  palm.x > visorRect.left && palm.x < visorRect.right && palm.y > visorRect.top && palm.y < visorRect.bottom);

const thinkRot = moves.IDLE.thinking.find((item) => item.part === 'armR' && item.prop === 'rot').keys[0][1];
const thinkY = moves.IDLE.thinking.find((item) => item.part === 'armR' && item.prop === 'y').keys[0][1];
const chin = gloveAt('armR', thinkRot, 0, thinkY);
ok(`thinking rests the glove at the chin (${chin.x.toFixed(0)},${chin.y.toFixed(0)})`,
  Math.abs(chin.y - visorRect.bottom) < 8 && chin.x > visorRect.left && chin.x < visorRect.right);

/* -------------------------------------------------------------- fidgets -- */

let repeated = false;
let previous = null;
for (let i = 0; i < 200; i++) {
  const r = ((i * 7919) % 1000) / 1000;
  const next = moves.nextFidget(previous, () => r);
  if (next === previous || !moves.FIDGETS[next]) repeated = true;
  previous = next;
}
ok('a fidget never repeats back to back, and is always a real one', !repeated);
ok('fidgets are seconds apart, not constant',
  moves.fidgetDelay(() => 0) >= 4000 && moves.fidgetDelay(() => 0.999) <= 9500);


/* ---- costumes ------------------------------------------------------------- */

suite('mascot / costumes');
{
  const { COSTUMES, COSTUME_ORDER, paletteSwap, isPremium } = loadSrc('src/theme/costumes.js');
  const { ASTRO_COLORS } = loadSrc('src/theme/astronaut.js');
  let costumeFault = null;
  COSTUME_ORDER.forEach((key) => {
    const costume = COSTUMES[key];
    if (costumeFault) return;
    if (!costume || !costume.parts || !Array.isArray(costume.hide)) {
      costumeFault = `${key}: needs parts and hide`;
      return;
    }
    [...Object.entries(costume.parts), ...Object.entries(costume.over || {})].forEach(([part, elements]) => {
      if (costumeFault) return;
      // A piece pinned to a part that does not exist is drawn nowhere.
      if (!PART_KEYS.includes(part)) costumeFault = `${key}: no rig part "${part}"`;
      else elements.forEach((element) => {
        const fault = !costumeFault && elementFault(element);
        if (fault) costumeFault = `${key}.${part}: ${fault}`;
      });
    });
    costume.hide.forEach((part) => {
      if (!costumeFault && !PART_KEYS.includes(part)) costumeFault = `${key}: hides unknown part "${part}"`;
    });
  });
  ok('every costume piece is pinned to a real part and drawn with complete shapes', !costumeFault, costumeFault);
  ok('a costume never hides something the rig cannot do without',
    COSTUME_ORDER.every((key) => !COSTUMES[key].hide.some((part) => ['root', 'head', 'torso', 'visor', 'eyes', 'mouth'].includes(part))));
  ok('no costume is just the plain suit except "none"',
    COSTUME_ORDER.filter((key) => key !== 'none').every((key) => Object.keys(COSTUMES[key].parts).length > 0));
}

{
  const { COSTUMES, COSTUME_ORDER, paletteSwap, isPremium } = loadSrc('src/theme/costumes.js');
  const { ASTRO_COLORS } = loadSrc('src/theme/astronaut.js');

  // Palettes swap colours BY VALUE, so two roles sharing a hex would recolour
  // together - the chest's amber light used to be the glove colour, and a
  // dark-gloved suit switched it off.
  const hexes = Object.values(ASTRO_COLORS).map((hex) => hex.toUpperCase());
  check('every rig colour role has its own hex', new Set(hexes).size, hexes.length);

  let paletteFault = null;
  COSTUME_ORDER.forEach((key) => {
    Object.entries(COSTUMES[key].palette || {}).forEach(([role, hex]) => {
      if (paletteFault) return;
      if (!ASTRO_COLORS[role]) paletteFault = `${key}: no colour role "${role}"`;
      else if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) paletteFault = `${key}.${role}: "${hex}" is not a 6-digit hex`;
    });
  });
  ok('every palette recolours a real role with a real colour', !paletteFault, paletteFault);

  check('a costume without a palette swaps nothing', paletteSwap(COSTUMES.party), null);
  check('nor does no costume at all', paletteSwap(undefined), null);
  const gold = paletteSwap(COSTUMES.gold);
  check('the gold suit turns the white suit gold', gold[ASTRO_COLORS.suit], COSTUMES.gold.palette.suit);
  ok('...and leaves what it does not name alone', gold[ASTRO_COLORS.red] === undefined);

  const premium = COSTUME_ORDER.filter((key) => isPremium(COSTUMES[key]));
  const rest = COSTUME_ORDER.filter((key) => !isPremium(COSTUMES[key]));
  ok('there are premium suits, and each recolours the whole astronaut',
    premium.length > 0 && premium.every((key) => COSTUMES[key].palette && COSTUMES[key].palette.suit));
  ok('every premium costume costs more than every other costume',
    Math.min(...premium.map((key) => COSTUMES[key].price)) > Math.max(...rest.map((key) => COSTUMES[key].price)));
  ok('the catalog runs cheapest to dearest',
    COSTUME_ORDER.every((key, i) => i === 0 || COSTUMES[COSTUME_ORDER[i - 1]].price <= COSTUMES[key].price));
}
