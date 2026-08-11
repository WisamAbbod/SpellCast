/** The palette. One place, so nothing invents its own purple. */

export const colors = {
  // Backdrop: a deep-space gradient rather than the flat slab the old CSS-only
  // `background: linear-gradient(...)` never actually produced.
  backdrop: ['#080711', '#141033', '#1D1146'],
  backdropFlat: '#080711',

  primary: '#7C5CFF',
  primaryDim: 'rgba(124, 92, 255, 0.22)',
  primaryEdge: 'rgba(124, 92, 255, 0.45)',

  accent: '#4ADEDE',
  gold: '#FFD166',
  success: '#3DDC97',
  danger: '#FF5E7D',

  text: '#FFFFFF',
  textDim: '#A9B0D6',
  textFaint: '#6B739B',
  tileText: '#1B1A33',

  surface: 'rgba(255, 255, 255, 0.06)',
  surfaceStrong: 'rgba(12, 10, 30, 0.82)',
  border: 'rgba(255, 255, 255, 0.12)',

  tile: '#F4F3FF',
  tileSelected: '#7C5CFF',
  tileWord: '#FFD166', // 2x word tile
  tileLetter: '#4ADEDE', // 3x letter tile

  // The swipe trail. Drawn ABOVE the tiles with alpha, so it stays visible -
  // underneath opaque tiles only the sliver in the gutter ever showed.
  path: 'rgba(124, 92, 255, 0.55)',
  pathValid: 'rgba(61, 220, 151, 0.6)',

  medal: {
    none: '#6B739B',
    bronze: '#CD7F32',
    silver: '#C0C7D8',
    gold: '#FFD166',
    platinum: '#4ADEDE',
  },
};

/** Par bands used for the results medal. Calibrated in Phase 6 against real play. */
export const MEDALS = [
  { key: 'platinum', label: 'Platinum', min: 70 },
  { key: 'gold', label: 'Gold', min: 55 },
  { key: 'silver', label: 'Silver', min: 40 },
  { key: 'bronze', label: 'Bronze', min: 25 },
  { key: 'none', label: 'Keep going', min: 0 },
];

export const medalFor = (parPercent) =>
  MEDALS.find((medal) => parPercent >= medal.min) || MEDALS[MEDALS.length - 1];
