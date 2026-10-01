/**
 * The astronaut: skeleton and art, as pure data.
 *
 * A rig rather than a picture. Every limb is its own part with its own box and
 * pivot, so it can move on its own - an arm swings from the shoulder, the head
 * nods from the neck, the antenna springs from its base. That independence is
 * the whole difference between a character that bends and one that slides.
 *
 * Everything is in RIG units: the character lives in a 120x120 box, and
 * Mascot.js scales it to whatever size it is drawn at.
 *
 *   box     { x, y, w, h } - where the part sits, in its parent's units
 *   origin  { x, y }       - its pivot, relative to its own box
 *   art     [elements]     - what it looks like, drawn in its own box
 *   children               - parts that move with it (the visor moves with the head)
 *   clip / radius / fill   - the visor is a rounded window: clipped, so the glint
 *                            sweeping across it never leaks out of the glass
 *
 * An element is { tag: 'path' | 'circle' | 'ellipse' | 'rect', ...svg attributes }.
 * The same descriptors are rendered by react-native-svg in the app and turned
 * into plain SVG by the preview tool, which is how these shapes were designed.
 *
 * No react imports, so tests/mascot.test.js can check every path.
 */

export const RIG_UNITS = 120;

export const ASTRO_COLORS = {
  suit: '#F4F3FF',
  shade: '#D8DBEF',
  line: '#A9AFD2',
  dark: '#2B3160',
  glove: '#FFD166',
  lamp: '#FFDA75', // the chest's amber light - its own value, see costumes.js
  boot: '#8E94BD',
  pack: '#B7BCDA',
  visor: '#141836',
  visorEdge: '#39407A',
  glow: '#BFF3FF',
  flame: '#FFB84D',
  flameCore: '#FFF1B8',
  red: '#FF5E7D',
  cyan: '#4ADEDE',
};

const C = ASTRO_COLORS;
const outline = { stroke: C.line, strokeWidth: 1.6 };

/* ------------------------------------------------------------ the rig -- */

