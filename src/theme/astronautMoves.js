/**
 * How the astronaut moves, as keyframes.
 *
 * Data rather than code so it can be tuned by editing numbers, previewed
 * outside the app, and checked by tests/mascot.test.js - every track must name
 * a real part, run forward in time, and every reaction must land back at rest,
 * or the character would finish a wave with its arm stuck in the air.
 *
 * Two layers, added together on every part (scales multiply):
 *
 *   IDLE      loops for as long as a resting mood holds. Every track loops on
 *             its own clock, and the clocks are deliberately different lengths,
 *             so the combined motion never visibly repeats - that is what makes
 *             zero-G drift read as floating rather than as a bob.
 *   REACTIONS one-shot moves on top: a hop, a backflip, a facepalm.
 *   FIDGETS   reactions nobody asked for, played at random while idle, so it is
 *             never simply standing there.
 *
 * A key is [ms, value] or [ms, value, easing]. Values are absolute for that
 * layer: rotations in degrees, positions in rig units (120 across).
 * Act-layer rest is 0 for x / y / rot / opacity and 1 for scale / scaleY.
 */

export const PROPS = ['x', 'y', 'rot', 'scale', 'scaleY', 'opacity'];
export const EASINGS = ['linear', 'inOut', 'in', 'out', 'back', 'bounce'];

export const ACT_REST = { x: 0, y: 0, rot: 0, scale: 1, scaleY: 1, opacity: 0 };

const track = (part, prop, keys) => ({ part, prop, keys });

/* ---------------------------------------------------------------- idle -- */

/* Always running in every resting mood: the flame and the chest lights never
   stop, and the glint crosses the visor every few seconds. */
const ALWAYS = [
  track('lights', 'opacity', [[0, 1], [900, 1], [960, 0.35], [1300, 0.35], [1360, 1], [2300, 1]]),
  track('glint', 'x', [[0, 0], [3400, 0], [3950, 64, 'in'], [3960, 0]]),
];

/* The flame flickers by SIZE, never by fading: orange at half opacity over the
   dark backdrop reads as a muddy brown stub, not a flame. */
const calmFlame = [
  track('flame', 'opacity', [[0, 0.9], [150, 1], [300, 0.92], [450, 1], [600, 0.9]]),
  track('flame', 'scaleY', [[0, 0.7], [190, 0.95], [380, 0.75], [570, 0.9], [760, 0.7]]),
];

