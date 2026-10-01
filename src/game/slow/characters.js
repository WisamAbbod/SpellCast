/**
 * The bots, as characters.
 *
 * Each bot is someone: a name, a title, a line about them, and a taste that
 * really does change how they play. The taste only decides WHICH word they pick
 * from inside their difficulty band (see chooseBotWord in bot.js), so difficulty
 * is still set by the player and stays exactly as balanced as before - Orion on
 * Easy is still an easy opponent, just one who reaches for long words.
 *
 * That is also why every bio here describes behaviour the code actually has.
 * A profile that says "loves gems" about a bot that ignores them would be the
 * first thing a regular player caught out.
 *
 * Zero imports, like everything in src/game.
 */

export const CHARACTERS = {
  nova: {
    key: 'nova',
    name: 'Nova',
    title: 'The Spark',
    bio: 'Thinks fast, plays short, celebrates early.',
    taste: 'short',
    style: 'Short words, quick turns',
    thinking: 'already has an idea…',
  },
  orion: {
    key: 'orion',
    name: 'Orion',
    title: 'The Hunter',
    bio: 'Will wait all night for a long word.',
    taste: 'long',
    style: 'Long words',
    thinking: 'is hunting something long…',
  },
  vega: {
    key: 'vega',
    name: 'Vega',
    title: 'The Magpie',
    bio: 'Cannot walk past anything shiny. Gems first, questions later.',
    taste: 'gems',
    style: 'Grabs gem tiles',
    thinking: 'is eyeing the gems…',
  },
  lyra: {
    key: 'lyra',
    name: 'Lyra',
    title: 'The Collector',
    bio: 'Keeps rare letters like pressed flowers.',
    taste: 'rare',
    style: 'Rare, valuable letters',
    thinking: 'is looking for a rare letter…',
  },
  atlas: {
    key: 'atlas',
    name: 'Atlas',
    title: 'The Architect',
    bio: 'Builds every word on a bonus tile if one will take the weight.',
    taste: 'bonus',
    style: 'Plays over bonus tiles',
    thinking: 'is measuring the bonus tiles…',
  },
  rigel: {
    key: 'rigel',
    name: 'Rigel',
    title: 'The Gremlin',
    bio: 'Shuffles the board for fun. Mostly for fun.',
    taste: 'shuffle',
    style: 'Shuffles at the slightest excuse',
    thinking: 'is up to something…',
  },
};

/** Seating order for new bots. Matches BOT_NAMES in rules.js (a test holds them together). */
export const CHARACTER_ORDER = ['nova', 'orion', 'vega', 'lyra', 'atlas', 'rigel'];

/**
 * Who a player is, from their name.
 *
 * By name rather than by a stored key on purpose: saved rosters, online rooms
 * and the engine's own roster all already carry a name, and none of them carry
 * anything else about a bot. Resolving from the name means every existing game,
 * local or online, gets its characters with no migration and no new field.
 *
 * Case-insensitive, and hasOwnProperty rather than truthiness for the same
 * reason bot.js does it: a name of "constructor" must not find
 * Object.prototype.constructor. Humans are never characters.
 */
export const characterFor = (player) => {
  if (!player || !player.isBot || typeof player.name !== 'string') return null;
  const key = player.name.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(CHARACTERS, key) ? CHARACTERS[key] : null;
};

export const characterByKey = (key) =>
  Object.prototype.hasOwnProperty.call(CHARACTERS, key) ? CHARACTERS[key] : null;

/** The line under the board while a bot is on turn. */
export const thinkingLine = (player) => {
  const character = characterFor(player);
  const name = player && player.name ? player.name : 'The bot';
  return character ? `${name} ${character.thinking}` : `${name} is thinking…`;
};