export const RIG = {
  key: 'root',
  box: { x: 0, y: 0, w: RIG_UNITS, h: RIG_UNITS },
  origin: { x: 60, y: 70 },
  children: [
    {
      // Behind everything: it comes out of the bottom of the pack.
      key: 'flame',
      box: { x: 52, y: 98, w: 16, h: 22 },
      origin: { x: 8, y: 0 },
      art: [
        { tag: 'path', d: 'M8,0 C15,6 14,14 8,22 C2,14 1,6 8,0 Z', fill: C.flame },
        { tag: 'path', d: 'M8,2 C11.5,6 11,11 8,15 C5,11 4.5,6 8,2 Z', fill: C.flameCore },
      ],
    },
    {
      key: 'pack',
      box: { x: 33, y: 60, w: 54, h: 38 },
      origin: { x: 27, y: 19 },
      art: [
        { tag: 'rect', x: 1, y: 1, width: 52, height: 34, rx: 9, fill: C.pack, ...outline },
        { tag: 'rect', x: 18, y: 32, width: 18, height: 6, rx: 2, fill: C.boot },
      ],
    },
    {
      key: 'legL',
      box: { x: 45, y: 90, w: 14, h: 22 },
      origin: { x: 7, y: 2 },
      art: [
        { tag: 'rect', x: 1.5, y: 0, width: 11, height: 16, rx: 5.5, fill: C.suit, ...outline },
        { tag: 'rect', x: 0.5, y: 13, width: 13, height: 8.5, rx: 3.5, fill: C.boot, ...outline },
      ],
    },
    {
      key: 'legR',
      box: { x: 61, y: 90, w: 14, h: 22 },
      origin: { x: 7, y: 2 },
      art: [
        { tag: 'rect', x: 1.5, y: 0, width: 11, height: 16, rx: 5.5, fill: C.suit, ...outline },
        { tag: 'rect', x: 0.5, y: 13, width: 13, height: 8.5, rx: 3.5, fill: C.boot, ...outline },
      ],
    },
    {
      key: 'torso',
      box: { x: 40, y: 62, w: 40, h: 34 },
      // Breathes from the belt, so the chest rises and the hips stay put.
      origin: { x: 20, y: 34 },
      art: [
        { tag: 'rect', x: 1, y: 2, width: 38, height: 31, rx: 11, fill: C.suit, ...outline },
        { tag: 'ellipse', cx: 20, cy: 4, rx: 14, ry: 4, fill: C.shade, ...outline },
        { tag: 'rect', x: 11, y: 12, width: 18, height: 10, rx: 3, fill: C.dark },
        { tag: 'rect', x: 2, y: 25, width: 36, height: 4, fill: C.shade },
      ],
      children: [
        {
          // The chest lights blink on their own clock.
          key: 'lights',
          box: { x: 13, y: 14, w: 14, h: 6 },
          origin: { x: 7, y: 3 },
          art: [
            { tag: 'circle', cx: 2.5, cy: 3, r: 1.9, fill: C.red },
            { tag: 'circle', cx: 7, cy: 3, r: 1.9, fill: C.lamp },
            { tag: 'circle', cx: 11.5, cy: 3, r: 1.9, fill: C.cyan },
          ],
        },
      ],
    },
    {
      key: 'head',
      box: { x: 26, y: 0, w: 68, h: 74 },
      // The neck. Nods and tilts pivot here, not at the middle of the helmet.
      origin: { x: 34, y: 68 },
      art: [
        { tag: 'circle', cx: 6.5, cy: 43, r: 5.2, fill: C.shade, ...outline },
        { tag: 'circle', cx: 61.5, cy: 43, r: 5.2, fill: C.shade, ...outline },
        { tag: 'circle', cx: 34, cy: 41, r: 29, fill: C.suit, ...outline },
        // A soft highlight on the shell, top left, where the light comes from.
        { tag: 'path', d: 'M13,30 Q17,17 29,14', fill: 'none', stroke: '#FFFFFF', strokeWidth: 3, strokeLinecap: 'round', opacity: 0.9 },
      ],
      children: [
        {
          key: 'antenna',
          box: { x: 34, y: 0, w: 14, h: 15 },
          origin: { x: 3, y: 14 },
          art: [
            { tag: 'path', d: 'M3,14 Q4,8 9,4', fill: 'none', stroke: C.line, strokeWidth: 2.2, strokeLinecap: 'round' },
            { tag: 'circle', cx: 9.5, cy: 4, r: 3.4, fill: C.glove, ...outline },
          ],
        },
        {
          key: 'visor',
          box: { x: 12, y: 22, w: 44, h: 32 },
          origin: { x: 22, y: 16 },
          clip: true,
          radius: 14,
          fill: C.visor,
          edge: C.visorEdge,
          children: [
            {
              // Tinted by the equipped background - see Mascot.js.
              key: 'sheen',
              box: { x: 0, y: 0, w: 44, h: 32 },
              origin: { x: 22, y: 16 },
              art: [
                { tag: 'path', d: 'M5,14 Q8,5 19,4', fill: 'none', stroke: 'REFLECTION', strokeWidth: 3, strokeLinecap: 'round', opacity: 0.45 },
              ],
            },
            {
              // Look and blink both move this one box, so the eyes stay a pair.
              key: 'eyes',
              box: { x: 9, y: 6, w: 26, h: 14 },
              origin: { x: 13, y: 7 },
              face: 'eyes',
            },
            {
              key: 'mouth',
              box: { x: 14, y: 18, w: 16, h: 11 },
              origin: { x: 8, y: 4 },
              face: 'mouth',
            },
            {
              // A band of light that crosses the glass every few seconds.
              // Parked just off the left of the glass; the idle loop sweeps it
              // across. Parked off-glass, so a mood with no sweep shows none.
              key: 'glint',
              box: { x: -12, y: -4, w: 8, h: 40 },
              origin: { x: 4, y: 20 },
              art: [
                { tag: 'rect', x: 0, y: 0, width: 8, height: 40, fill: '#FFFFFF', opacity: 0.22 },
              ],
            },
          ],
        },
      ],
    },
    {
      // Arms come after the head so a raised arm, a wave or a facepalm is drawn
      // in front of the helmet rather than tucked behind it.
      //
      // Screen-left arm. Positive rotation swings the glove out and up.
      key: 'armL',
      box: { x: 28, y: 64, w: 15, h: 30 },
      origin: { x: 11, y: 4 },
      art: [
        { tag: 'rect', x: 4, y: 0, width: 10.5, height: 22, rx: 5.2, fill: C.suit, ...outline },
        { tag: 'circle', cx: 9, cy: 24, r: 5.6, fill: C.glove, ...outline },
      ],
    },
    {
      // Screen-right arm. Negative rotation swings it out and up.
      key: 'armR',
      box: { x: 77, y: 64, w: 15, h: 30 },
      origin: { x: 4, y: 4 },
      art: [
        { tag: 'rect', x: 0.5, y: 0, width: 10.5, height: 22, rx: 5.2, fill: C.suit, ...outline },
        { tag: 'circle', cx: 6, cy: 24, r: 5.6, fill: C.glove, ...outline },
      ],
    },
  ],
};

/** Every part key in draw order, depth first. */
export const PART_KEYS = (() => {
  const keys = [];
  const walk = (part) => {
    keys.push(part.key);
    (part.children || []).forEach(walk);
  };
  walk(RIG);
  return keys;
})();