export const IDLE = {
  idle: [
    ...ALWAYS,
    ...calmFlame,
    track('root', 'x', [[0, 0], [2700, 5], [5400, 0], [8100, -5], [10800, 0]]),
    track('root', 'y', [[0, 0], [1900, -6], [3800, 0]]),
    track('root', 'rot', [[0, -3], [3100, 3], [6200, -3]]),
    track('head', 'rot', [[0, -4], [2300, 5], [4600, -4]]),
    track('antenna', 'rot', [[0, -10], [700, 12], [1400, -10]]),
    track('armL', 'rot', [[0, 10], [1500, 24], [3000, 10]]),
    track('armR', 'rot', [[0, -10], [1700, -26], [3400, -10]]),
    track('legL', 'rot', [[0, -6], [1300, 9], [2600, -6]]),
    track('legR', 'rot', [[0, 6], [1450, -9], [2900, 6]]),
    track('torso', 'scaleY', [[0, 1], [1100, 1.04], [2200, 1]]),
  ],

  // Asleep on its side, drifting slower, flame down to a pilot light.
  sleepy: [
    track('lights', 'opacity', [[0, 0.5], [2000, 0.2], [4000, 0.5]]),
    track('flame', 'opacity', [[0, 0.85], [1500, 1], [3000, 0.85]]),
    track('flame', 'scaleY', [[0, 0.35], [1500, 0.45], [3000, 0.35]]),
    track('root', 'rot', [[0, 66], [4200, 74], [8400, 66]]),
    track('root', 'y', [[0, 4], [3100, 0], [6200, 4]]),
    track('root', 'x', [[0, -2], [5000, 3], [10000, -2]]),
    track('head', 'rot', [[0, -6], [4000, -2], [8000, -6]]),
    track('antenna', 'rot', [[0, 28], [3000, 34], [6000, 28]]),
    track('armL', 'rot', [[0, 38], [4000, 46], [8000, 38]]),
    track('armR', 'rot', [[0, -28], [4400, -36], [8800, -28]]),
    track('legL', 'rot', [[0, 12], [3600, 18], [7200, 12]]),
    track('legR', 'rot', [[0, 20], [3900, 14], [7800, 20]]),
    track('torso', 'scaleY', [[0, 1], [2500, 1.06], [5000, 1]]),
  ],

  // The last ten seconds: everything too fast and too much.
  panic: [
    track('lights', 'opacity', [[0, 1], [120, 0.2], [240, 1]]),
    track('flame', 'opacity', [[0, 0.9], [60, 1], [120, 0.85], [180, 0.9]]),
    track('flame', 'scaleY', [[0, 1.35], [90, 1.85], [180, 1.35]]),
    track('root', 'x', [[0, -2], [70, 2], [140, -2]]),
    track('root', 'y', [[0, 0], [300, -4], [600, 0]]),
    track('head', 'rot', [[0, -6], [130, 6], [260, -6]]),
    track('antenna', 'rot', [[0, -26], [100, 26], [200, -26]]),
    track('armL', 'rot', [[0, 40], [180, 100], [360, 40]]),
    track('armR', 'rot', [[0, -40], [200, -105], [400, -40]]),
    track('legL', 'rot', [[0, -22], [150, 22], [300, -22]]),
    track('legR', 'rot', [[0, 22], [160, -22], [320, 22]]),
    track('torso', 'scaleY', [[0, 1], [150, 1.06], [300, 1]]),
  ],

  // Hand on chin. The upward glance is gaze, set by Mascot.js.
  thinking: [
    ...ALWAYS,
    ...calmFlame,
    track('root', 'y', [[0, 0], [2100, -4], [4200, 0]]),
    track('root', 'rot', [[0, 2], [3300, 5], [6600, 2]]),
    track('head', 'rot', [[0, 6], [2000, 11], [4000, 6]]),
    track('antenna', 'rot', [[0, -6], [1100, 10], [2200, -6]]),
    track('armL', 'rot', [[0, 14], [2000, 20], [4000, 14]]),
    track('armR', 'rot', [[0, 126], [500, 132], [1000, 126]]),
    track('armR', 'y', [[0, -3], [1000, -3]]),
    track('legL', 'rot', [[0, -4], [1800, 6], [3600, -4]]),
    track('legR', 'rot', [[0, 4], [2000, -6], [4000, 4]]),
    track('torso', 'scaleY', [[0, 1], [1300, 1.03], [2600, 1]]),
  ],
};

// Watching your finger is ordinary idling with the gaze locked on.
IDLE.focused = IDLE.idle;

/* ----------------------------------------------------------- reactions -- */

