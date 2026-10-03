/**
 * Player names other people will see: on the global leaderboard and across the
 * table in an online game. App Store guideline 1.2 asks that user-chosen text
 * like this is filtered, and that players can report and hide each other -
 * this is the filtering half (reporting lives in online/reports.js).
 *
 * A name is checked twice:
 *   - when it is chosen, so nobody is told their name was fine and then sees it
 *     masked everywhere;
 *   - when somebody ELSE's name arrives from the server (safeName), because a
 *     modified app can send anything - the second check is the one that holds.
 *
 * No list is perfect, and this one does not try to be: it stops the obvious,
 * survives the usual disguises (f.u.c.k, sh1t, fuuuck), and leaves real names
 * alone (Cassandra, Scunthorpe, Dickens, Peacock). Reporting covers the rest.
 */

// Matched anywhere in the name, letters only: long and specific enough that an
// innocent name rarely contains them.
const ANYWHERE = [
  'fuck', 'shit', 'cunt', 'nigg', 'bitch', 'whore', 'slut', 'faggot', 'fagot',
  'pussy', 'nazi', 'hitler', 'retard', 'porn', 'twat', 'jizz', 'penis', 'vagina',
  'tranny', 'molest', 'paedo', 'killyourself', 'motherf',
];

// Matched only as a whole word - each of these hides inside ordinary words
// (class, peacock, grape, spice, raccoon, Essex, cucumber).
const WHOLE_WORD = [
  'ass', 'arse', 'asshole', 'cock', 'dick', 'rape', 'cum', 'tits', 'tit', 'sex',
  'fag', 'homo', 'wank', 'spic', 'chink', 'kike', 'coon', 'paki', 'gook', 'dyke',
  'kys', 'nigga', 'nigger', 'bastard', 'prick', 'boob', 'boobs',
  'rapist', 'pedo', // whole words only: therapist, torpedo, Speedo
];

// Words that contain an ANYWHERE root but are fine.
const INNOCENT = ['scunthorpe', 'shiitake', 'shitake'];

const LEET = { 0: 'o', 1: 'i', '!': 'i', '|': 'i', 3: 'e', 4: 'a', '@': 'a', 5: 's', $: 's', 7: 't', 8: 'b', 9: 'g' };

/** Splits accents off their letters (ü -> u + ¨), where the engine can. */
const decompose = (text) => {
  try {
    return text.normalize('NFKD');
  } catch (error) {
    return text; // no normalize on this engine: accents simply stay
  }
};

/** Lower case, accents off, digits-for-letters undone. Keeps separators. */
const normalise = (raw) =>
  decompose(String(raw || ''))
    // The combining accents NFKD split off. A plain range rather than \p{M},
    // which not every phone's JavaScript engine can parse.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0-9!|@$]/g, (ch) => LEET[ch] || ch);

// Each root as a pattern that tolerates stretched letters: fuuuck, shiiit.
const stretched = (root) => new RegExp(root.split('').map((ch) => `${ch}+`).join(''));
const ANYWHERE_PATTERNS = ANYWHERE.map(stretched);
const WHOLE_WORD_SET = new Set(WHOLE_WORD);

/** null when the name is fine; otherwise a short reason to show the player. */
export const nameIssue = (raw) => {
  const text = normalise(raw);
  let letters = text.replace(/[^a-z]/g, '');
  if (!letters) return null; // empty is handled elsewhere (it means anonymous)
  INNOCENT.forEach((word) => {
    letters = letters.split(word).join('');
  });
  if (ANYWHERE_PATTERNS.some((pattern) => pattern.test(letters))) return 'Pick a different name';

  // Whole words: split on anything that is not a letter, and also try the
  // name run together, which catches "a s s" spaced out letter by letter.
  const words = text.split(/[^a-z]+/).filter(Boolean);
  const joined = words.join('');
  if (words.some((word) => WHOLE_WORD_SET.has(word)) || WHOLE_WORD_SET.has(joined)) {
    return 'Pick a different name';
  }
  return null;
};

export const isNameAllowed = (raw) => nameIssue(raw) === null;

/**
 * Somebody else's name, made safe to put on screen: unchanged if it passes,
 * otherwise the fallback. Never throws, whatever arrives.
 */
export const safeName = (raw, fallback = 'Player') => {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) return fallback;
  return isNameAllowed(name) ? name : fallback;
};
