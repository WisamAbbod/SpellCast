import { colors } from './colors.js';

/**
 * What each bot looks like, as pure data - checked by tests/characters.test.js
 * the same way the backgrounds and the mascot are, because a broken path draws
 * nothing and says nothing.
 *
 * Deliberately simpler than the mascot. These are drawn at 16-28px in rails and
 * rows, so each character is told apart by silhouette and colour first, and the
 * face is bold enough to survive being that small. Rounded corners come from a
 * thick stroke in the body colour with round joins, as on the mascot.
 *
 * 100x100 viewBox, every shape centred near (50, 52).
 */

export const AVATAR_VIEWBOX = '0 0 100 100';
export const AVATAR_FACE = colors.tileText;

const ellipse = (x, y, rx, ry) =>
  `M${x - rx},${y} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 Z`;

const round1 = (value) => Math.round(value * 10) / 10;

/** A regular polygon, first point straight up. */
const polygon = (sides, radius, cx = 50, cy = 52) => {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (-90 + (360 / sides) * i) * (Math.PI / 180);
    points.push(`${round1(cx + radius * Math.cos(angle))},${round1(cy + radius * Math.sin(angle))}`);
  }
  return `M${points.join(' L')} Z`;
};

const EYES = {
  open: [ellipse(39, 49, 5, 6.5), ellipse(61, 49, 5, 6.5)],
  // Orion and Rigel squint - focus and mischief read the same at 20px.
  narrow: [ellipse(39, 50, 5.2, 3.8), ellipse(61, 50, 5.2, 3.8)],
};

/** Each mouth is { d, fill } - filled shape, or a line when fill is false. */
export const CHARACTER_ART = {
  nova: {
    tint: '#FF9F5A',
    body: ellipse(50, 52, 38, 38),
    eyes: EYES.open,
    mouth: { d: 'M40,61 Q50,76 60,61 Z', fill: true },
  },
  orion: {
    tint: '#6B8CFF',
    body: polygon(6, 40),
    eyes: EYES.narrow,
    mouth: { d: 'M42,66 L58,66', fill: false },
  },
  vega: {
    tint: colors.gem, // the magpie is the colour of the thing it loves
    body: 'M50,12 L88,52 L50,92 L12,52 Z',
    eyes: EYES.open,
    mouth: { d: 'M38,62 Q50,75 62,62', fill: false },
  },
  lyra: {
    tint: colors.accent,
    body: 'M20,22 L80,22 L80,82 L20,82 Z',
    eyes: EYES.open,
    mouth: { d: 'M44,64 Q50,69 56,64', fill: false },
  },
  atlas: {
    tint: colors.success,
    body: polygon(5, 41, 50, 55),
    eyes: EYES.open,
    mouth: { d: 'M42,66 Q50,69 58,66', fill: false },
  },
  rigel: {
    tint: '#B98CFF',
    body: 'M50,14 L88,84 L12,84 Z',
    eyes: EYES.narrow,
    mouth: { d: 'M40,67 Q52,71 60,61', fill: false },
  },
};

/** A bot that is nobody in particular - one somebody renamed. */
export const GENERIC_ART = {
  tint: colors.textFaint,
  body: ellipse(50, 52, 38, 38),
  eyes: EYES.open,
  mouth: { d: 'M42,65 L58,65', fill: false },
};

export const artFor = (key) =>
  (key && Object.prototype.hasOwnProperty.call(CHARACTER_ART, key) && CHARACTER_ART[key]) ||
  GENERIC_ART;
