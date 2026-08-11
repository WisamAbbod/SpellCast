import ENABLE_WORDS from '../../assets/words.enable.js';
import COMMON_WORDS from '../../assets/words.common.js';
import { MIN_WORD_LENGTH } from './rules.js';

/**
 * The word list, in two tiers.
 *
 *   ENABLE  105k words - what counts as a real word. A player who traces a real
 *           word is never told it isn't one.
 *   COMMON   21k words - the subset used for par, board quality and seed words,
 *           so those numbers describe words people plausibly know instead of
 *           obscure ones nobody will ever find.
 *
 * Both live in ONE structure: a trie whose terminals are marked 0 (valid) or
 * 1 (valid and common). That means no second Set, no second lookup, and the
 * solver learns which tier a word belongs to as a side effect of finding it.
 *
 * Regenerate the assets with: node tools/build_dictionary.js
 */

/** The longest word the shipped lists contain - and so the longest that scores. */
export const MAX_WORD_LENGTH = 9;

const COMMON = 1;

/** Walks a space-separated word list, inserting each word into the trie. */
const insertAll = (root, text, mark) => {
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i !== text.length && text.charCodeAt(i) !== 32) continue;
    if (i > start) {
      let node = root;
      for (let k = start; k < i; k++) {
        const letter = text[k];
        node = node[letter] || (node[letter] = {});
      }
      node.$ = mark;
    }
    start = i + 1;
  }
};

let trie = null;

/**
 * Lazy and memoised: ~120ms on desktop V8, several times that under Hermes.
 * Warm it during boot (warmDictionary) so the first board doesn't pay for it.
 */
export const getTrie = () => {
  if (trie) return trie;
  const root = {};
  insertAll(root, ENABLE_WORDS, 0);
  insertAll(root, COMMON_WORDS, COMMON); // re-marks the common terminals
  trie = root;
  return trie;
};

const findNode = (word) => {
  if (typeof word !== 'string' || word.length < MIN_WORD_LENGTH) return null;
  const upper = word.toUpperCase();
  let node = getTrie();
  for (let i = 0; i < upper.length; i++) {
    node = node[upper[i]];
    if (node === undefined) return null;
  }
  return node;
};

export const isValidWord = (word) => {
  const node = findNode(word);
  return !!node && node.$ !== undefined;
};

export const isCommonWord = (word) => {
  const node = findNode(word);
  return !!node && node.$ === COMMON;
};

/** Words used to shape a board: long enough to matter, short enough to fit. */
let seedWords = null;

export const getSeedWords = () => {
  if (seedWords) return seedWords;
  seedWords = [];
  let start = 0;
  for (let i = 0; i <= COMMON_WORDS.length; i++) {
    if (i !== COMMON_WORDS.length && COMMON_WORDS.charCodeAt(i) !== 32) continue;
    const length = i - start;
    if (length >= 5 && length <= 7) seedWords.push(COMMON_WORDS.slice(start, i));
    start = i + 1;
  }
  return seedWords;
};

export const warmDictionary = () => {
  getTrie();
  getSeedWords();
};
