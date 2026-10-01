'use strict';
/**
 * The bot characters.
 *
 * Two promises are held down here. First, the profiles are honest: every bio
 * describes behaviour the bot really has, so each taste is measured against a
 * bot with no character on the same boards. Second, character never overrides
 * difficulty: Easy Orion is still easier than any Medium bot.
 */
const { suite, check, ok } = require('./harness.js');
const { loadSrc } = require('./load.js');

const game = loadSrc('src/game/slow/game.js');
const bot = loadSrc('src/game/slow/bot.js');
const { BOT_NAMES } = loadSrc('src/game/slow/rules.js');
const {
  CHARACTERS, CHARACTER_ORDER, characterFor, characterByKey, thinkingLine,
} = loadSrc('src/game/slow/characters.js');
const { CHARACTER_ART, GENERIC_ART, artFor } = loadSrc('src/theme/characterArt.js');
const { slowLetterValue } = loadSrc('src/game/slow/scoring.js');

suite('characters');

check('every default bot name is a character, in the same order',
  CHARACTER_ORDER.map((key) => CHARACTERS[key].name).join(','), BOT_NAMES.join(','));
check('...and there are no characters without a seat', Object.keys(CHARACTERS).length, BOT_NAMES.length);

check('a bot named Vega is Vega', characterFor({ name: 'Vega', isBot: true }).key, 'vega');
check('names are matched case-insensitively', characterFor({ name: '  orion ', isBot: true }).key, 'orion');
check('a human called Vega is just a human', characterFor({ name: 'Vega', isBot: false }), null);
check('a renamed bot is nobody in particular', characterFor({ name: 'Bob', isBot: true }), null);
check('"constructor" does not find Object.prototype', characterFor({ name: 'constructor', isBot: true }), null);
check('...nor does it by key', characterByKey('__proto__'), null);
check('nothing at all is nobody', characterFor(null), null);
ok('thinking lines are personal', thinkingLine({ name: 'Vega', isBot: true }).includes('gems'));
check('...and generic for everyone else', thinkingLine({ name: 'Bob', isBot: true }), 'Bob is thinking…');

ok('every character has a title, a bio, a style and a thinking line',
  CHARACTER_ORDER.every((key) => {
    const c = CHARACTERS[key];
    return c.key === key && c.title && c.bio && c.style && c.thinking && c.taste;
  }));

/* Art: complete paths, real colours, one entry per character. */
const complete = (path) =>
  typeof path === 'string' && path.startsWith('M') && /[Zz\d]$/.test(path) && !path.includes('NaN');
const artOk = (art) =>
  /^#[0-9A-Fa-f]{6}$/.test(art.tint) && complete(art.body) &&
  art.eyes.length === 2 && art.eyes.every(complete) && complete(art.mouth.d);

check('every character has art', CHARACTER_ORDER.filter((key) => !CHARACTER_ART[key]).join(','), '');
ok('every drawing is complete', CHARACTER_ORDER.every((key) => artOk(CHARACTER_ART[key])));
ok('the generic bot is complete too', artOk(GENERIC_ART));
ok('an unknown key draws the generic bot', artFor('nobody') === GENERIC_ART && artFor(null) === GENERIC_ART);
check('every character is its own colour',
  new Set(CHARACTER_ORDER.map((key) => CHARACTER_ART[key].tint)).size, CHARACTER_ORDER.length);

/* Behaviour. The same boards for everyone, so differences are the character. */
const bases = Array.from({ length: 16 }, (_, i) =>
  game.createSlowGame({ seed: `taste-${i}`, players: [{ name: 'X', isBot: true }] }));
const as = (base, name, level, gems = 0) => ({
  ...base,
  players: [{ ...base.players[0], name, isBot: true, level, gems }],
});
const average = (name, level, measure) =>
  bases.reduce((sum, base) => {
    const choice = bot.chooseBotWord(as(base, name, level));
    return sum + (choice ? measure(choice, base) : 0);
  }, 0) / bases.length;

const length = (choice) => choice.word.length;
const gems = (choice) => choice.gems;
const rare = (choice) => choice.word.split('').filter((letter) => slowLetterValue(letter) >= 4).length;
const bonus = (choice, base) => choice.indices.filter((index) => base.board.modifiers[index]).length;
const score = (choice) => choice.score;

const baseline = (measure) => average('X', 'medium', measure);

ok('Orion plays longer words than a plain bot', average('Orion', 'medium', length) > baseline(length));
ok('Nova plays shorter words than a plain bot', average('Nova', 'medium', length) < baseline(length));
ok('Vega picks up more gems than a plain bot', average('Vega', 'medium', gems) > baseline(gems));
ok('Lyra plays more rare letters than a plain bot', average('Lyra', 'medium', rare) > baseline(rare));
ok('Atlas covers more bonus tiles than a plain bot', average('Atlas', 'medium', bonus) > baseline(bonus));

const shuffles = (name) =>
  bases.filter((base) => bot.planBotTurn(as(base, name, 'medium', 5)).shuffle).length;
ok(`Rigel shuffles far more readily (${shuffles('Rigel')} vs ${shuffles('Orion')} of ${bases.length})`,
  shuffles('Rigel') > shuffles('Orion') * 2);
ok('Nova thinks faster than everyone else',
  bot.planBotTurn(as(bases[0], 'Nova', 'medium')).thinkMs < bot.planBotTurn(as(bases[0], 'Orion', 'medium')).thinkMs);

/* Difficulty still rules. Every character's Easy is below every character's
   Medium, which is below every character's Hard - the bands do not overlap. */
const names = [...CHARACTER_ORDER.map((key) => CHARACTERS[key].name), 'X'];
const at = (level) => names.map((name) => average(name, level, score));
const easy = at('easy');
const medium = at('medium');
const hard = at('hard');

ok(`the strongest Easy (${Math.max(...easy).toFixed(1)}) is below the weakest Medium (${Math.min(...medium).toFixed(1)})`,
  Math.max(...easy) < Math.min(...medium));
ok(`the strongest Medium (${Math.max(...medium).toFixed(1)}) is below the weakest Hard (${Math.min(...hard).toFixed(1)})`,
  Math.max(...medium) < Math.min(...hard));

/* A bot nobody in particular plays the same whatever it is called - the
   character comes from the name only when the name is a character's. */
check('any bot with no character plays identically, whatever its name',
  bot.chooseBotWord(as(bases[3], 'X', 'medium')).word,
  bot.chooseBotWord(as(bases[3], 'Bob', 'medium')).word);
