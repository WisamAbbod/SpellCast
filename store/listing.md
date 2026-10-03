# App Store listing — Spacewrite 1.1

Everything to paste into App Store Connect, in the order the page asks for it.
Screenshots are in `store/screenshots/` (1320 × 2868, the 6.9" iPhone size).

## App information

| Field | Value |
|---|---|
| Name | Spacewrite |
| Subtitle (30 max) | Daily word puzzle in space |
| Primary category | Games |
| Subcategories | Word, Puzzle |
| Price | Free |
| Privacy Policy URL | `https://wisamabbod.github.io/SpellCast/privacy.html` |
| Support URL | `https://wisamabbod.github.io/SpellCast/support.html` |
| Marketing URL (optional) | `https://wisamabbod.github.io/SpellCast/` |

The three URLs work once GitHub Pages is switched on for the `docs/` folder
(repo → Settings → Pages → Deploy from a branch → your main branch, `/docs`).

## Promotional text (170 max)

A new puzzle every day, the same board for everyone. Trace words, keep your streak, and take on friends or bots in turn-based games.

## Description

Trace words across the stars.

Spacewrite is a word game with two ways to play.

SPRINT
One board, sixty seconds. Swipe across neighbouring letters to spell as many words as you can before the clock runs out.
• Daily puzzle: one scored attempt a day, on the same board as everyone else in the world.
• Streaks, medals and a global leaderboard for every day's puzzle.
• Practice: unlimited rounds, and every past puzzle to replay.

TURNS
A slower, tactical game for 2 to 6 players, five rounds each.
• Play online with a room code, or get matched with anyone.
• Play offline by passing one phone around.
• Fill empty seats with bots, each with its own personality and playing style.
• Rare letters score more, bonus tiles move, and gems buy a shuffle, a swap or a hint.

MAKE IT YOURS
• Earn stardust every time you play. There is nothing to buy with real money.
• Unlock backgrounds, soundtracks and costumes for your astronaut, from a party hat to a deep sea diving suit.

FAIR AND PRIVATE
• No adverts. No account. No tracking.
• Works offline: the daily puzzle, practice and pass-and-play need no connection.

## Keywords (100 max, no spaces after commas)

spellcast,spell,cast,spelling,letters,anagram,multiplayer,online,friends,brain,vocab,swipe,tiles,bot

Why these: `spellcast` is there so the game can appear when someone searches
for SpellCast, with `spell` and `cast` covering the two-word spelling. `word`,
`puzzle`, `daily` and `space` are left out on purpose: Apple already indexes
the name and subtitle, so repeating them here would waste the 100 characters.

## What's New in this version

First release.

## Screenshots, in order

1. `1-menu.png` — the menu
2. `2-sprint.png` — a sixty-second round
3. `3-turns.png` — a turn-based game against a bot
4. `4-shop.png` — costumes in the shop
5. `5-leaderboard.png` — the daily leaderboard

The names and scores on the leaderboard screenshot are examples, not real players.

## App Privacy ("Data collection" form)

Answer **Yes, we collect data**, then declare these three. For each one:
purpose **App Functionality**, **not linked** to the user's identity, **not used for tracking**.

| Data type | What it is here |
|---|---|
| Identifiers → User ID | The random anonymous player ID |
| User Content → Gameplay Content | Daily scores, online moves and results |
| User Content → Other User Content | The display name, and reports of other players' names |

Everything else: not collected. Tracking: **No**.

## Age rating questionnaire

- Violence, sexual content, profanity, drugs, gambling, horror: **None**
- User-generated content: **Yes** — player-chosen display names only. They are filtered, and players can report and hide each other.
- Messaging or chat: **No**
- Advertising: **No**
- Unrestricted web access: **No**

## Export compliance

Uses only standard encryption (HTTPS). Already declared in the build, so App Store Connect should not ask.

## Notes for the reviewer (App Review Information → Notes)

No account or login is needed. The app signs in anonymously in the background the first time the leaderboard or online play is used.

The only user-generated content is a display name of up to 12 characters, shown on the daily leaderboard and in online games.
- Names are filtered when chosen and again when displayed.
- To report or hide a player: tap another player's name on the leaderboard (menu → Leaderboard), in an online lobby, or on an online game's results screen, then choose "Report name" or "Hide this player".
- Hidden players can be restored in Settings.

To try online play alone: menu → Play online → Create private game → Add bot → Start.
