/**
 * How the swipe feels. Everything is a fraction of the measured cell pitch, so
 * it scales with the board rather than assuming a pixel size.
 */

/**
 * How close to a tile's centre the finger must get, as a fraction of the pitch.
 * Nearest-tile-wins, so this really controls how early a tile lights up. Above
 * ~0.7 the corner gaps close and diagonal swipes start grabbing tiles you only
 * clipped; below ~0.45 the board starts to feel dead.
 */
export const HIT_RADIUS_RATIO = 0.58;

/** Spacing between hit-test samples along a swipe, as a fraction of the pitch. */
export const SAMPLE_SPACING_RATIO = 0.25;

/** Safety valve for an enormous jump between two touch events. */
export const MAX_SAMPLES_PER_MOVE = 64;

/** Pixels of finger movement worth redrawing the trailing line for. */
export const LIVE_POINT_EPSILON = 1.5;
