import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getSettings, subscribeToSettings } from '../storage/settings.js';
import { MUSIC, SELECT_LADDER, SOUNDS } from './sounds.js';

/**
 * Sound and feel.
 *
 * Every call here is fire-and-forget and swallows its own errors: a device with
 * audio disabled, a codec that won't load, or a phone with no haptic engine
 * must never be able to interrupt a round.
 *
 * expo-audio players do NOT rewind when they finish, so replaying a one-shot
 * means seeking to 0 first - and overlapping one-shots need more than one
 * player, hence the small pools.
 */

const POOL_SIZE = 3;

let ready = false;
let music = null;
let musicWanted = false;
const pools = new Map();
const cursors = new Map();

const safely = (action) => {
  try {
    const result = action();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (error) {
    /* audio is never worth a crash */
  }
};

const poolFor = (key, source) => {
  let pool = pools.get(key);
  if (pool) return pool;
  pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    try {
      pool.push(createAudioPlayer(source));
    } catch (error) {
      break;
    }
  }
  pools.set(key, pool);
  cursors.set(key, 0);
  return pool;
};

export const initAudio = async () => {
  if (ready) return;
  ready = true;

  await safely(() =>
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }),
  );

  safely(() => {
    music = createAudioPlayer(MUSIC);
    music.loop = true;
    music.volume = getSettings().musicVolume;
  });

  // Warm the one-shots so the first word of the first round isn't late.
  Object.entries(SOUNDS).forEach(([key, source]) => poolFor(key, source));
  SELECT_LADDER.forEach((source, index) => poolFor(`select_${index}`, source));

  subscribeToSettings((settings) => {
    if (music) safely(() => { music.volume = settings.musicVolume; });
    if (settings.muted || !settings.music) stopMusic();
    else if (musicWanted) startMusic();
  });

  // Music has no business playing over someone else's phone call.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      if (musicWanted && getSettings().music && !getSettings().muted) startMusic();
    } else {
      safely(() => music && music.pause());
    }
  });

  // A round can start before this finishes - honour whatever it asked for.
  if (musicWanted) startMusic();
};

const playFrom = (key, source, volumeScale = 1) => {
  const settings = getSettings();
  if (settings.muted || !settings.sound) return;

  const pool = poolFor(key, source);
  if (pool.length === 0) return;

  const cursor = cursors.get(key) || 0;
  const player = pool[cursor % pool.length];
  cursors.set(key, cursor + 1);

  safely(() => {
    player.volume = settings.soundVolume * volumeScale;
    player.seekTo(0);
    player.play();
  });
};

/* --------------------------------------------------------------- music -- */

export const startMusic = () => {
  // The intent is remembered even while muted, so unmuting picks the music back
  // up wherever the player happens to be.
  musicWanted = true;
  const settings = getSettings();
  if (settings.muted || !settings.music || !music) return;
  safely(() => {
    music.volume = getSettings().musicVolume;
    music.play();
  });
};

export const stopMusic = () => {
  safely(() => music && music.pause());
};

export const releaseMusicIntent = () => {
  musicWanted = false;
  stopMusic();
};

/* ----------------------------------------------------------------- sfx -- */

/** Rises as the word gets longer, so a long trace sounds like it's building. */
export const playSelect = (pathLength) => {
  const index = Math.min(SELECT_LADDER.length - 1, Math.max(0, pathLength - 1));
  playFrom(`select_${index}`, SELECT_LADDER[index], 0.55);
  if (getSettings().haptics) safely(() => Haptics.selectionAsync());
};

export const playWord = (combo = 1) => {
  playFrom('word', SOUNDS.word);
  if (combo > 1) playFrom('combo', SOUNDS.combo, 0.7);
  if (getSettings().haptics) {
    safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }
};

export const playInvalid = () => {
  playFrom('invalid', SOUNDS.invalid, 0.8);
  if (getSettings().haptics) {
    safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }
};

export const playTick = () => playFrom('tick', SOUNDS.tick, 0.6);

export const playGameOver = () => {
  playFrom('gameover', SOUNDS.gameover);
  if (getSettings().haptics) {
    safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }
};

export const playShuffle = () => {
  playFrom('shuffle', SOUNDS.shuffle, 0.7);
  if (getSettings().haptics) {
    safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }
};

export const playStart = () => playFrom('start', SOUNDS.start);

export const tapFeedback = () => {
  if (!getSettings().haptics) return;
  safely(() =>
    Platform.OS === 'ios'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.selectionAsync(),
  );
};
