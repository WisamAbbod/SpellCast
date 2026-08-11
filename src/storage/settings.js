import { readJson, writeJson } from './asyncStore.js';
import { KEYS } from './keys.js';
import { DEFAULT_SETTINGS, withDefaults } from './schema.js';

let cached = null;
const listeners = new Set();

export const loadSettings = async () => {
  if (cached) return cached;
  cached = withDefaults(await readJson(KEYS.settings, null), DEFAULT_SETTINGS);
  return cached;
};

/** Synchronous read for code that can't await - valid once boot has loaded them. */
export const getSettings = () => cached || DEFAULT_SETTINGS;

export const saveSettings = async (patch) => {
  const next = { ...getSettings(), ...patch };
  cached = next;
  listeners.forEach((listener) => listener(next));
  await writeJson(KEYS.settings, next);
  return next;
};

export const subscribeToSettings = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetSettings = async () => saveSettings(DEFAULT_SETTINGS);
