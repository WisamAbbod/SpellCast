import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** A ticking clock for countdowns. Re-syncs when the app returns to the front. */
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      subscription?.remove?.();
    };
  }, [intervalMs]);

  return now;
};
