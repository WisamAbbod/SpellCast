import { colors } from './colors.js';

/**
 * The background catalog.
 *
 * Deliberately NOT a theme system. Only four things vary - the base gradient, an
 * alpha overlay above it, an SVG scenery band, and the particle field - because
 * those are the only four places in the app that draw the backdrop, and all four
 * live in Screen.js. Everything else (cards, text, tiles, medals) is baked into
 * ~21 module-scope stylesheets that cannot react to a runtime swap, and stays
 * exactly as it is.
 *
 * The contract every entry must honour: the gradient stays dark enough that
 * colors.text, colors.textDim and colors.surface still read on top of it.
 * tests/economy.test.js asserts the luminance bound rather than trusting it.
 *
 * Pure data, no react imports - so every path string below is checked by the
 * node tests. A truncated `d` renders as nothing and is otherwise silent, which
 * is exactly the kind of bug worth a test.
 */

export const DEFAULT_BACKGROUND = 'nebula';

/* Pine ridges. Two layers at different heights and alphas read as depth; one
   layer reads as a sawtooth. The back ridge is taller and dimmer, so it sits
   further away. */
const PINES_BACK =
  'M0,140 L0,90 L12,58 L24,90 L38,50 L50,90 L66,64 L78,90 L92,44 L104,90 ' +
  'L118,60 L130,90 L146,52 L158,90 L172,68 L184,90 L200,46 L212,90 L226,62 ' +
  'L238,90 L254,54 L266,90 L280,66 L292,90 L308,48 L320,90 L334,56 L346,90 ' +
  'L362,70 L374,90 L388,50 L400,90 L400,140 Z';

const PINES_FRONT =
  'M0,140 L0,114 L14,78 L30,114 L52,88 L70,114 L94,72 L112,114 L136,84 ' +
  'L154,114 L180,76 L198,114 L222,90 L240,114 L266,74 L284,114 L308,86 ' +
  'L326,114 L352,80 L370,114 L392,82 L400,114 L400,140 Z';

const SNOW_HILLS_BACK =
  'M0,140 L0,96 C46,78 92,106 148,92 C206,78 250,104 308,90 ' +
  'C350,80 378,96 400,88 L400,140 Z';

const SNOW_HILLS_FRONT =
  'M0,140 L0,118 C54,104 104,126 164,114 C224,102 268,124 326,112 ' +
  'C362,104 384,116 400,110 L400,140 Z';

/* The aurora ribbon is a closed band rather than a stroke: a filled ribbon can
   taper along its length, a stroked one cannot. */
const AURORA_RIBBON_HIGH =
  'M0,10 C70,44 130,2 200,32 C270,62 330,14 400,40 L400,66 ' +
  'C330,40 270,88 200,58 C130,28 70,70 0,36 Z';

const AURORA_RIBBON_LOW =
  'M0,44 C80,72 140,30 210,56 C280,82 340,38 400,60 L400,78 ' +
  'C340,56 280,100 210,74 C140,48 80,90 0,62 Z';

const SEABED =
  'M0,140 L0,120 C40,112 70,126 104,118 C140,110 168,124 206,116 ' +
  'C248,108 280,122 320,114 C356,107 380,118 400,112 L400,140 Z';

/* Kelp is stroked, not filled - a frond is a line with thickness, and filling
   these paths would close them into blobs. */
const KELP = [
  'M42,140 C34,112 50,96 42,68 C36,48 46,32 42,14',
  'M104,140 C112,116 98,100 108,76 C116,58 106,44 112,26',
  'M182,140 C174,118 188,104 180,82 C174,66 184,52 178,34',
  'M258,140 C268,114 254,98 264,74 C272,56 262,42 268,22',
  'M330,140 C322,116 336,102 328,78 C322,60 332,46 326,28',
  'M372,140 C380,120 368,106 376,86',
];

const kelpLayer = (d) => ({
  d,
  fill: 'none',
  stroke: '#031C22',
  strokeWidth: 7,
  strokeLinecap: 'round',
  opacity: 0.9,
});

