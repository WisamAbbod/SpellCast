'use strict';
/**
 * Generates every sound the game ships.
 *
 *   node tools/generate_audio.js
 *
 * Original synthesis, no samples, no dependencies, no licences to worry about.
 * Effects are 16-bit mono PCM at 22.05kHz; the unlockable music tracks drop to
 * 12kHz (see withSampleRate below). To replace a sound with your own, drop a
 * file with the same name into assets/audio/ - nothing in the app cares how it
 * was made.
 *
 * The music loops are seamless: notes that run past the end of the buffer wrap
 * around and add into the beginning, so the last sample flows into the first.
 */
const fs = require('fs');
const path = require('path');

let SAMPLE_RATE = 22050;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'audio');

/**
 * Renders one builder at a different rate.
 *
 * Music is four fifths of the shipped audio, and three more tracks at 22.05kHz
 * would have added 5MB. Every helper reads SAMPLE_RATE at call time, so swapping
 * it around a single builder is enough - and the effects keep their full rate.
 *
 * 12kHz gives a 6kHz Nyquist. The new tracks use only sine and triangle, whose
 * partials fall off as 1/n^2: the loudest thing that can alias is a triangle's
 * 7th harmonic at about 2% amplitude. A square or saw would NOT be safe here -
 * its 7th is 14% - which is why none of them use one, and why "driving" is done
 * with tempo and envelope instead of with a waveform.
 */
const withSampleRate = (rate, build) => {
  const previous = SAMPLE_RATE;
  SAMPLE_RATE = rate;
  try {
    build();
  } finally {
    SAMPLE_RATE = previous;
  }
};

const MUSIC_RATE = 12000;

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

