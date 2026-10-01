import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getSettings, subscribeToSettings } from '../storage/settings.js';
import { cleanVolume } from '../storage/schema.js';
import { MUSIC, SELECT_LADDER, SOUNDS } from './sounds.js';
import { DEFAULT_TRACK } from './tracks.js';

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
let currentTrackKey = null;
const pools = new Map();
const cursors = new Map();

const safely = (action) => {
  try {
    const result = action();
    if (result && typeof result.catch === 'function') result.catch(() => {});
    // Returned, so `await safely(...)` actually waits. Without this the audio
    // session was still being configured while the first play() went out.
    return result;
  } catch (error) {
    /* audio is never worth a crash */
    return undefined;
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
    // Read from settings rather than from currentTrackKey: a preview may have
    // set that already, and the equipped track is what should survive a boot.
    currentTrackKey = getSettings().trackKey || DEFAULT_TRACK;
    music = createAudioPlayer(MUSIC[currentTrackKey] || MUSIC[DEFAULT_TRACK]);
    music.loop = true;
    music.volume = cleanVolume(getSettings().musicVolume);

    // Belt and braces. `loop` maps to ExoPlayer's REPEAT_MODE_ONE on Android
    // and to AVPlayer looping on iOS, and when it fails it fails silently -
    // the track simply ends and the app is quiet for the rest of the session.
    // A player parked at its end also ignores play(), which is why every
    // start has to be able to rewind (see startMusic).
    //
    // When looping IS working the player is already playing again by the time
    // this fires, so the `playing` guard makes it a no-op rather than a
    // stutter.
    music.addListener('playbackStatusUpdate', (status) => {
      if (!status || !status.didJustFinish || status.playing) return;
      if (!musicWanted) return;
      const settings = getSettings();
      if (settings.muted || !settings.music) return;
      safely(() => {
        music.seekTo(0);
        music.play();
      });
    });
  });

  // Warm the one-shots so the first word of the first round isn't late.
  Object.entries(SOUNDS).forEach(([key, source]) => poolFor(key, source));
  SELECT_LADDER.forEach((source, index) => poolFor(`select_${index}`, source));

  subscribeToSettings((settings) => {
    // Before the mute branch: equipping a track while muted must still take
    // effect, so that unmuting later starts the one that was chosen.
    setMusicTrack(settings.trackKey);
    if (music) safely(() => { music.volume = cleanVolume(settings.musicVolume); });
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
    // Re-asserted on every start: it costs nothing, and it covers a player that
    // was rebuilt by replace() on a platform that does not carry the flag over.
    music.loop = true;
    music.volume = cleanVolume(settings.musicVolume);

    // A finished player sits at its end, where play() does nothing at all -
    // the same reason the one-shot pools seek before every play. Without this,
    // one silent track meant a silent app until the next launch.
    const status = music.currentStatus;
    if (status && status.duration > 0 && status.currentTime >= status.duration - 0.25) {
      music.seekTo(0);
    }

    music.play();
  });
};

/**
 * The music volume while the settings slider is being dragged: heard at once,
 * saved on release (which then lands here again through the subscription).
 */
export const previewMusicVolume = (volume) => {
  safely(() => {
    if (music) music.volume = volume;
  });
};

export const stopMusic = () => {
  safely(() => music && music.pause());
};

export const releaseMusicIntent = () => {
  musicWanted = false;
  stopMusic();
};

/**
 * Swaps the loop without touching the intent.
 *
 * player.replace() keeps the player object and resumes only if it was ALREADY
 * playing - so a swap while muted stays silent, and unmuting afterwards starts
 * the new track. That is exactly what musicWanted already promises, so there is
 * no extra branching to get wrong.
 *
 * loop and volume are re-applied because on web replace() throws the <audio>
 * element away and builds a fresh one, losing both (expo-audio's
 * AudioModule.web.js). On Android the ExoPlayer instance survives and this is a
 * harmless no-op.
 *
 * Also the shop's preview: it calls this directly without saving, then calls it
 * again with the equipped key on the way out.
 */
export const setMusicTrack = (key) => {
  const wanted = key || DEFAULT_TRACK;
  // initAudio is deferred behind runAfterInteractions, so a preview can land
  // first. Record the key and let initAudio read settings for the real choice.
  if (!music) {
    currentTrackKey = wanted;
    return;
  }
  if (wanted === currentTrackKey) return;

  currentTrackKey = wanted;
  safely(() => {
    music.replace(MUSIC[wanted] || MUSIC[DEFAULT_TRACK]);
    music.loop = true;
    music.volume = cleanVolume(getSettings().musicVolume);
  });
};

export const currentTrack = () => currentTrackKey || DEFAULT_TRACK;

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