export const BACKGROUNDS = {
  nebula: {
    key: 'nebula',
    name: 'Nebula',
    mood: 'Deep space',
    blurb: 'Where it all started.',
    price: 0,
    flat: colors.backdropFlat,
    gradient: colors.backdrop,
    start: { x: 0.1, y: 0 },
    end: { x: 0.9, y: 1 },
    overlay: null,
    scenery: null,
    particles: { motion: 'twinkle', tint: '#FFFFFF', density: 1, sizeScale: 1, glow: false },
  },

  aurora: {
    key: 'aurora',
    name: 'Aurora',
    mood: 'Cold fire',
    blurb: 'Green light over a frozen horizon.',
    price: 150,
    flat: '#02100D',
    gradient: ['#02100D', '#07241F', '#0A3B2F'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    overlay: {
      colors: ['rgba(61,220,151,0)', 'rgba(61,220,151,0.12)', 'rgba(74,222,222,0.20)'],
      start: { x: 0.5, y: 1 },
      end: { x: 0.5, y: 0.12 },
    },
    scenery: null,
    particles: { motion: 'twinkle', tint: '#CFFFF0', density: 0.75, sizeScale: 1.15, glow: false },
  },

  forest: {
    key: 'forest',
    name: 'Forest',
    mood: 'Under the canopy',
    blurb: 'Pines, and something small blinking between them.',
    price: 300,
    flat: '#04120C',
    gradient: ['#04120C', '#0A2417', '#123020'],
    start: { x: 0.15, y: 0 },
    end: { x: 0.85, y: 1 },
    overlay: {
      // A shaft of warm light from the upper left, the way it arrives through
      // trees. Gone well before the bottom, so the tree line stays black.
      colors: ['rgba(255,209,102,0.13)', 'rgba(255,209,102,0.03)', 'rgba(0,0,0,0)'],
      start: { x: 0.1, y: 0 },
      end: { x: 0.75, y: 0.85 },
    },
    scenery: [
      {
        anchor: 'bottom',
        height: 0.3,
        viewBox: '0 0 400 140',
        layers: [
          { d: PINES_BACK, fill: '#03100A', opacity: 0.85 },
          { d: PINES_FRONT, fill: '#010805', opacity: 0.95 },
        ],
      },
    ],
    particles: { motion: 'drift', tint: '#FFE9A3', density: 0.55, sizeScale: 1.5, glow: true },
  },

  tundra: {
    key: 'tundra',
    name: 'Tundra',
    mood: 'Nothing for miles',
    blurb: 'Snow, and a sky doing something remarkable about it.',
    price: 450,
    flat: '#050A18',
    gradient: ['#050A18', '#0C1734', '#16224A'],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    overlay: {
      colors: ['rgba(74,222,222,0.10)', 'rgba(124,92,255,0.05)', 'rgba(0,0,0,0)'],
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 0.7 },
    },
    scenery: [
      {
        anchor: 'top',
        height: 0.24,
        viewBox: '0 0 400 120',
        layers: [
          { d: AURORA_RIBBON_HIGH, fill: '#3DDC97', opacity: 0.16 },
          { d: AURORA_RIBBON_LOW, fill: '#4ADEDE', opacity: 0.11 },
        ],
      },
      {
        anchor: 'bottom',
        height: 0.26,
        viewBox: '0 0 400 140',
        layers: [
          { d: SNOW_HILLS_BACK, fill: '#1B2950', opacity: 0.9 },
          { d: SNOW_HILLS_FRONT, fill: '#0E1733', opacity: 0.95 },
        ],
      },
    ],
    particles: { motion: 'fall', tint: '#E8F2FF', density: 0.7, sizeScale: 1.1, glow: false },
  },

  abyss: {
    key: 'abyss',
    name: 'Abyss',
    mood: 'A long way down',
    blurb: 'Light gives up before the bottom does.',
    price: 600,
    flat: '#00080C',
    // Lightest stop first: the light is at the TOP of a water column, which is
    // the opposite of every other entry here.
    gradient: ['#04262E', '#02181F', '#00080C'],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    overlay: {
      colors: ['rgba(191,239,245,0.11)', 'rgba(74,222,222,0.03)', 'rgba(0,0,0,0)'],
      start: { x: 0.35, y: 0 },
      end: { x: 0.65, y: 0.6 },
    },
    scenery: [
      {
        anchor: 'bottom',
        height: 0.34,
        viewBox: '0 0 400 140',
        // Kelp first, seabed over it, so the fronds appear rooted rather than
        // stuck on top of the floor.
        layers: [...KELP.map(kelpLayer), { d: SEABED, fill: '#010F14', opacity: 0.95 }],
      },
    ],
    particles: { motion: 'rise', tint: '#BFEFF5', density: 0.5, sizeScale: 1.25, glow: false },
  },
};

export const BACKGROUND_ORDER = ['nebula', 'aurora', 'forest', 'tundra', 'abyss'];

export const backgroundFor = (key) => BACKGROUNDS[key] || BACKGROUNDS[DEFAULT_BACKGROUND];