/** @param wrap as in addNote - needed for a swell that crosses the loop point. */
const addNoise = (
  target,
  { start = 0, duration, gain = 0.2, decay = 8, rng, sweep = 0, wrap = false },
) => {
  const total = Math.round(duration * SAMPLE_RATE);
  const startSample = Math.round(start * SAMPLE_RATE);
  let smoothed = 0;

  for (let i = 0; i < total; i++) {
    const index = startSample + i;
    if (index >= target.length && !wrap) break;
    const t = i / SAMPLE_RATE;
    // A one-pole low-pass whose cutoff sweeps: cheap "whoosh".
    const alpha = 0.02 + (sweep ? (i / total) * sweep : 0.25);
    smoothed += ((rng() * 2 - 1) - smoothed) * Math.min(1, alpha);
    // With wrap off and index < length this is just index, so every existing
    // effect renders byte-identically.
    target[index % target.length] += smoothed * Math.exp(-t * decay) * gain;
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
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
  C6: 1046.5, D6: 1174.66, E6: 1318.5,
  Gs3: 207.65, Gs4: 415.3,
  // Added for the unlockable tracks: Bb for Fathom's Dm-Bb-Gm, Cs for its
  // dominant A major, D2 for its drone.
  D2: 73.42, As2: 116.54, As3: 233.08, As4: 466.16, Cs4: 277.18, Cs5: 554.37,
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
  const bars = 8;
  const samples = buffer(barLength * bars);
  const rng = mulberry32(90210);

  /*
   * Eight bars, not four.
   *
   * The old loop was four bars with the same arpeggio shape in every one and a
   * shimmer on alternate bars, so its real period sounded like two bars - it
   * announced itself as about ten seconds and then jumped back.
   *
   * This one runs Am F C G Dm Am F E, which repeats nothing until the whole
   * thing has gone round, and ENDS ON E. E is the dominant of A minor, so the
   * loop point is a perfect cadence resolving into the Am the loop starts on:
   * the moment of restarting is the most musically settled moment in the piece
   * rather than the most jarring.
   */
  const progression = [
    { pad: [NOTE.A3, NOTE.C4, NOTE.E4], bass: NOTE.A2, fifth: NOTE.E3, arp: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5] },
    { pad: [NOTE.F3, NOTE.A3, NOTE.C4], bass: NOTE.F2, fifth: NOTE.C3, arp: [NOTE.F4, NOTE.A4, NOTE.C5, NOTE.A4] },
    { pad: [NOTE.C4, NOTE.E4, NOTE.G4], bass: NOTE.C3, fifth: NOTE.G2, arp: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5] },
    { pad: [NOTE.G3, NOTE.B3, NOTE.D4], bass: NOTE.G2, fifth: NOTE.D3, arp: [NOTE.G4, NOTE.B4, NOTE.D5, NOTE.B4] },
    { pad: [NOTE.D4, NOTE.F4, NOTE.A4], bass: NOTE.D3, fifth: NOTE.A2, arp: [NOTE.D5, NOTE.F5, NOTE.A5, NOTE.F5] },
    { pad: [NOTE.A3, NOTE.C4, NOTE.E4], bass: NOTE.A2, fifth: NOTE.E3, arp: [NOTE.E5, NOTE.C5, NOTE.A4, NOTE.C5] },
    { pad: [NOTE.F3, NOTE.A3, NOTE.C4], bass: NOTE.F2, fifth: NOTE.C3, arp: [NOTE.C5, NOTE.A4, NOTE.F4, NOTE.A4] },
    { pad: [NOTE.E3, NOTE.Gs3, NOTE.B3], bass: NOTE.E2, fifth: NOTE.B2, arp: [NOTE.B4, NOTE.Gs4, NOTE.E5, NOTE.Gs4] },
  ];

  /*
   * A different rhythm in every bar. 1 sounds the chord tone, 0 leaves a hole.
   * Repetition is what made the old loop feel short, and holes are what make a
   * line breathe - the last bar thins out deliberately so the cadence lands in
   * space rather than on top of a busy arpeggio.
   */
  const rhythms = [
    [1, 0, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1],
    [1, 1, 0, 1, 0, 1, 1, 0],
    [1, 0, 1, 0, 1, 0, 1, 1],
    [1, 0, 1, 1, 0, 1, 0, 0],
    [1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 0],
  ];

  progression.forEach((chord, bar) => {
    const start = bar * barLength;

    // Pads overlap into the next bar and wrap past the end, which is what makes
    // one chord dissolve into the next instead of switching.
    chord.pad.forEach((freq, voice) => {
      addNote(samples, {
        start, duration: barLength + 1.4, freq, wave: 'triangle',
        gain: 0.085, attack: 1.2, release: 1.8, wrap: true,
        vibratoHz: 0.16 + voice * 0.04, vibratoDepth: 0.7, harmonics: [1, 0.16],
      });
    });

    addNote(samples, {
      start, duration: barLength * 0.62, freq: chord.bass, wave: 'sine',
      gain: 0.17, attack: 0.3, release: 0.7, wrap: true,
    });

    // A fifth on the third beat in most bars - enough movement that the low end
    // is not just a pulse, absent in the last bar so the cadence stays open.
    if (bar !== bars - 1) {
      addNote(samples, {
        start: start + barLength * 0.5, duration: barLength * 0.42, freq: chord.fifth,
        wave: 'sine', gain: 0.1, attack: 0.25, release: 0.6, wrap: true,
      });
    }

    rhythms[bar].forEach((sounds, step) => {
      if (!sounds) return;
      addNote(samples, {
        start: start + step * (barLength / 8),
        duration: 0.9,
        freq: chord.arp[step % chord.arp.length],
        wave: 'sine',
        // A little unevenness so it sounds played rather than sequenced.
        gain: 0.062 + rng() * 0.022,
        attack: 0.004, release: 0.55, decay: 3.2, wrap: true,
        harmonics: [1, 0.26, 0.09],
      });
    });

    // Shimmer on a three-bar cycle, so it never lines up with the four-bar
    // half of the progression and cannot imply a shorter loop.
    if (bar % 3 === 1) {
      addNote(samples, {
        start: start + barLength * 0.45, duration: 2.8,
        freq: bar > 4 ? NOTE.D6 : NOTE.E6,
        wave: 'sine', gain: 0.03, attack: 0.7, release: 1.7, wrap: true,
      });
    }
  });

  // One breath across the whole loop, wrapping through the loop point so there
  // is a line longer than any bar for the ear to follow.
  addNote(samples, {
    start: barLength * 2.5, duration: barLength * 6, freq: NOTE.A4, wave: 'triangle',
    gain: 0.028, attack: barLength * 2, release: barLength * 2.6, wrap: true,
    vibratoHz: 0.09, vibratoDepth: 1.1,
  });

  writeWav('music.wav', normalise(samples, 0.68));
};

