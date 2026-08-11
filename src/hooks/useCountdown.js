import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { secondsRemaining } from '../game/time.js';

/**
 * Counts down to a deadline rather than decrementing a number once a second.
 *
 * A setTimeout chain drifts by however late each tick was and stops entirely
 * while the app is backgrounded - so a player could pause the clock by pulling
 * down the notification shade. Reading the wall clock can't be gamed and
 * self-corrects the moment the app comes back.
 */
export const useCountdown = (deadline, { running, onExpire, onTick } = {}) => {
  const [seconds, setSeconds] = useState(() =>
    deadline ? secondsRemaining(deadline) : 0,
  );
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onExpireRef.current = onExpire;
    onTickRef.current = onTick;
  });

  useEffect(() => {
    expiredRef.current = false;
  }, [deadline]);

  useEffect(() => {
    if (!deadline || !running) return undefined;

    // onTick fires here rather than inside the state updater: an updater must
    // stay pure or StrictMode's double-invoke makes the tick sound twice.
    let last = -1;
    const update = () => {
      const left = secondsRemaining(deadline);
      if (left !== last) {
        last = left;
        setSeconds(left);
        if (onTickRef.current) onTickRef.current(left);
      }
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        if (onExpireRef.current) onExpireRef.current();
      }
    };

    update();
    // Faster than 1Hz so the displayed second flips promptly after a resume.
    const interval = setInterval(update, 250);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });

    return () => {
      clearInterval(interval);
      subscription?.remove?.();
    };
  }, [deadline, running]);

  return seconds;
};
