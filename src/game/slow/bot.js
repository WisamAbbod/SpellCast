import { makeRng, rngInt } from '../rng.js';
import { BOT_LEVELS, BOT_SHUFFLE_THRESHOLD, DEFAULT_BOT_LEVEL, ABILITIES } from './rules.js';
import { analyseSlowBoard, slowSeed } from './board.js';
import { scoreSlowWord, countGems, slowLetterValue } from './scoring.js';
import { characterFor } from './characters.js';

/**
 * The bots.
 *
 * A bot sees exactly what a player sees - the solver over the live board - and
 * then deliberately plays worse than it could. Difficulty is a band of the
 * ranked list rather than noise added to the best word, so "Easy" reliably
 * plays a mediocre word instead of occasionally stumbling onto the best one.
 *
 * Every choice is seeded off the game seed and the turn, so a game replays the
 * same way twice. That is what makes the turn machine testable end to end.
 */

/**
 * hasOwnProperty rather than truthiness: BOT_LEVELS.constructor is inherited
 * from Object, so a corrupted level of "constructor" would sail through a
 * truthy check and then throw on `const [low, high] = level.band`.
 */
const levelFor = (key) =>
  (Object.prototype.hasOwnProperty.call(BOT_LEVELS, key) && BOT_LEVELS[key]) ||
  BOT_LEVELS[DEFAULT_BOT_LEVEL];

/**
 * Every word the bot could play this turn, best first.
 *
 * Ranked by what it is actually worth on this board - bonus tiles included, and
 * with a nudge for gems, since a bot that never picks gems up can never afford
 * an ability.
 */
export const rankBotOptions = (board, usedWords = [], minLength = 3) => {
  const analysis = analyseSlowBoard(board.letters);
  const used = new Set(usedWords);
  const options = [];

  analysis.words.forEach((indices, word) => {
    if (word.length < minLength || used.has(word)) return;
    const scored = scoreSlowWord(word, indices, board.modifiers);
    const gems = countGems(indices, board.gems);
    options.push({
      word,
      indices,
      score: scored.score,
      gems,
      value: scored.score + gems * 3, // a gem is worth roughly three points of turn value
    });
  });

  options.sort((a, b) => b.value - a.value || a.word.localeCompare(b.word));
  return options;
};

/*
 * Tastes: what a character reaches for, once difficulty has decided how good a
 * word they are allowed. Higher is more appealing. Each is cheap arithmetic on
 * an option rankBotOptions already built.
 */
const TASTE = {
  short: (option) => -option.word.length,
  long: (option) => option.word.length,
  gems: (option) => option.gems,
  // Only the letters worth four or more count, so a word is "rare" because of
  // its Q or its Z rather than because it is long.
  rare: (option) =>
    option.word.split('').reduce((sum, letter) => {
      const value = slowLetterValue(letter);
      return sum + (value >= 4 ? value : 0);
    }, 0),
  bonus: (option, board) =>
    option.indices.reduce((sum, index) => sum + (board.modifiers[index] ? 1 : 0), 0),
};

/** Rigel's excuse to shuffle: anything under this is "boring". */
const EAGER_SHUFFLE_THRESHOLD = 14;
/** Nova's quick turns. */
const QUICK_THINK_SCALE = 0.6;

/**
 * Picks this turn's word.
 *
 * Difficulty picks the band; character picks within it. With no character (a
 * bot someone renamed, or any bot in the tests) the choice is exactly what it
 * always was: one seeded draw across the band.
 * @returns {{word, indices, score, gems}|null} null when the board is barren
 */
export const chooseBotWord = (state, options) => {
  const player = state.players[state.turnIndex % state.players.length];
  const level = levelFor(player.level);
  const list = options || rankBotOptions(state.board, state.usedWords, level.minLength);

  if (list.length === 0) return null;

  const rng = makeRng(slowSeed(state.seed, 'bot', state.turnIndex, player.id));
  const [low, high] = level.band;
  const last = list.length - 1;
  const from = Math.min(last, Math.round(low * last));
  const to = Math.min(last, Math.round(high * last));
  const span = Math.max(0, to - from);

  const character = characterFor(player);
  const taste = character && TASTE[character.taste];

  if (!taste || span === 0) {
    return list[from + (span > 0 ? rngInt(rng, span + 1) : 0)];
  }

  // Re-rank only the band, then draw from its more appealing half. Still one
  // seeded draw, so a game replays identically; still inside the band, so the
  // difficulty is untouched.
  const band = list.slice(from, to + 1);
  band.sort(
    (a, b) =>
      taste(b, state.board) - taste(a, state.board) ||
      b.value - a.value ||
      a.word.localeCompare(b.word),
  );
  const top = Math.max(1, Math.ceil(band.length / 2));
  return band[rngInt(rng, top)];
};

/**
 * Whether to open the turn by shuffling, and how long to look like it is
 * thinking.
 *
 * Deliberately does NOT return the word. A word is a path of cell indices, and
 * shuffling moves every letter - so a plan that carried both would tempt the
 * caller into playing a path that no longer spells anything. Shuffle first if
 * this says so, then ask chooseBotWord for the move.
 *
 * @returns {{shuffle: boolean, thinkMs: number}}
 */
export const planBotTurn = (state) => {
  const player = state.players[state.turnIndex % state.players.length];
  const level = levelFor(player.level);

  const options = rankBotOptions(state.board, state.usedWords, level.minLength);
  const best = chooseBotWord(state, options);

  const character = characterFor(player);
  const threshold =
    character && character.taste === 'shuffle' ? EAGER_SHUFFLE_THRESHOLD : BOT_SHUFFLE_THRESHOLD;
  const thinkScale = character && character.taste === 'short' ? QUICK_THINK_SCALE : 1;

  const canShuffle = player.gems >= ABILITIES.shuffle.cost;
  const weak = !best || best.score < threshold;

  return { shuffle: canShuffle && weak, thinkMs: Math.round(level.thinkMs * thinkScale) };
};

export const botLevelLabel = (key) => levelFor(key).label;