export const REACTIONS = {
  // A fist pump, a hop, a kick of the legs and a jet burst.
  happy: {
    duration: 900,
    puffAt: 80,
    tracks: [
      track('root', 'y', [[0, 0], [160, -16, 'out'], [400, 0, 'in'], [520, -4], [660, 0]]),
      track('root', 'scale', [[0, 1], [160, 1.06], [400, 0.96], [560, 1]]),
      track('armR', 'rot', [[0, 0], [140, -150, 'out'], [260, -128], [380, -156], [600, -150], [820, 0]]),
      track('armL', 'rot', [[0, 0], [160, 20], [600, 20], [820, 0]]),
      track('legL', 'rot', [[0, 0], [160, -20], [500, 0]]),
      track('legR', 'rot', [[0, 0], [160, 20], [500, 0]]),
      track('flame', 'opacity', [[0, 0], [80, 0.6], [500, 0]]),
      track('flame', 'scaleY', [[0, 1], [80, 1.9, 'out'], [500, 1]]),
      track('antenna', 'rot', [[0, 0], [200, -30], [450, 22], [700, 0]]),
    ],
  },

  // A crouch, a launch, a full backflip with both arms up.
  ecstatic: {
    duration: 1500,
    puffAt: 420,
    sparkle: true,
    tracks: [
      track('root', 'rot', [[0, 0], [220, -22], [980, 360, 'inOut']]),
      track('root', 'y', [[0, 0], [220, 6], [520, -34, 'out'], [980, -10], [1260, 0, 'bounce']]),
      track('root', 'scale', [[0, 1], [220, 0.9], [460, 1.1], [1260, 1]]),
      track('armL', 'rot', [[0, 0], [220, -10], [460, 150, 'out'], [1100, 150], [1400, 0]]),
      track('armR', 'rot', [[0, 0], [220, 10], [460, -150, 'out'], [1100, -150], [1400, 0]]),
      track('legL', 'rot', [[0, 0], [460, -42], [980, -42], [1220, 0]]),
      track('legR', 'rot', [[0, 0], [460, 42], [980, 42], [1220, 0]]),
      track('flame', 'opacity', [[0, 0], [420, 0.8], [1000, 0]]),
      track('flame', 'scaleY', [[0, 1], [420, 2.4, 'out'], [1000, 1]]),
      track('antenna', 'rot', [[0, 0], [500, 40], [900, -30], [1200, 12], [1400, 0]]),
    ],
  },

  // A hand across the visor, a slump, a head shaking in its palm, the flame sputtering.
  oops: {
    duration: 1200,
    tracks: [
      track('armR', 'rot', [[0, 0], [220, 162, 'out'], [900, 162], [1150, 0]]),
      track('armR', 'y', [[0, 0], [220, -9], [900, -9], [1150, 0]]),
      track('armR', 'x', [[0, 0], [220, -3], [900, -3], [1150, 0]]),
      track('head', 'rot', [[0, 0], [220, 8], [400, 13], [600, 6], [800, 13], [1000, 0]]),
      track('root', 'y', [[0, 0], [220, 3], [900, 3], [1150, 0]]),
      track('antenna', 'rot', [[0, 0], [220, 36], [900, 30], [1150, 0]]),
      // The flame sputters down to almost nothing, then catches again.
      track('flame', 'scaleY', [[0, 1], [200, 0.4], [520, 0.25], [900, 0.4], [1100, 1]]),
    ],
  },

  // Shuffle: two full spins, arms flung out, then a wobbly recovery.
  dizzy: {
    duration: 1600,
    puffAt: 60,
    tracks: [
      track('root', 'rot', [[0, 0], [900, 720, 'inOut'], [1080, 735], [1280, 712], [1500, 720]]),
      track('root', 'y', [[0, 0], [450, -10], [900, 0]]),
      track('head', 'rot', [[0, 0], [900, 0], [1050, 16], [1200, -13], [1350, 8], [1500, 0]]),
      track('armL', 'rot', [[0, 0], [200, 72], [900, 72], [1200, 0]]),
      track('armR', 'rot', [[0, 0], [200, -72], [900, -72], [1200, 0]]),
      track('legL', 'rot', [[0, 0], [200, -26], [900, -26], [1200, 0]]),
      track('legR', 'rot', [[0, 0], [200, 26], [900, 26], [1200, 0]]),
      track('flame', 'opacity', [[0, 0], [100, 0.7], [900, 0]]),
      track('flame', 'scaleY', [[0, 1], [100, 2], [900, 1]]),
    ],
  },

  // Hello. Three big waves, head tipped, antenna bouncing along.
  wave: {
    duration: 1600,
    tracks: [
      track('armR', 'rot', [[0, 0], [250, -150, 'out'], [450, -120], [650, -160], [850, -120], [1050, -160], [1250, -132], [1550, 0]]),
      track('head', 'rot', [[0, 0], [250, -9], [1250, -9], [1550, 0]]),
      track('root', 'y', [[0, 0], [250, -6], [1250, -6], [1550, 0]]),
      track('antenna', 'rot', [[0, 0], [300, 22], [600, -16], [900, 16], [1200, -10], [1500, 0]]),
      track('armL', 'rot', [[0, 0], [250, 10], [1250, 10], [1550, 0]]),
    ],
  },

  // No medal: a shrug. Thoughtful, not sad.
  thinking: {
    duration: 1400,
    tracks: [
      track('armL', 'rot', [[0, 0], [250, 52, 'out'], [900, 52], [1200, 0]]),
      track('armR', 'rot', [[0, 0], [250, -52, 'out'], [900, -52], [1200, 0]]),
      track('armL', 'y', [[0, 0], [250, -5], [900, -5], [1200, 0]]),
      track('armR', 'y', [[0, 0], [250, -5], [900, -5], [1200, 0]]),
      track('head', 'rot', [[0, 0], [300, 10], [900, 10], [1200, 0]]),
      track('root', 'y', [[0, 0], [250, -4], [900, -4], [1200, 0]]),
    ],
  },

  // A big surprise: jolts back, arms out.
  wow: {
    duration: 1000,
    puffAt: 40,
    tracks: [
      track('root', 'y', [[0, 0], [150, -12, 'out'], [600, 0]]),
      track('root', 'x', [[0, 0], [150, 5], [600, 0]]),
      track('root', 'scale', [[0, 1], [150, 1.1], [600, 1]]),
      track('armL', 'rot', [[0, 0], [150, 64], [700, 64], [950, 0]]),
      track('armR', 'rot', [[0, 0], [150, -64], [700, -64], [950, 0]]),
      track('antenna', 'rot', [[0, 0], [150, -34], [400, 20], [700, 0]]),
      track('flame', 'opacity', [[0, 0], [40, 0.5], [500, 0]]),
    ],
  },
};

