/**
 * The soundtrack catalog. Metadata only.
 *
 * The require()d files live in sounds.js, because Metro needs literal paths and
 * because a module full of require('*.m4a') cannot be evaluated by tests/load.js.
 * Keeping the catalog here means prices, names and credits are testable under node.
 *
 * Every track is CC0 (public domain) from OpenGameArt, so no credit is legally
 * required - it is given anyway, in the shop and in the README, because these
 * people made the music and said anyone could have it. Titles and authors are
 * exactly as they appear on each track's page.
 *
 * The keys are older than the music. drift / pulse / lantern / fathom were once
 * synthesised tracks; they were replaced but kept their keys, so anything a
 * player had already bought or equipped carries over to the new music.
 *
 * Files are AAC in an M4A container, which carries the metadata players use to
 * loop without the short gap MP3 encoders leave at the seam. Silent tails were trimmed where a track had one,
 * which would otherwise be a dropout at every loop point. `seconds` is the
 * length after trimming.
 */

export const DEFAULT_TRACK = 'drift';

const OGA = 'https://opengameart.org/content/';

export const TRACKS = {
  drift: {
    key: 'drift',
    name: 'Outer Space Loop',
    mood: 'Ambient',
    price: 0,
    seconds: 68.6,
    blurb: 'Slow synths drifting past the window.',
    credit: { author: 'wipics', license: 'CC0', url: `${OGA}outer-space-loop` },
  },
  pulse: {
    key: 'pulse',
    name: 'Vintage Menu',
    mood: 'Synthwave',
    price: 150,
    seconds: 314.6,
    blurb: 'Lo-fi synthwave with a five-minute arrangement, so it rarely repeats.',
    credit: { author: 'iamoneabe', license: 'CC0', url: `${OGA}vintage-menu` },
  },
  lantern: {
    key: 'lantern',
    name: 'Lofi Hip Hop Loop',
    mood: 'Lofi hip hop',
    price: 250,
    seconds: 127.9,
    blurb: 'A laid-back beat for long practice sessions.',
    credit: { author: 'omfgdude', license: 'CC0', url: `${OGA}lofi-hip-hop-loop` },
  },
  grove: {
    key: 'grove',
    name: 'Cathedral in the Forest',
    mood: 'Pads & bells',
    price: 400,
    seconds: 137,
    blurb: 'Bells under a canopy. Made for the Forest background.',
    credit: { author: 'congusbongus', license: 'CC0', url: `${OGA}cathedral-in-the-forest-ambient-loop` },
  },
  fathom: {
    key: 'fathom',
    name: 'Underwater Theme II',
    mood: 'Aquatic',
    price: 500,
    seconds: 104.7,
    blurb: 'Deep water and slow light. Made for the Abyss background.',
    credit: { author: 'CleytonKauffman', license: 'CC0', url: `${OGA}underwater-theme-ii` },
  },
};

export const TRACK_ORDER = ['drift', 'pulse', 'lantern', 'grove', 'fathom'];

export const trackFor = (key) => TRACKS[key] || TRACKS[DEFAULT_TRACK];

/** 68.6 -> "1:09", for the shop card. */
export const formatLength = (seconds) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};
