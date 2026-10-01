import { ASTRO_COLORS } from './astronaut.js';

/**
 * Costumes for the astronaut, as pure data - like the rig they dress.
 *
 * A costume is a set of extra shapes keyed by rig part, drawn in that part's
 * own coordinates on top of its art. Because each piece belongs to a part, it
 * moves with it: a hat tilts when the head nods and goes round with a backflip,
 * a scarf rises with the chest. Nothing about the animation has to know.
 *
 *   parts   { head: [elements], torso: [elements], ... }  same element format
 *           as theme/astronaut.js, and may reach outside the part's box (a hat
 *           sits above the helmet); Mascot.js gives costume layers room for it
 *   hide    rig parts the costume replaces - a crown and an antenna fight, so
 *           the antenna goes
 *   over    optional { part: [elements] } drawn ABOVE that part's children -
 *           an eyepatch has to cover the eye, which lives inside the visor
 *   palette optional { role: colour } over ASTRO_COLORS - recolours the suit
 *           itself (the gold suit, the Mk II). See paletteSwap.
 *   tier    'premium' for the suits: priced and badged as the long goals
 *
 * A held prop goes on an arm, ending in GRIP_L / GRIP_R so the hand closes
 * round it.
 *
 * Head box is 68x74 with the helmet centred at (34, 41), radius 29, so the top
 * of the helmet is y=12. Torso box is 40x34, collar at y=4.
 *
 * Checked by tests/mascot.test.js like every other shape: a broken path draws
 * nothing and says nothing.
 */

const line = { stroke: '#A9AFD2', strokeWidth: 1.6 };
const leather = { stroke: '#7A4523', strokeWidth: 1.5, strokeLinejoin: 'round' };
const tweed = { stroke: '#6A5130', strokeWidth: 1.4, strokeLinejoin: 'round' };
const copper = { stroke: '#7A4420', strokeWidth: 1.5, strokeLinejoin: 'round' };
const plate = { fill: '#4A5688', stroke: '#4ADEDE', strokeWidth: 1.4, strokeLinejoin: 'round' };
const glowLine = { stroke: '#4ADEDE', strokeWidth: 1.3, strokeLinecap: 'round' };

/**
 * The glove, drawn again over whatever it holds. A costume layer sits on top
 * of its part's art, so without this a handle would cross IN FRONT of the
 * fingers; with it, the prop goes into the fist and comes out the other side.
 * Matches the rig's own gloves (armL glove at 9,24, armR at 6,24).
 */
const GRIP_L = { tag: 'circle', cx: 9, cy: 24, r: 5.6, fill: '#FFD166', ...line };
const GRIP_R = { tag: 'circle', cx: 6, cy: 24, r: 5.6, fill: '#FFD166', ...line };

/** A four-point glint, the kind that sits on anything polished. */
const twinkle = (x, y, r) => ({
  tag: 'path',
  d: `M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r} Z`,
  fill: '#FFFFFF',
  opacity: 0.95,
});

export const DEFAULT_COSTUME = 'none';

