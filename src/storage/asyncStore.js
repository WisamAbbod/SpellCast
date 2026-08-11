import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The only place that touches AsyncStorage.
 *
 * Nothing here ever throws. A corrupt value reads as the fallback; a failed
 * write returns false. Losing a saved score is bad; crashing a round because
 * the disk was full is worse.
 */

export const readJson = async (key, fallback = null) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};

export const writeJson = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
};

export const readRaw = async (key, fallback = null) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : raw;
  } catch (error) {
    return fallback;
  }
};

export const writeRaw = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    return false;
  }
};

export const remove = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
};

export const readMany = async (keys) => {
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    const out = {};
    pairs.forEach(([key, raw]) => {
      try {
        out[key] = raw == null ? null : JSON.parse(raw);
      } catch (error) {
        out[key] = null;
      }
    });
    return out;
  } catch (error) {
    return {};
  }
};

export const removeMany = async (keys) => {
  try {
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (error) {
    return false;
  }
};

export const allKeys = async () => {
  try {
    return await AsyncStorage.getAllKeys();
  } catch (error) {
    return [];
  }
};

export const store = {
  readJson, writeJson, readRaw, writeRaw, remove, readMany, removeMany, allKeys,
};
