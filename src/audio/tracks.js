/**
 * The soundtrack catalog. Metadata only.
 *
 * The require()d files live in sounds.js, because Metro needs literal paths and
 * because a module full of require('*.wav') cannot be evaluated by tests/load.js.
 * Keeping the catalog here means prices and names are testable under node.
 *
 * Keys must stay in step with the MUSIC map in sounds.js. audio.js falls back to
 * the default track if they ever drift, so drift degrades rather than crashes.
 */

export const DEFAULT_TRACK = 'drift';

export const TRACKS = {
  drift: {
    key: 'drift',
    name: 'Drift',
    mood: 'Ambient',
    price: 0,
    seconds: 38.4,
    blurb: 'Eight slow bars that never quite resolve.',
  },
  pulse: {
    key: 'pulse',
    name: 'Pulse',
    mood: 'Driving',
    price: 200,
    seconds: 19.2,
    blurb: 'Twice the tempo, and a square lead that keeps time for you.',
  },
  lantern: {
    key: 'lantern',
    name: 'Lantern',
    mood: 'Warm',
    price: 350,
    seconds: 25.6,
    blurb: 'Major key, bell tones, nothing in any hurry whatsoever.',
  },
  fathom: {
    key: 'fathom',
    name: 'Fathom',
    mood: 'Tense',
    price: 500,
    seconds: 22.4,
    blurb: 'A drone a long way down, and something moving in it.',
  },
};

export const TRACK_ORDER = ['drift', 'pulse', 'lantern', 'fathom'];

export const trackFor = (key) => TRACKS[key] || TRACKS[DEFAULT_TRACK];