/* ---------------------------------------------- unlockable soundtracks -- */

/*
 * Three more loops, bought with stardust in the shop.
 *
 * All three follow buildMusic's shape - eight bars, a rhythm per bar, wrap on
 * every note, and a final chord that is the dominant of the first so the loop
 * point lands as a cadence rather than a jump. What differs is bar length,
 * register and density, which is where their character actually comes from.
 *
 * Shorter bars than Drift's 4.8s, so they cost a third of the bytes.
 */

/** 19.2s. Am F G Am / Dm F G E, ends on E. Fast, dense, four-on-the-floor. */
const buildPulse = () => {
  const barLength = 2.4;
  const bars = 8;
  const steps = 16;
  const samples = buffer(barLength * bars);
  const rng = mulberry32(5150);

  const progression = [
    { pad: [NOTE.A3, NOTE.C4, NOTE.E4], bass: NOTE.A2, arp: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5] },
    { pad: [NOTE.F3, NOTE.A3, NOTE.C4], bass: NOTE.F2, arp: [NOTE.F4, NOTE.A4, NOTE.C5, NOTE.A4] },
    { pad: [NOTE.G3, NOTE.B3, NOTE.D4], bass: NOTE.G2, arp: [NOTE.G4, NOTE.B4, NOTE.D5, NOTE.B4] },
    { pad: [NOTE.A3, NOTE.C4, NOTE.E4], bass: NOTE.A2, arp: [NOTE.E5, NOTE.C5, NOTE.A4, NOTE.C5] },
    { pad: [NOTE.D4, NOTE.F4, NOTE.A4], bass: NOTE.D3, arp: [NOTE.D5, NOTE.F5, NOTE.A5, NOTE.F5] },
    { pad: [NOTE.F3, NOTE.A3, NOTE.C4], bass: NOTE.F2, arp: [NOTE.C5, NOTE.A4, NOTE.F4, NOTE.A4] },
    { pad: [NOTE.G3, NOTE.B3, NOTE.D4], bass: NOTE.G2, arp: [NOTE.D5, NOTE.B4, NOTE.G4, NOTE.B4] },
    { pad: [NOTE.E3, NOTE.Gs3, NOTE.B3], bass: NOTE.E2, arp: [NOTE.B4, NOTE.Gs4, NOTE.E5, NOTE.Gs4] },
  ];

  // Sixteenths. The gaps are the groove - a fully filled bar reads as a drone
  // however fast it is.
  const rhythms = [
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1],
    [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0],
    [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
    [1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  ];

  progression.forEach((chord, bar) => {
    const start = bar * barLength;

    chord.pad.forEach((freq, voice) => {
      addNote(samples, {
        start, duration: barLength + 0.7, freq, wave: 'triangle',
        gain: 0.05, attack: 0.5, release: 0.9, wrap: true,
        vibratoHz: 0.2 + voice * 0.05, vibratoDepth: 0.6, harmonics: [1, 0.12],
      });
    });

    // Four to the bar, with a short envelope so it thumps rather than hums.
    for (let beat = 0; beat < 4; beat++) {
      addNote(samples, {
        start: start + beat * (barLength / 4), duration: 0.34, freq: chord.bass,
        wave: 'sine', gain: 0.2, attack: 0.006, release: 0.16, decay: 5.5, wrap: true,
      });
    }

    rhythms[bar].forEach((sounds, step) => {
      if (!sounds) return;
      addNote(samples, {
        start: start + step * (barLength / steps),
        duration: 0.3,
        freq: chord.arp[step % chord.arp.length],
        wave: 'triangle',
        gain: 0.05 + rng() * 0.016,
        attack: 0.003, release: 0.13, decay: 8, wrap: true,
        harmonics: [1, 0.2, 0.07],
      });
    });
  });

  writeWav('pulse.wav', normalise(samples, 0.7));
};

