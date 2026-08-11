'use strict';
/**
 * Generates every sound the game ships.
 *
 *   node tools/generate_audio.js
 *
 * Original synthesis, no samples, no dependencies, no licences to worry about.
 * Everything is 16-bit mono PCM at 22.05kHz, which keeps the whole set near
 * 800KB. To replace a sound with your own, drop a file with the same name into
 * assets/audio/ - nothing in the app cares how it was made.
 *
 * The music loop is seamless: notes that run past the end of the buffer wrap
 * around and add into the beginning, so the last sample flows into the first.
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'audio');

/* ------------------------------------------------------------- helpers -- */

/** Seeded, so regenerating produces byte-identical files. */
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const TAU = Math.PI * 2;

const waves = {
  sine: (phase) => Math.sin(TAU * phase),
  triangle: (phase) => 4 * Math.abs((phase % 1) - 0.5) - 1,
  square: (phase) => ((phase % 1) < 0.5 ? 1 : -1),
  saw: (phase) => 2 * ((phase % 1) - 0.5),
};

const buffer = (seconds) => new Float32Array(Math.round(seconds * SAMPLE_RATE));

/**
 * Adds one note into a buffer.
 *
 * @param wrap when true, samples past the end fold back to the start - this is
 *             what makes the music loop seamlessly.
 */
const addNote = (target, {
  start = 0,
  duration,
  freq,
  wave = 'sine',
  gain = 0.3,
  attack = 0.01,
  release = 0.25,
  decay = 0,
  vibratoHz = 0,
  vibratoDepth = 0,
  glideTo = 0,
  harmonics = [1],
  wrap = false,
}) => {
  const shape = waves[wave];
  const total = Math.round(duration * SAMPLE_RATE);
  const startSample = Math.round(start * SAMPLE_RATE);
  const attackSamples = Math.max(1, Math.round(attack * SAMPLE_RATE));
  const releaseSamples = Math.max(1, Math.round(release * SAMPLE_RATE));
  let phase = 0;

  for (let i = 0; i < total; i++) {
    const index = startSample + i;
    if (index >= target.length && !wrap) break;

    const t = i / SAMPLE_RATE;
    const progress = i / total;

    let envelope = 1;
    if (i < attackSamples) envelope = i / attackSamples;
    else if (i > total - releaseSamples) envelope = (total - i) / releaseSamples;
    if (decay > 0) envelope *= Math.exp(-t * decay);

    const vibrato = vibratoHz ? Math.sin(TAU * vibratoHz * t) * vibratoDepth : 0;
    const current = (glideTo ? freq + (glideTo - freq) * progress : freq) + vibrato;
    phase += current / SAMPLE_RATE;

    let value = 0;
    for (let h = 0; h < harmonics.length; h++) {
      value += shape(phase * (h + 1)) * harmonics[h];
    }

    target[index % target.length] += value * envelope * gain;
  }
};

const addNoise = (target, { start = 0, duration, gain = 0.2, decay = 8, rng, sweep = 0 }) => {
  const total = Math.round(duration * SAMPLE_RATE);
  const startSample = Math.round(start * SAMPLE_RATE);
  let smoothed = 0;

  for (let i = 0; i < total; i++) {
    const index = startSample + i;
    if (index >= target.length) break;
    const t = i / SAMPLE_RATE;
    // A one-pole low-pass whose cutoff sweeps: cheap "whoosh".
    const alpha = 0.02 + (sweep ? (i / total) * sweep : 0.25);
    smoothed += ((rng() * 2 - 1) - smoothed) * Math.min(1, alpha);
    target[index] += smoothed * Math.exp(-t * decay) * gain;
  }
};

const normalise = (samples, peak = 0.85) => {
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
  if (max === 0) return samples;
  const scale = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
};

/** Removes any DC offset and eases the very edges, so nothing clicks. */
const polish = (samples, edgeMs = 4) => {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i];
  const offset = sum / samples.length;
  for (let i = 0; i < samples.length; i++) samples[i] -= offset;

  const edge = Math.round((edgeMs / 1000) * SAMPLE_RATE);
  for (let i = 0; i < edge && i < samples.length; i++) {
    const fade = i / edge;
    samples[i] *= fade;
    samples[samples.length - 1 - i] *= fade;
  }
  return samples;
};

