import { readJson, writeJson } from './asyncStore.js';
import { KEYS } from './keys.js';
import { DEFAULT_SLOW_SETUP, withDefaults } from './schema.js';
import {
  BOT_LEVELS, DEFAULT_BOT_LEVEL, HUMAN_NAMES, MAX_PLAYERS, MIN_PLAYERS,
} from '../game/slow/rules.js';

/**
 * The last slow-mode roster, so nobody retypes four names every game.
 *
 * Sanitised on the way in and on the way out, because this record is the only
 * untrusted input the slow game gets: createSlowGame caps the roster but
 * deliberately will not pad it, so a truncated or hand-edited record would
 * otherwise start a one-player game that can never be won.
 */

/** Long enough for a real name, short enough to fit the turn banner. */
export const NAME_MAX_LENGTH = 12;

/** hasOwnProperty, not truthiness - see the note in sanitisePlayer. */
const hasLevel = (key) => Object.prototype.hasOwnProperty.call(BOT_LEVELS, key);

/**
 * A roster entry keeps its identity across renames and removals, so a React key
 * survives someone deleting the middle player - an index key would hand the
 * open keyboard to whoever shuffled up into that slot.
 */
export const makePlayerId = () => `sp${Math.random().toString(36).slice(2, 9)}`;

const sanitisePlayer = (entry, index) => {
  const source = entry && typeof entry === 'object' ? entry : {};
  const name = String(source.name || '').trim().slice(0, NAME_MAX_LENGTH);
  return {
    id: typeof source.id === 'string' && source.id ? source.id : makePlayerId(),
    name: name || HUMAN_NAMES[index] || `Player ${index + 1}`,
    isBot: !!source.isBot,
    // hasOwnProperty, not truthiness: BOT_LEVELS.constructor is inherited
    // from Object and would otherwise pass as a difficulty.
    level: hasLevel(source.level) ? source.level : DEFAULT_BOT_LEVEL,
  };
};

const sanitiseRoster = (players) => {
  const roster = (Array.isArray(players) ? players : [])
    .slice(0, MAX_PLAYERS)
    .map(sanitisePlayer);

  // Padded rather than rejected: a half-written record should still open a
  // lobby someone can play from, not an error.
  while (roster.length < MIN_PLAYERS) {
    roster.push(sanitisePlayer(DEFAULT_SLOW_SETUP.players[roster.length], roster.length));
  }

  // A record carrying the same id twice would give two rows the same React key,
  // which is how one player ends up typing into another's slot.
  const seen = new Set();
  roster.forEach((player) => {
    while (seen.has(player.id)) player.id = makePlayerId();
    seen.add(player.id);
  });

  return roster;
};

export const loadSlowSetup = async () => {
  const setup = withDefaults(await readJson(KEYS.slowSetup, null), DEFAULT_SLOW_SETUP);
  return {
    ...setup,
    players: sanitiseRoster(setup.players),
    timerEnabled: !!setup.timerEnabled,
  };
};

export const saveSlowSetup = async (setup) => {
  const next = {
    ...DEFAULT_SLOW_SETUP,
    ...setup,
    players: sanitiseRoster(setup?.players),
    timerEnabled: !!setup?.timerEnabled,
  };
  await writeJson(KEYS.slowSetup, next);
  return next;
};
