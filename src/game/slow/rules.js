/**
 * Slow mode: the turn-based, pass-and-play game.
 *
 * A local take on Discord's SpellCast "New Game": 2-6 players share one board,
 * take turns spelling words, and play five rounds. Scoring is SpellCast's, not
 * the daily mode's - letter values dominate, bonus tiles multiply, and gems buy
 * abilities.
 *
 * Zero imports, like every other file in src/game: it has to load under node.
 */

export const SLOW_ROUNDS = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** Turn clock, only used when the host switches it on. */
export const TURN_SECONDS = 30;
export const TURN_EXTEND_SECONDS = 15;
export const MAX_EXTENSIONS_PER_TURN = 2;

/** Words this long or longer earn a flat bonus, added after the word multiplier. */
export const LONG_WORD_MIN = 6;
export const LONG_WORD_BONUS = 10;

/** Gems are capped, so hoarding has a ceiling and spending stays worthwhile. */
export const MAX_GEMS = 10;
/** Every gem still held when the game ends is worth this many points. */
export const POINTS_PER_LEFTOVER_GEM = 1;

export const ABILITIES = {
  shuffle: { key: 'shuffle', label: 'Shuffle', cost: 1, icon: '⇄', blurb: 'Rearrange every letter' },
  swap: { key: 'swap', label: 'Swap', cost: 3, icon: '⇅', blurb: 'Replace one letter' },
  hint: { key: 'hint', label: 'Hint', cost: 4, icon: '✦', blurb: 'Reveal a word' },
  extend: { key: 'extend', label: '+15s', cost: 1, icon: '⏱', blurb: 'Buy more time' },
};

export const ABILITY_ORDER = ['shuffle', 'swap', 'hint'];

/** Bonus tiles. DL/TL multiply one letter; DW doubles the whole word. */
export const TILE_NONE = null;
export const TILE_DOUBLE_LETTER = 'DL';
export const TILE_TRIPLE_LETTER = 'TL';
export const TILE_DOUBLE_WORD = 'DW';

export const TILE_LABELS = {
  [TILE_DOUBLE_LETTER]: 'DL',
  [TILE_TRIPLE_LETTER]: 'TL',
  [TILE_DOUBLE_WORD]: '2x',
};

/** How many of each bonus tile sit on the board at once. Re-rolled every turn. */
export const BONUS_TILE_PLAN = [
  { type: TILE_DOUBLE_LETTER, count: 1 },
  { type: TILE_TRIPLE_LETTER, count: 1 },
  { type: TILE_DOUBLE_WORD, count: 1 },
];

/** Gems on the board are kept inside this band as tiles get consumed. */
export const GEM_TILES_MIN = 2;
export const GEM_TILES_MAX = 3;

/**
 * Bots pick from a band of the board's words, ranked best first. Easy takes a
 * mediocre word on purpose; hard takes one of the best. Bands rather than
 * "best minus noise" so a bot is beatable in a predictable way.
 */
export const BOT_LEVELS = {
  easy: { key: 'easy', label: 'Easy', band: [0.4, 0.85], minLength: 3, thinkMs: 1400 },
  medium: { key: 'medium', label: 'Medium', band: [0.08, 0.35], minLength: 3, thinkMs: 1200 },
  hard: { key: 'hard', label: 'Hard', band: [0, 0.04], minLength: 4, thinkMs: 1000 },
};

/** A bot with gems spare will shuffle rather than play a word this weak. */
export const BOT_SHUFFLE_THRESHOLD = 8;

export const DEFAULT_BOT_LEVEL = 'medium';

/** Names handed to bot slots, in order. */
export const BOT_NAMES = ['Nova', 'Orion', 'Vega', 'Lyra', 'Atlas', 'Rigel'];
export const HUMAN_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];