/** 25.6s. C G Am Em / F C Dm G, ends on G. Major, unhurried, bell-toned. */
const buildLantern = () => {
  const barLength = 3.2;
  const bars = 8;
  const steps = 8;
  const samples = buffer(barLength * bars);
  const rng = mulberry32(31415);

  const progression = [
    { pad: [NOTE.C4, NOTE.E4, NOTE.G4], bass: NOTE.C3, arp: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5] },
    { pad: [NOTE.G3, NOTE.B3, NOTE.D4], bass: NOTE.G2, arp: [NOTE.G4, NOTE.B4, NOTE.D5, NOTE.B4] },
    { pad: [NOTE.A3, NOTE.C4, NOTE.E4], bass: NOTE.A2, arp: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5] },
    { pad: [NOTE.E3, NOTE.G3, NOTE.B3], bass: NOTE.E2, arp: [NOTE.E5, NOTE.B4, NOTE.G4, NOTE.B4] },
    { pad: [NOTE.F3, NOTE.A3, NOTE.C4], bass: NOTE.F2, arp: [NOTE.F4, NOTE.A4, NOTE.C5, NOTE.A4] },
    { pad: [NOTE.C4, NOTE.E4, NOTE.G4], bass: NOTE.C3, arp: [NOTE.G5, NOTE.E5, NOTE.C5, NOTE.E5] },
    { pad: [NOTE.D4, NOTE.F4, NOTE.A4], bass: NOTE.D3, arp: [NOTE.D5, NOTE.F5, NOTE.A5, NOTE.F5] },
    { pad: [NOTE.G3, NOTE.B3, NOTE.D4], bass: NOTE.G2, arp: [NOTE.D5, NOTE.B4, NOTE.G4, NOTE.B4] },
  ];

  // Sparse on purpose. Warmth is space, not notes.
  const rhythms = [
    [1, 0, 0, 1, 0, 1, 0, 0],
    [1, 0, 1, 0, 0, 1, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 0],
    [1, 0, 1, 0, 0, 1, 0, 1],
    [1, 0, 0, 1, 0, 1, 0, 0],
    [1, 1, 0, 0, 1, 0, 1, 0],
    [1, 0, 0, 1, 0, 1, 0, 0],
    [1, 0, 0, 0, 1, 0, 0, 0],
  ];

  progression.forEach((chord, bar) => {
    const start = bar * barLength;

    // A very slow attack: each chord fades up rather than arriving.
    chord.pad.forEach((freq, voice) => {
      addNote(samples, {
        start, duration: barLength + 1.6, freq, wave: 'triangle',
        gain: 0.078, attack: 1.4, release: 1.9, wrap: true,
        vibratoHz: 0.12 + voice * 0.03, vibratoDepth: 0.5, harmonics: [1, 0.14],
      });
    });

    addNote(samples, {
      start, duration: barLength * 0.8, freq: chord.bass, wave: 'sine',
      gain: 0.15, attack: 0.4, release: 0.9, wrap: true,
    });

    rhythms[bar].forEach((sounds, step) => {
      if (!sounds) return;
      // Bells: a long exponential tail and a strong second partial.
      addNote(samples, {
        start: start + step * (barLength / steps),
        duration: 2.2,
        freq: chord.arp[step % chord.arp.length],
        wave: 'sine',
        gain: 0.055 + rng() * 0.02,
        attack: 0.005, release: 1.2, decay: 4.5, wrap: true,
        harmonics: [1, 0.5, 0.18],
      });
    });
  });

  writeWav('lantern.wav', normalise(samples, 0.66));
};

