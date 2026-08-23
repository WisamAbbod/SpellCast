import { makeRng, rngInt } from '../rng.js';
import { BOT_LEVELS, BOT_SHUFFLE_THRESHOLD, DEFAULT_BOT_LEVEL, ABILITIES } from './rules.js';
import { analyseSlowBoard, slowSeed } from './board.js';
import { scoreSlowWord, countGems } from './scoring.js';

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

/**
 * Picks this turn's word.
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

  return list[from + (span > 0 ? rngInt(rng, span + 1) : 0)];
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

  const canShuffle = player.gems >= ABILITIES.shuffle.cost;
  const weak = !best || best.score < BOT_SHUFFLE_THRESHOLD;

  return { shuffle: canShuffle && weak, thinkMs: level.thinkMs };
};

export const botLevelLabel = (key) => levelFor(key).label;
