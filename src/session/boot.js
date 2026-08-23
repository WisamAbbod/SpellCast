import { InteractionManager } from 'react-native';
import { initAudio, startMusic } from '../audio/audio.js';
import { warmDictionary } from '../game/dictionary.js';
import { flushLeaderboardQueue } from '../leaderboard/index.js';
import { store } from '../storage/asyncStore.js';
import { runMigrations } from '../storage/migrations.js';
import { loadProfile } from '../storage/profile.js';
import { loadSettings } from '../storage/settings.js';

/**
 * What has to happen before the first screen appears, and what can wait.
 *
 * Blocking: migrations, settings and profile - screens read them synchronously.
 * Deferred: the dictionary trie (~150ms) and audio, both of which would
 * otherwise be paid for by whoever taps Play first.
 */
export const boot = async () => {
  await runMigrations(store);
  await loadSettings();
  await loadProfile();

  InteractionManager.runAfterInteractions(() => {
    warmDictionary();
    initAudio();
    // Asked for here rather than when a round starts, so the menu is not
    // silent. initAudio honours the request once the player is built.
    startMusic();
    flushLeaderboardQueue();
  });
};

export default boot;
