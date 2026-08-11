import { useEffect, useState } from 'react';
import { getSettings, subscribeToSettings } from '../storage/settings.js';

/** Live settings, without threading them through every screen as props. */
export const useSettings = () => {
  const [settings, setSettings] = useState(getSettings);
  useEffect(() => subscribeToSettings(setSettings), []);
  return settings;
};