/** 22.4s. Dm Dm Bb A / Gm Dm Bb A, ends on A. A drone, and room above it. */
const buildFathom = () => {
  const barLength = 2.8;
  const bars = 8;
  const steps = 8;
  const total = barLength * bars;
  const samples = buffer(total);
  const rng = mulberry32(20000);

  const progression = [
    { pad: [NOTE.D4, NOTE.F4, NOTE.A4], bass: NOTE.D3, arp: [NOTE.D5, NOTE.A4, NOTE.F5, NOTE.A5] },
    { pad: [NOTE.D4, NOTE.F4, NOTE.A4], bass: NOTE.D3, arp: [NOTE.F5, NOTE.D5, NOTE.A4, NOTE.D5] },
    { pad: [NOTE.As3, NOTE.D4, NOTE.F4], bass: NOTE.As2, arp: [NOTE.As4, NOTE.F5, NOTE.D5, NOTE.F5] },
    { pad: [NOTE.Cs4, NOTE.E4, NOTE.A4], bass: NOTE.A2, arp: [NOTE.A4, NOTE.Cs5, NOTE.E5, NOTE.Cs5] },
    { pad: [NOTE.G3, NOTE.As3, NOTE.D4], bass: NOTE.G2, arp: [NOTE.G4, NOTE.As4, NOTE.D5, NOTE.As4] },
    { pad: [NOTE.D4, NOTE.F4, NOTE.A4], bass: NOTE.D3, arp: [NOTE.A5, NOTE.F5, NOTE.D5, NOTE.F5] },
    { pad: [NOTE.As3, NOTE.D4, NOTE.F4], bass: NOTE.As2, arp: [NOTE.D5, NOTE.As4, NOTE.F5, NOTE.As4] },
    { pad: [NOTE.Cs4, NOTE.E4, NOTE.A4], bass: NOTE.A2, arp: [NOTE.Cs5, NOTE.A4, NOTE.E5, NOTE.A4] },
  ];

  // Three or four hits a bar. The tension is in what is missing.
  const rhythms = [
    [1, 0, 0, 1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 0, 0, 1, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 0],
    [1, 0, 0, 1, 0, 1, 0, 0],
    [1, 0, 1, 0, 0, 1, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0],
  ];

  // The drone: one note under the entire loop, wrapping through the loop point
  // so there is literally nothing to hear at the seam.
  addNote(samples, {
    start: 0, duration: total + 2, freq: NOTE.D2, wave: 'sine',
    gain: 0.22, attack: 2.2, release: 2.4, wrap: true,
    vibratoHz: 0.07, vibratoDepth: 0.4,
  });

  progression.forEach((chord, bar) => {
    const start = bar * barLength;

    chord.pad.forEach((freq, voice) => {
      addNote(samples, {
        start, duration: barLength + 1.5, freq, wave: 'triangle',
        gain: 0.058, attack: 1.1, release: 1.7, wrap: true,
        vibratoHz: 0.1 + voice * 0.035, vibratoDepth: 0.9, harmonics: [1, 0.18],
      });
    });

    addNote(samples, {
      start, duration: barLength * 0.7, freq: chord.bass, wave: 'sine',
      gain: 0.12, attack: 0.45, release: 0.8, wrap: true,
    });

    rhythms[bar].forEach((sounds, step) => {
      if (!sounds) return;
      addNote(samples, {
        start: start + step * (barLength / steps),
        duration: 1.5,
        freq: chord.arp[step % chord.arp.length],
        wave: 'sine',
        gain: 0.048 + rng() * 0.018,
        attack: 0.02, release: 0.9, decay: 3.6, wrap: true,
        harmonics: [1, 0.22, 0.08],
      });
    });
  });

  // Two swells. The second starts near the end and wraps, so the loop point is
  // covered by something already in motion - which is what addNoise's new wrap
  // exists for.
  addNote(samples, {
    start: barLength * 3.4, duration: barLength * 2, freq: NOTE.A3, wave: 'triangle',
    gain: 0.03, attack: barLength * 0.9, release: barLength * 1.1, wrap: true,
    vibratoHz: 0.13, vibratoDepth: 1.4,
  });
  addNoise(samples, {
    start: total - barLength * 0.8, duration: barLength * 1.6,
    gain: 0.024, decay: 0.7, sweep: 0.12, rng, wrap: true,
  });

  writeWav('fathom.wav', normalise(samples, 0.7));
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

// The unlockables render at 12kHz. buildMusic stays at the full rate so its
// output is unchanged - Drift is what everybody already has.
withSampleRate(MUSIC_RATE, buildPulse);
withSampleRate(MUSIC_RATE, buildLantern);
withSampleRate(MUSIC_RATE, buildFathom);

const total = fs
  .readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.wav'))
  .reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(`\n${(total / 1024 / 1024).toFixed(2)} MB of audio in assets/audio/`);
