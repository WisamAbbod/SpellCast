import { CELL_COUNT } from './rules.js';
import { NEIGHBOURS } from './board.js';
import { getTrie } from './dictionary.js';
import { calculateScore, computePar } from './scoring.js';

/**
 * Every word traceable on a board.
 *
 * Depth-first from all 25 cells, following the trie, so a dead prefix costs one
 * failed property lookup rather than a string build and a hash. Typical board:
 * ~1.6ms on desktop V8, ~5ms worst case. Expect several times that on a phone.
 *
 * Dedupe is by trie NODE, not by word string, so the walk allocates nothing for
 * the ~200 obscure words it finds and only builds strings for the common ones
 * the game actually shows.
 *
 * @param {string[]} board flat 25 uppercase letters
 * @returns {{
 *   total: number,                      // every valid word, common or not
 *   words: Map<string, number[]>,       // COMMON words -> a winning path
 *   count: number,                      // words.size
 *   byLength: number[], ranked: {word,score}[], totalScore: number,
 *   best: {word,score}|null, top: {word,score}[], par: number
 * }}
 */
export const solveBoard = (board) => {
  const trie = getTrie();
  const seen = new Set();
  const words = new Map();
  const used = new Uint8Array(CELL_COUNT);
  const path = [];

  const walk = (index, node) => {
    const next = node[board[index]];
    if (next === undefined) return;

    used[index] = 1;
    path.push(index);

    if (next.$ !== undefined && !seen.has(next)) {
      seen.add(next);
      if (next.$ === 1) {
        let word = '';
        for (let i = 0; i < path.length; i++) word += board[path[i]];
        words.set(word, path.slice());
      }
    }

    const neighbours = NEIGHBOURS[index];
    for (let n = 0; n < neighbours.length; n++) {
      const neighbour = neighbours[n];
      if (used[neighbour] === 0) walk(neighbour, next);
    }

    used[index] = 0;
    path.pop();
  };

  for (let start = 0; start < CELL_COUNT; start++) walk(start, trie);

  const byLength = [];
  const ranked = [];
  let totalScore = 0;

  words.forEach((_path, word) => {
    byLength[word.length] = (byLength[word.length] || 0) + 1;
    const score = calculateScore(word);
    totalScore += score;
    ranked.push({ word, score });
  });

  ranked.sort((a, b) => b.score - a.score || (a.word < b.word ? -1 : 1));

  return {
    total: seen.size,
    words,
    count: words.size,
    byLength,
    ranked,
    totalScore,
    best: ranked[0] || null,
    top: ranked.slice(0, 10),
    par: computePar(ranked),
  };
};

/** Words of at least `length` letters, from a solved analysis's byLength. */
export const countAtLeast = (byLength, length) => {
  let total = 0;
  for (let i = length; i < byLength.length; i++) total += byLength[i] || 0;
  return total;
};