/* ---------------------------------------------------------------- face -- */

const eye = (cx) => [
  { tag: 'ellipse', cx, cy: 7, rx: 6, ry: 7, fill: C.glow, opacity: 0.18 },
  { tag: 'ellipse', cx, cy: 7, rx: 3.5, ry: 4.6, fill: C.glow },
];
const line = (d) => ({ tag: 'path', d, fill: 'none', stroke: C.glow, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' });

/** Drawn in the eyes box (26x14), eye centres at x 6 and 20. */
export const EYES = {
  open: [...eye(6), ...eye(20)],
  wide: [
    { tag: 'ellipse', cx: 6, cy: 7, rx: 4.6, ry: 6, fill: C.glow },
    { tag: 'ellipse', cx: 20, cy: 7, rx: 4.6, ry: 6, fill: C.glow },
    { tag: 'circle', cx: 6, cy: 7.5, r: 1.6, fill: C.visor },
    { tag: 'circle', cx: 20, cy: 7.5, r: 1.6, fill: C.visor },
  ],
  happy: [line('M2,9.5 Q6,3 10,9.5'), line('M16,9.5 Q20,3 24,9.5')],
  closed: [line('M2,7 Q6,10.5 10,7'), line('M16,7 Q20,10.5 24,7')],
  wince: [line('M2.5,3.5 L9,7 L2.5,10.5'), line('M23.5,3.5 L17,7 L23.5,10.5')],
  dizzy: [line('M3,4 L9,10 M9,4 L3,10'), line('M17,4 L23,10 M23,4 L17,10')],
  focused: [
    { tag: 'ellipse', cx: 6, cy: 8, rx: 3.6, ry: 3, fill: C.glow },
    { tag: 'ellipse', cx: 20, cy: 8, rx: 3.6, ry: 3, fill: C.glow },
    line('M1.5,3.5 L10,5.5'),
    line('M24.5,3.5 L16,5.5'),
  ],
};

const mouthLine = (d) => ({ tag: 'path', d, fill: 'none', stroke: C.glow, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' });

/** Drawn in the mouth box (16x11). */
export const MOUTHS = {
  smile: [mouthLine('M3,3 Q8,7.5 13,3')],
  grin: [{ tag: 'path', d: 'M2.5,2 Q8,10 13.5,2 Z', fill: C.glow }],
  bigGrin: [{ tag: 'path', d: 'M1,1.5 Q8,12 15,1.5 Z', fill: C.glow }],
  o: [{ tag: 'ellipse', cx: 8, cy: 4.5, rx: 2.2, ry: 2.8, fill: C.glow }],
  wow: [{ tag: 'ellipse', cx: 8, cy: 5, rx: 3.6, ry: 4.4, fill: C.glow }],
  wobble: [mouthLine('M2,4.5 Q5,2 8,4.5 Q11,7 14,4.5')],
  hmm: [mouthLine('M4,5 Q8,3.2 12,4.2')],
  zigzag: [mouthLine('M1.5,4.5 L4,2.5 L6.5,5.5 L9,2.5 L11.5,5.5 L14.5,3.5')],
};

/** One expression per mood. tests/mascot.test.js fails if a mood has none. */
export const EXPRESSIONS = {
  idle: { eyes: 'open', mouth: 'smile' },
  happy: { eyes: 'happy', mouth: 'grin' },
  ecstatic: { eyes: 'happy', mouth: 'bigGrin' },
  oops: { eyes: 'wince', mouth: 'wobble' },
  sleepy: { eyes: 'closed', mouth: 'o' },
  thinking: { eyes: 'open', mouth: 'hmm' },
  dizzy: { eyes: 'dizzy', mouth: 'wobble' },
  panic: { eyes: 'wide', mouth: 'zigzag' },
  wave: { eyes: 'happy', mouth: 'grin' },
  focused: { eyes: 'focused', mouth: 'hmm' },
  wow: { eyes: 'wide', mouth: 'wow' },
  // Fidgets - things it does on its own when nobody is asking anything of it.
  flip: { eyes: 'happy', mouth: 'grin' },
  lookAround: { eyes: 'open', mouth: 'smile' },
  boost: { eyes: 'wide', mouth: 'grin' },
  stretch: { eyes: 'closed', mouth: 'wow' },
};

export const expressionFor = (mood) =>
  (Object.prototype.hasOwnProperty.call(EXPRESSIONS, mood) && EXPRESSIONS[mood]) || EXPRESSIONS.idle;

/** Finds a part in the rig by key. */
export const findPart = (key, part = RIG) => {
  if (part.key === key) return part;
  for (const child of part.children || []) {
    const found = findPart(key, child);
    if (found) return found;
  }
  return null;
};
