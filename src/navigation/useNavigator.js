import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';

/**
 * A stack in sixty lines.
 *
 * For eight screens, one linear flow, no deep links and no tab bar,
 * react-navigation would add four packages and two native modules to buy screen
 * transitions. The API here maps one-to-one onto navigation.navigate/goBack, so
 * swapping later is mechanical if transitions ever become worth it.
 *
 * Params carry real objects - a solved board's Map of words goes straight
 * through with no serialisation boundary.
 */
export const useNavigator = (initial = { name: 'menu', params: {} }) => {
  const [stack, setStack] = useState([initial]);

  const push = useCallback(
    (name, params = {}) => setStack((current) => [...current, { name, params }]),
    [],
  );

  const replace = useCallback(
    (name, params = {}) =>
      setStack((current) => [...current.slice(0, -1), { name, params }]),
    [],
  );

  const pop = useCallback(() => {
    let popped = false;
    setStack((current) => {
      popped = current.length > 1;
      return popped ? current.slice(0, -1) : current;
    });
    return popped;
  }, []);

  const reset = useCallback((name, params = {}) => setStack([{ name, params }]), []);

  // Android hardware back. Returning false at the root lets Android background
  // the app, which is the behaviour people expect.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => pop());
    return () => subscription.remove();
  }, [pop]);

  const current = stack[stack.length - 1];

  return useMemo(
    () => ({ current, push, replace, pop, reset, canGoBack: stack.length > 1 }),
    [current, push, replace, pop, reset, stack.length],
  );
};

export default useNavigator;