export const COSTUMES = {
  none: {
    key: 'none',
    name: 'No costume',
    mood: 'Standard issue',
    blurb: 'Just the suit. A classic.',
    price: 0,
    parts: {},
    hide: [],
  },

  party: {
    key: 'party',
    name: 'Party Hat',
    mood: 'Celebratory',
    blurb: 'Every word is a reason.',
    price: 80,
    parts: {
      head: [
        { tag: 'path', d: 'M13,20 L37,12 L19,-15 Z', fill: '#FF7BD5', ...line },
        { tag: 'path', d: 'M16,6 L31,1', fill: 'none', stroke: '#FFFFFF', strokeWidth: 2.4, strokeLinecap: 'round', opacity: 0.85 },
        { tag: 'path', d: 'M14.5,14 L34,7.5', fill: 'none', stroke: '#4ADEDE', strokeWidth: 2.4, strokeLinecap: 'round' },
        { tag: 'circle', cx: 19, cy: -16, r: 4, fill: '#FFD166', ...line },
      ],
    },
    hide: [],
  },

  scarf: {
    key: 'scarf',
    name: 'Cosy Scarf',
    mood: 'Toasty',
    blurb: 'Space is cold. Fact.',
    price: 120,
    parts: {
      // The band is drawn on the HEAD, round the bottom of the helmet: the
      // helmet overlaps the top of the torso, so a band drawn on the torso is
      // hidden behind it. Only the tail hangs from the chest.
      head: [
        { tag: 'rect', x: 14, y: 62, width: 40, height: 9, rx: 4.5, fill: '#FF5E7D', ...line },
        { tag: 'path', d: 'M22,63 L22,70 M30,63 L30,70 M38,63 L38,70 M46,63 L46,70', fill: 'none', stroke: '#FFD166', strokeWidth: 2, strokeLinecap: 'round' },
      ],
      torso: [
        { tag: 'path', d: 'M29,3 L37,3 L38,22 L29,22 Z', fill: '#FF5E7D', ...line },
        { tag: 'path', d: 'M29.5,18 L37.5,18', fill: 'none', stroke: '#FFD166', strokeWidth: 2, strokeLinecap: 'round' },
      ],
    },
    hide: [],
  },

  cat: {
    key: 'cat',
    name: 'Cat Ears',
    mood: 'Curious',
    blurb: 'Lands on its feet, even in zero G.',
    price: 180,
    parts: {
      head: [
        { tag: 'path', d: 'M10,26 L12,2 L29,15 Z', fill: '#F4F3FF', ...line },
        { tag: 'path', d: 'M39,15 L56,2 L58,26 Z', fill: '#F4F3FF', ...line },
        { tag: 'path', d: 'M14,20 L15,8 L24,15 Z', fill: '#FF8FA3' },
        { tag: 'path', d: 'M44,15 L53,8 L54,20 Z', fill: '#FF8FA3' },
      ],
    },
    hide: ['antenna'],
  },

  wizard: {
    key: 'wizard',
    name: 'Wizard Hat',
    mood: 'Arcane',
    blurb: 'A game about casting spells deserves one.',
    price: 240,
    parts: {
      head: [
        { tag: 'path', d: 'M17,15 Q28,-2 36,-30 Q41,-10 51,15 Z', fill: '#5B3FE0', ...line },
        { tag: 'ellipse', cx: 34, cy: 15, rx: 24, ry: 5.5, fill: '#4A32C0', ...line },
        { tag: 'path', d: 'M30,-2 l1.6,3.4 3.6,.4 -2.7,2.4 .8,3.6 -3.3,-1.9 -3.3,1.9 .8,-3.6 -2.7,-2.4 3.6,-.4 Z', fill: '#FFD166' },
        { tag: 'circle', cx: 41, cy: 7, r: 1.6, fill: '#FFD166' },
        { tag: 'circle', cx: 26, cy: 9, r: 1.2, fill: '#FFD166' },
      ],
    },
    hide: ['antenna'],
  },

  crown: {
    key: 'crown',
    name: 'Crown',
    mood: 'Regal',
    blurb: 'For whoever is top of the leaderboard. Or believes they will be.',
    price: 320,
    parts: {
      head: [
        { tag: 'path', d: 'M19,17 L18,1 L26,9 L34,-5 L42,9 L50,1 L49,17 Z', fill: '#FFD166', ...line },
        { tag: 'rect', x: 18, y: 13, width: 32, height: 5, rx: 2, fill: '#F2B84B', ...line },
        { tag: 'circle', cx: 34, cy: 5, r: 2.4, fill: '#FF5E7D' },
        { tag: 'circle', cx: 25, cy: 12, r: 1.6, fill: '#4ADEDE' },
        { tag: 'circle', cx: 43, cy: 12, r: 1.6, fill: '#4ADEDE' },
      ],
    },
    hide: ['antenna'],
  },

  /* ---- the second rack: costumes that bring something to hold ----------- */

  cowboy: {
    key: 'cowboy',
    name: 'Cowboy',
    mood: 'Yeehaw',
    blurb: 'Hat, bandana and a lasso for rounding up stray letters.',
    price: 400,
    parts: {
      head: [
        // Crown first, brim over it: the brim is the front of the hat.
        { tag: 'path', d: 'M17,17 C16,4 20,-6 27,-6 C30,-6 31,-2 34,-2 C37,-2 38,-6 41,-6 C48,-6 52,4 51,17 Z', fill: '#C27C45', ...leather },
        { tag: 'path', d: 'M17.4,10 L50.6,10 L51,16 L17,16 Z', fill: '#4A2A18' },
        { tag: 'circle', cx: 24, cy: 13, r: 1.6, fill: '#E8E8F0' },
        { tag: 'path', d: 'M-3,9 C1,19 10,21 34,21 C58,21 67,19 71,9 C66,15 58,16 34,16 C10,16 2,15 -3,9 Z', fill: '#B36F3B', ...leather },
        // The bandana knots round the bottom of the helmet, like the scarf.
        { tag: 'path', d: 'M14,61 Q34,69 54,61 L54,66 Q34,74 14,66 Z', fill: '#D6453D', ...line },
        { tag: 'path', d: 'M25,68 L43,68 L34,79 Z', fill: '#D6453D', ...line },
        { tag: 'circle', cx: 30, cy: 71, r: 1, fill: '#FFFFFF' },
        { tag: 'circle', cx: 37, cy: 71, r: 1, fill: '#FFFFFF' },
        { tag: 'circle', cx: 34, cy: 75, r: 1, fill: '#FFFFFF' },
      ],
      armR: [
        // A coiled lasso hanging from the glove...
        { tag: 'ellipse', cx: 10, cy: 37, rx: 10, ry: 7, fill: 'none', stroke: '#B8893F', strokeWidth: 2.4 },
        { tag: 'ellipse', cx: 9, cy: 36, rx: 9, ry: 6.2, fill: 'none', stroke: '#E0BC78', strokeWidth: 2.4 },
        { tag: 'ellipse', cx: 11, cy: 38, rx: 8, ry: 5.4, fill: 'none', stroke: '#D2A85E', strokeWidth: 2.2 },
        // The loose end, swinging free.
        { tag: 'path', d: 'M17,42 C20,46 19,50 15,52', fill: 'none', stroke: '#D2A85E', strokeWidth: 2.2, strokeLinecap: 'round' },
        // ...and the glove drawn again on top, so the rope runs THROUGH the hand.
        GRIP_R,
      ],
    },
    hide: ['antenna'],
  },

  detective: {
    key: 'detective',
    name: 'Detective',
    mood: 'Inquisitive',
    blurb: 'No word escapes the magnifying glass.',
    price: 450,
    parts: {
      head: [
        // Ear flaps first: the cap's dome overlaps their tops.
        { tag: 'path', d: 'M10,22 Q3,34 6,46 Q11,49 15,45 L16,25 Z', fill: '#A9874F', ...tweed },
        { tag: 'path', d: 'M58,22 Q65,34 62,46 Q57,49 53,45 L52,25 Z', fill: '#A9874F', ...tweed },
        { tag: 'path', d: 'M10,25 Q34,-11 58,25 Z', fill: '#B4935E', ...tweed },
        { tag: 'path', d: 'M17,15 L51,15 M13,20 L55,20 M34,7 L34,24 M24,10 L21,24 M44,10 L47,24', fill: 'none', stroke: '#8C6D3F', strokeWidth: 1.1, opacity: 0.7 },
        // The bow on top that ties the flaps up when it is not cold.
        { tag: 'path', d: 'M34,7 C27,0 23,5 28,8.5 Z', fill: '#8C6D3F', ...tweed },
        { tag: 'path', d: 'M34,7 C41,0 45,5 40,8.5 Z', fill: '#8C6D3F', ...tweed },
      ],
      armL: [
        { tag: 'path', d: 'M8,27 L2.5,35', fill: 'none', stroke: '#6B4A2E', strokeWidth: 3.4, strokeLinecap: 'round' },
        { tag: 'circle', cx: -1.5, cy: 42, r: 7.5, fill: '#D9F7FF', opacity: 0.8 },
        { tag: 'circle', cx: -1.5, cy: 42, r: 7.5, fill: 'none', stroke: '#C99A45', strokeWidth: 2.6 },
        { tag: 'path', d: 'M-6,40.5 Q-5,36.5 -1,36', fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.8, strokeLinecap: 'round' },
        GRIP_L,
      ],
    },
    hide: ['antenna'],
  },

  pirate: {
    key: 'pirate',
    name: 'Space Pirate',
    mood: 'Swashbuckling',
    blurb: 'Plunders vowels. Leaves the consonants.',
    price: 520,
    parts: {
      head: [
        { tag: 'path', d: 'M15,15 C15,-3 53,-3 53,15 Z', fill: '#241E33', ...line },
        { tag: 'path', d: 'M-1,15 C6,2 20,8 34,1 C48,8 62,2 69,15 C58,21 46,17 34,20 C22,17 10,21 -1,15 Z', fill: '#352C48', stroke: '#E8B53A', strokeWidth: 1.8, strokeLinejoin: 'round' },
        { tag: 'path', d: 'M29.5,11 L38.5,16 M38.5,11 L29.5,16', fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.6, strokeLinecap: 'round' },
        { tag: 'circle', cx: 34, cy: 9.5, r: 3.2, fill: '#FFFFFF' },
        { tag: 'circle', cx: 32.8, cy: 9.3, r: 0.8, fill: '#352C48' },
        { tag: 'circle', cx: 35.2, cy: 9.3, r: 0.8, fill: '#352C48' },
        // The patch's strap, where it shows on the helmet beside the visor.
        { tag: 'path', d: 'M5.6,37 L12.5,31.5', fill: 'none', stroke: '#1A1626', strokeWidth: 2, strokeLinecap: 'round' },
      ],
      armR: [
        // A cutlass held point-down at the side, curving out.
        { tag: 'path', d: 'M5,27 C9,38 14,45 23,50 C17,43 12,36 9,26 Z', fill: '#DDE3F0', stroke: '#8A93B8', strokeWidth: 1.2, strokeLinejoin: 'round' },
        { tag: 'path', d: 'M0,27 Q6,32 12,27', fill: 'none', stroke: '#E8B53A', strokeWidth: 2.2, strokeLinecap: 'round' },
        GRIP_R,
      ],
    },
    // Over the glass AND the eyes behind it, clipped by the visor's window like
    // a sticker. It covers the screen-left eye; the other does all the looking.
    over: {
      visor: [
        { tag: 'path', d: 'M-2,10.5 L9,9.5 M21,8 L46,1.5', fill: 'none', stroke: '#2A2238', strokeWidth: 2.2, strokeLinecap: 'round' },
        { tag: 'ellipse', cx: 15, cy: 13, rx: 7, ry: 6.8, fill: '#2A2238', stroke: '#4A4064', strokeWidth: 1.2 },
        { tag: 'path', d: 'M11.5,10.5 Q13.5,8.6 16.5,8.8', fill: 'none', stroke: '#6A5E8C', strokeWidth: 1.1, strokeLinecap: 'round' },
      ],
    },
    hide: ['antenna'],
  },

  /* ---- premium: the whole suit changes, not just what is on it ---------- */

  gold: {
    key: 'gold',
    name: 'Gold Suit',
    mood: 'Dazzling',
    blurb: 'Fresh from the treasury. Mind the glare.',
    price: 950,
    tier: 'premium',
    // Recolours the rig itself - see paletteSwap below.
    palette: {
      suit: '#FFD45C',
      shade: '#EDB43F',
      line: '#B5821E',
      glove: '#FFF4DA',
      boot: '#9A6B16',
      pack: '#E4AA36',
      dark: '#2E220C',
      visorEdge: '#B5821E',
    },
    parts: {
      head: [
        twinkle(61, 14, 4.2),
        twinkle(6, 22, 2.6),
      ],
      torso: [
        { tag: 'path', d: 'M5.5,13 Q5.5,8.5 10,7.5', fill: 'none', stroke: '#FFFFFF', strokeWidth: 2, strokeLinecap: 'round', opacity: 0.7 },
      ],
      armR: [twinkle(14, 2, 2.4)],
    },
    hide: [],
  },

  diver: {
    key: 'diver',
    name: 'Deep Sea Diver',
    mood: 'Fathoms down',
    blurb: 'Copper helmet, lead boots, and a fish that will not leave.',
    price: 1150,
    tier: 'premium',
    palette: {
      suit: '#D8C59A', // canvas
      shade: '#B9A273',
      line: '#6E5630',
      glove: '#5A4632',
      boot: '#A9742C',
      pack: '#8C5A2C',
      dark: '#33261A',
      visor: '#0C2F3A', // sea-green glass
      visorEdge: '#E3AE55',
      // No flame down here: the thruster blows a stream of bubbles.
      flame: '#BFF3FF',
      flameCore: '#FFFFFF',
    },
    parts: {
      head: [
        // The copper helmet goes over the suit's own shell entirely. The rig's
        // helmet takes the suit colour, and a diver's must not be canvas.
        { tag: 'circle', cx: 34, cy: 41, r: 29, fill: '#C9773F', ...copper },
        { tag: 'path', d: 'M13,30 Q17,17 29,14', fill: 'none', stroke: '#F6C79A', strokeWidth: 3, strokeLinecap: 'round', opacity: 0.85 },
        { tag: 'path', d: 'M8,54 Q34,66 60,54', fill: 'none', stroke: '#7A4420', strokeWidth: 1.2, opacity: 0.55 },
        // Side portholes, where the ear pieces were.
        { tag: 'circle', cx: 6.5, cy: 43, r: 6, fill: '#E3AE55', ...copper },
        { tag: 'circle', cx: 6.5, cy: 43, r: 3.1, fill: '#1B5563', stroke: '#7A4420', strokeWidth: 1 },
        { tag: 'circle', cx: 61.5, cy: 43, r: 6, fill: '#E3AE55', ...copper },
        { tag: 'circle', cx: 61.5, cy: 43, r: 3.1, fill: '#1B5563', stroke: '#7A4420', strokeWidth: 1 },
        // The faceplate: a brass ring the visor sits inside, bolted all round.
        { tag: 'rect', x: 8.5, y: 18.5, width: 51, height: 39, rx: 17.5, fill: '#E3AE55', ...copper },
        { tag: 'circle', cx: 34, cy: 20.4, r: 1.15, fill: '#7A4420' },
        { tag: 'circle', cx: 34, cy: 55.6, r: 1.15, fill: '#7A4420' },
        { tag: 'circle', cx: 10.3, cy: 38, r: 1.15, fill: '#7A4420' },
        { tag: 'circle', cx: 57.7, cy: 38, r: 1.15, fill: '#7A4420' },
        { tag: 'circle', cx: 16.6, cy: 24.6, r: 1.15, fill: '#7A4420' },
        { tag: 'circle', cx: 51.4, cy: 24.6, r: 1.15, fill: '#7A4420' },
        { tag: 'circle', cx: 16.6, cy: 51.4, r: 1.15, fill: '#7A4420' },
        { tag: 'circle', cx: 51.4, cy: 51.4, r: 1.15, fill: '#7A4420' },
        // The air hose, off up to a boat somewhere overhead.
        { tag: 'path', d: 'M40,11 C50,6 52,-6 60,-12 C66,-16 70,-22 70,-28', fill: 'none', stroke: '#4A3A2A', strokeWidth: 3.6, strokeLinecap: 'round' },
        { tag: 'path', d: 'M40,10 C50,5 52,-7 60,-13 C66,-17 69,-22 69,-27', fill: 'none', stroke: '#8A7355', strokeWidth: 1, strokeLinecap: 'round', opacity: 0.8 },
        { tag: 'rect', x: 28, y: 8.5, width: 13, height: 6, rx: 2.2, fill: '#E3AE55', ...copper },
        // The corselet: the brass collar the helmet bolts down onto.
        { tag: 'path', d: 'M12,60 Q34,70 56,60 L58,66 Q34,77 10,66 Z', fill: '#E3AE55', ...copper },
        { tag: 'circle', cx: 20, cy: 66.4, r: 1.1, fill: '#7A4420' },
        { tag: 'circle', cx: 34, cy: 69.4, r: 1.1, fill: '#7A4420' },
        { tag: 'circle', cx: 48, cy: 66.4, r: 1.1, fill: '#7A4420' },
        // Breath, on its way up.
        { tag: 'circle', cx: 0, cy: 14, r: 2.4, fill: 'none', stroke: '#BFF3FF', strokeWidth: 1.2, opacity: 0.9 },
        { tag: 'circle', cx: -5, cy: 4, r: 1.7, fill: 'none', stroke: '#BFF3FF', strokeWidth: 1.1, opacity: 0.8 },
        { tag: 'circle', cx: 1, cy: -4, r: 1.2, fill: 'none', stroke: '#BFF3FF', strokeWidth: 1, opacity: 0.7 },
      ],
      torso: [
        // Lead weights on the belt.
        { tag: 'rect', x: 5, y: 23.5, width: 6, height: 7, rx: 1.3, fill: '#7B8494', stroke: '#454C59', strokeWidth: 1 },
        { tag: 'rect', x: 17, y: 23.5, width: 6, height: 7, rx: 1.3, fill: '#7B8494', stroke: '#454C59', strokeWidth: 1 },
        { tag: 'rect', x: 29, y: 23.5, width: 6, height: 7, rx: 1.3, fill: '#7B8494', stroke: '#454C59', strokeWidth: 1 },
      ],
      armL: [{ tag: 'rect', x: 3.6, y: 15.5, width: 11.3, height: 3.6, rx: 1.6, fill: '#E3AE55', stroke: '#7A4420', strokeWidth: 1 }],
      armR: [{ tag: 'rect', x: 0.1, y: 15.5, width: 11.3, height: 3.6, rx: 1.6, fill: '#E3AE55', stroke: '#7A4420', strokeWidth: 1 }],
      // Soles heavy enough to keep him on the sea bed.
      legL: [{ tag: 'rect', x: 0, y: 18.6, width: 14, height: 3.2, rx: 1.3, fill: '#5E4320' }],
      legR: [{ tag: 'rect', x: 0, y: 18.6, width: 14, height: 3.2, rx: 1.3, fill: '#5E4320' }],
    },
    over: {
      // Pinned to the whole astronaut, so it drifts, bobs and somersaults with
      // him: a fish that has decided he is interesting.
      root: [
        { tag: 'path', d: 'M111,31 L117,27 L117,35 Z', fill: '#FF8A3D', stroke: '#C9621E', strokeWidth: 0.9, strokeLinejoin: 'round' },
        { tag: 'ellipse', cx: 105.5, cy: 31, rx: 6.4, ry: 4, fill: '#FF9F45', stroke: '#C9621E', strokeWidth: 1 },
        { tag: 'path', d: 'M105.5,27.3 Q107,31 105.5,34.7', fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.5, strokeLinecap: 'round' },
        { tag: 'circle', cx: 102, cy: 30.2, r: 0.95, fill: '#1B1B2A' },
      ],
    },
    hide: ['antenna'],
  },

  mk2: {
    key: 'mk2',
    name: 'Mk II Suit',
    mood: 'Cutting edge',
    blurb: 'Sharper lines, brighter lights, same astronaut inside.',
    price: 1400,
    tier: 'premium',
    palette: {
      suit: '#2C3350',
      shade: '#3B4570',
      line: '#4ADEDE',
      glove: '#1C2136',
      boot: '#161A2D',
      pack: '#232842',
      dark: '#0B0E20',
      visor: '#070A18',
      visorEdge: '#4ADEDE',
      // An ion drive: the thruster burns cyan.
      flame: '#4ADEDE',
      flameCore: '#E6FFFF',
    },
    parts: {
      head: [
        // Fins over the ear pieces, and a crest where the antenna was.
        { tag: 'path', d: 'M7,34 L-3,27 L0,52 L8,49 Z', ...plate },
        { tag: 'path', d: 'M61,34 L71,27 L68,52 L60,49 Z', ...plate },
        { tag: 'path', d: 'M1,33 L3,47 M67,33 L65,47', fill: 'none', ...glowLine },
        { tag: 'path', d: 'M29,14 L35,-5 L41,14 Z', ...plate },
        { tag: 'path', d: 'M35,1 L35,12', fill: 'none', ...glowLine },
        { tag: 'path', d: 'M9,53 L14,58 L22,58 M59,53 L54,58 L46,58', fill: 'none', ...glowLine, opacity: 0.85 },
      ],
      torso: [
        { tag: 'path', d: 'M4,14 L8,18 L4,22 M36,14 L32,18 L36,22', fill: 'none', ...glowLine },
        { tag: 'path', d: 'M4,27 L36,27', fill: 'none', ...glowLine },
      ],
      armL: [
        { tag: 'path', d: 'M2,-3 L15.5,-3 L15.5,7 L5,11 Z', ...plate },
        { tag: 'path', d: 'M9.2,13 L9.2,17.5', fill: 'none', ...glowLine },
      ],
      armR: [
        { tag: 'path', d: 'M-0.5,-3 L13,-3 L10,11 L-0.5,7 Z', ...plate },
        { tag: 'path', d: 'M5.8,13 L5.8,17.5', fill: 'none', ...glowLine },
      ],
      legL: [{ tag: 'path', d: 'M1,3 L13,3 L12,9 L2,9 Z', ...plate }],
      legR: [{ tag: 'path', d: 'M1,3 L13,3 L12,9 L2,9 Z', ...plate }],
    },
    hide: ['antenna'],
  },
};

export const COSTUME_ORDER = [
  'none', 'party', 'scarf', 'cat', 'wizard', 'crown',
  'cowboy', 'detective', 'pirate',
  'gold', 'diver', 'mk2',
];

export const isPremium = (costume) => !!costume && costume.tier === 'premium';

/**
 * A costume's palette as a colour-for-colour swap over the rig's own art:
 * { '#F4F3FF': '#FFD45C', ... }. Null for a costume that leaves the suit alone,
 * so the renderer can skip the lookup entirely.
 *
 * By value, which is why every ASTRO_COLORS role must have a distinct hex -
 * tests/mascot.test.js checks that - and why the costume's OWN pieces are never
 * swapped: a pirate's gold trim must stay gold whatever suit it is on.
 */
export const paletteSwap = (costume) => {
  const palette = costume && costume.palette;
  if (!palette) return null;
  const swap = {};
  Object.keys(palette).forEach((role) => {
    if (ASTRO_COLORS[role]) swap[ASTRO_COLORS[role]] = palette[role];
  });
  return swap;
};

export const costumeFor = (key) =>
  (key && Object.prototype.hasOwnProperty.call(COSTUMES, key) && COSTUMES[key]) ||
  COSTUMES[DEFAULT_COSTUME];