/* ------------------------------------------------------------- fidgets -- */

export const FIDGETS = {
  wave: REACTIONS.wave,

  // A little somersault, just because.
  flip: {
    duration: 1300,
    puffAt: 120,
    tracks: [
      track('root', 'rot', [[0, 0], [1100, -360, 'inOut']]),
      track('root', 'y', [[0, 0], [300, -14, 'out'], [800, -10], [1100, 0]]),
      track('legL', 'rot', [[0, 0], [300, -34], [900, -34], [1150, 0]]),
      track('legR', 'rot', [[0, 0], [300, 34], [900, 34], [1150, 0]]),
      track('flame', 'opacity', [[0, 0], [120, 0.6], [600, 0]]),
    ],
  },

  // A long look left, then right - taking in the scenery.
  lookAround: {
    duration: 2200,
    tracks: [
      track('eyes', 'x', [[0, 0], [300, -5], [900, -5], [1250, 5], [1850, 5], [2150, 0]]),
      track('head', 'rot', [[0, 0], [300, -9], [900, -9], [1250, 9], [1850, 9], [2150, 0]]),
      track('root', 'x', [[0, 0], [900, -3], [1850, 3], [2150, 0]]),
    ],
  },

  // A jetpack blast upward, then drifting slowly back down.
  boost: {
    duration: 1500,
    puffAt: 140,
    tracks: [
      track('root', 'y', [[0, 0], [140, 4], [520, -24, 'out'], [1400, 0, 'inOut']]),
      track('flame', 'opacity', [[0, 0], [140, 0.9], [620, 0]]),
      track('flame', 'scaleY', [[0, 1], [140, 2.4, 'out'], [620, 1]]),
      track('legL', 'rot', [[0, 0], [520, 16], [1300, 0]]),
      track('legR', 'rot', [[0, 0], [520, -16], [1300, 0]]),
      track('armL', 'rot', [[0, 0], [520, -14], [1300, 0]]),
      track('armR', 'rot', [[0, 0], [520, 14], [1300, 0]]),
    ],
  },

  // Arms right up, a big yawn, a slow settle.
  stretch: {
    duration: 1900,
    tracks: [
      track('armL', 'rot', [[0, 0], [500, 158, 'inOut'], [1300, 158], [1800, 0]]),
      track('armR', 'rot', [[0, 0], [500, -158, 'inOut'], [1300, -158], [1800, 0]]),
      track('torso', 'scaleY', [[0, 1], [500, 1.09], [1300, 1.09], [1800, 1]]),
      track('root', 'y', [[0, 0], [500, -5], [1300, -5], [1800, 0]]),
      track('head', 'rot', [[0, 0], [600, -6], [1300, -6], [1800, 0]]),
    ],
  },
};

export const FIDGET_KEYS = Object.keys(FIDGETS);

/**
 * The next fidget, never the same one twice in a row. `random` is injected so
 * the choice is testable; the app passes Math.random.
 */
export const nextFidget = (previous, random = Math.random) => {
  const pool = FIDGET_KEYS.filter((key) => key !== previous);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
};

/** How long to wait before the next fidget: long enough that it is a surprise. */
export const fidgetDelay = (random = Math.random) => 4500 + Math.floor(random() * 4500);

/** Value of a track at time t, linear between keys. Used by the preview and tests. */
export const sampleTrack = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return keys[keys.length - 1][1];
};

export const trackLength = (keys) => keys[keys.length - 1][0];