const writeWav = (name, samples) => {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.concat([header, data]));
  console.log(
    `${name.padEnd(18)} ${(samples.length / SAMPLE_RATE).toFixed(2)}s  ${(
      fs.statSync(file).size / 1024
    ).toFixed(0)} KB`,
  );
};

/* --------------------------------------------------------------- notes -- */

const NOTE = {
  C2: 65.41, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5,
};

/* --------------------------------------------------------------- sfx -- */

/** Six rising blips - the pitch climbs as a word gets longer. */
const buildSelects = () => {
  const ladder = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6];
  ladder.forEach((freq, index) => {
    const samples = buffer(0.11);
    addNote(samples, {
      duration: 0.1, freq, wave: 'triangle', gain: 0.5,
      attack: 0.002, release: 0.05, decay: 22, harmonics: [1, 0.25],
    });
    writeWav(`select_${index}.wav`, polish(normalise(samples, 0.7)));
  });
};

/** A word landed: a bright major arpeggio that resolves upward. */
const buildWord = () => {
  const samples = buffer(0.62);
  [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((freq, index) => {
    addNote(samples, {
      start: index * 0.055, duration: 0.5, freq, wave: 'sine', gain: 0.34,
      attack: 0.004, release: 0.3, decay: 5.5, harmonics: [1, 0.35, 0.12],
    });
  });
  addNote(samples, {
    start: 0.02, duration: 0.45, freq: NOTE.C4, wave: 'triangle',
    gain: 0.16, attack: 0.01, release: 0.3, decay: 6,
  });
  writeWav('word.wav', polish(normalise(samples, 0.8)));
};

/** Not a word: a short, low, unmistakable thud. Never harsh. */
const buildInvalid = () => {
  const samples = buffer(0.34);
  addNote(samples, {
    duration: 0.3, freq: NOTE.G3, glideTo: NOTE.C3, wave: 'triangle',
    gain: 0.45, attack: 0.004, release: 0.14, decay: 7, harmonics: [1, 0.3],
  });
  writeWav('invalid.wav', polish(normalise(samples, 0.6)));
};

/** Combo: a quick sparkle that climbs with the chain. */
const buildCombo = () => {
  const samples = buffer(0.5);
  [NOTE.G5, NOTE.C6, NOTE.E6].forEach((freq, index) => {
    addNote(samples, {
      start: index * 0.045, duration: 0.34, freq, wave: 'sine', gain: 0.3,
      attack: 0.002, release: 0.2, decay: 11, harmonics: [1, 0.5, 0.25],
    });
  });
  writeWav('combo.wav', polish(normalise(samples, 0.75)));
};

/** The last ten seconds. Dry, quiet, insistent. */
const buildTick = () => {
  const samples = buffer(0.09);
  addNote(samples, {
    duration: 0.07, freq: NOTE.A4, wave: 'square', gain: 0.25,
    attack: 0.001, release: 0.03, decay: 45,
  });
  writeWav('tick.wav', polish(normalise(samples, 0.45)));
};

/** Time up: a warm, final cadence rather than a buzzer. */
const buildGameOver = () => {
  const samples = buffer(1.7);
  const chord = [
    [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5],
    [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4],
    [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.F4],
  ];
  chord.forEach((notes, step) => {
    notes.forEach((freq) => {
      addNote(samples, {
        start: step * 0.24, duration: 1.3 - step * 0.1, freq, wave: 'sine',
        gain: 0.17, attack: 0.02, release: 0.7, decay: 1.6, harmonics: [1, 0.3, 0.1],
      });
    });
  });
  addNote(samples, {
    start: 0.5, duration: 1.1, freq: NOTE.F2, wave: 'sine',
    gain: 0.2, attack: 0.05, release: 0.6, decay: 1.2,
  });
  writeWav('gameover.wav', polish(normalise(samples, 0.8)));
};

const buildShuffle = () => {
  const rng = mulberry32(99);
  const samples = buffer(0.45);
  addNoise(samples, { duration: 0.42, gain: 0.5, decay: 7, rng, sweep: 0.35 });
  addNote(samples, {
    start: 0.05, duration: 0.3, freq: NOTE.C4, glideTo: NOTE.C5,
    wave: 'sine', gain: 0.18, attack: 0.01, release: 0.2, decay: 4,
  });
  writeWav('shuffle.wav', polish(normalise(samples, 0.55)));
};

const buildStart = () => {
  const samples = buffer(0.8);
  [NOTE.C4, NOTE.G4, NOTE.C5, NOTE.E5].forEach((freq, index) => {
    addNote(samples, {
      start: index * 0.07, duration: 0.55, freq, wave: 'triangle', gain: 0.26,
      attack: 0.006, release: 0.35, decay: 4, harmonics: [1, 0.25],
    });
  });
  writeWav('start.wav', polish(normalise(samples, 0.75)));
};

/* -------------------------------------------------------------- music -- */

/**
 * 19.2 seconds of drifting Am - F - C - G. A soft pad underneath, a plucked
 * arpeggio on top, a sine sub for weight. Notes wrap past the end of the buffer
 * so the loop point is inaudible.
 */
const buildMusic = () => {
  const barLength = 4.8;
  const bars = 4;
  const samples = buffer(barLength * bars);

  const progression = [
    { pad: [NOTE.A3, NOTE.C4, NOTE.E4], bass: NOTE.A2, arp: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5] },
    { pad: [NOTE.F3, NOTE.A3, NOTE.C4], bass: NOTE.F2, arp: [NOTE.F4, NOTE.A4, NOTE.C5, NOTE.A4] },
    { pad: [NOTE.C4, NOTE.E4, NOTE.G4], bass: NOTE.C3, arp: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5] },
    { pad: [NOTE.G3, NOTE.B3, NOTE.D4], bass: NOTE.G2, arp: [NOTE.G4, NOTE.B4, NOTE.D5, NOTE.B4] },
  ];

  progression.forEach((chord, bar) => {
    const start = bar * barLength;

    chord.pad.forEach((freq, voice) => {
      addNote(samples, {
        start, duration: barLength + 1.2, freq, wave: 'triangle',
        gain: 0.09, attack: 1.1, release: 1.6, wrap: true,
        vibratoHz: 0.18 + voice * 0.05, vibratoDepth: 0.7, harmonics: [1, 0.16],
      });
    });

    addNote(samples, {
      start, duration: barLength * 0.96, freq: chord.bass, wave: 'sine',
      gain: 0.16, attack: 0.35, release: 0.9, wrap: true,
    });

    // Eight plucked eighths per bar, panning through the chord tones.
    for (let step = 0; step < 8; step++) {
      const freq = chord.arp[step % chord.arp.length];
      addNote(samples, {
        start: start + step * (barLength / 8),
        duration: 0.85, freq, wave: 'sine', gain: 0.075,
        attack: 0.004, release: 0.5, decay: 3.4, wrap: true,
        harmonics: [1, 0.28, 0.1],
      });
    }

    // A high shimmer every other bar, so the loop doesn't feel mechanical.
    if (bar % 2 === 0) {
      addNote(samples, {
        start: start + barLength * 0.5, duration: 2.4, freq: NOTE.E6,
        wave: 'sine', gain: 0.035, attack: 0.6, release: 1.5, wrap: true,
      });
    }
  });

  // No edge fade here: fading the ends would make the loop point audible.
  writeWav('music.wav', normalise(samples, 0.68));
};

/* ---------------------------------------------------------------- run -- */

fs.mkdirSync(OUT_DIR, { recursive: true });
buildSelects();
buildWord();
buildInvalid();
buildCombo();
buildTick();
buildGameOver();
buildShuffle();
buildStart();
buildMusic();

const total = fs
  .readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.wav'))
  .reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(`\n${(total / 1024 / 1024).toFixed(2)} MB of audio in assets/audio/`);
