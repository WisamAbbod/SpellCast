/**
 * Seeded randomness. Every board, every bonus tile and every shuffle comes from
 * here, so the same seed always produces the same puzzle on every device.
 *
 * WARNING: the *order* of draws is part of the contract. Adding, removing or
 * reordering a call to rng() anywhere in generation changes every board for
 * every date. Bump GENERATOR_VERSION in src/config.js when that happens.
 */

/** 32-bit FNV-1a. Avalanches hard, so consecutive dates give unrelated seeds. */
export const fnv1a = (text) => {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** mulberry32: uint32 seed -> () => float in [0, 1). Five lines, period 2^32. */
export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Seeds a generator from a channel string, e.g. 'spellcast:g1:daily:2026-08-10'. */
export const makeRng = (seedString) => mulberry32(fnv1a(String(seedString)));

export const rngInt = (rng, bound) => (rng() * bound) | 0;

export const rngPick = (rng, items) => items[(rng() * items.length) | 0];

/** Fisher-Yates, in place. */
export const rngShuffle = (rng, items) => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
};
