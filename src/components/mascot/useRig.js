import { useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import { ACT_REST, FIDGETS, IDLE, REACTIONS } from '../../theme/astronautMoves.js';

/**
 * The astronaut's animation engine: keyframe data in, native-driven motion out.
 *
 * Every part carries up to three independent layers that are combined in the
 * transform, never overwritten:
 *
 *   idle   the resting loop (floating, breathing, the antenna bouncing)
 *   act    one-shot moves on top (a wave, a backflip, a facepalm)
 *   look   gaze - the eyes and a little of the head - plus the blink
 *
 * Adding layers rather than swapping animations is what lets it wave WHILE
 * drifting and track your finger WHILE breathing. Positions and rotations add;
 * scales multiply; opacity adds and is clamped.
 *
 * Values are only created for the (part, prop) pairs some move actually uses -
 * about a third of the full grid - because every value is a node on the native
 * animation graph.
 */

const EASE = {
  linear: Easing.linear,
  inOut: Easing.inOut(Easing.sin),
  in: Easing.in(Easing.quad),
  out: Easing.out(Easing.quad),
  back: Easing.out(Easing.back(1.6)),
  bounce: Easing.bounce,
};

const IDLE_REST = { x: 0, y: 0, rot: 0, scale: 1, scaleY: 1, opacity: 1 };

/** Which props each part ever animates, across every move there is. */
const USED = (() => {
  const used = {};
  const add = (item) => {
    (used[item.part] = used[item.part] || new Set()).add(item.prop);
  };
  Object.values(IDLE).forEach((tracks) => tracks.forEach(add));
  Object.values(REACTIONS).forEach((move) => move.tracks.forEach(add));
  Object.values(FIDGETS).forEach((move) => move.tracks.forEach(add));
  return used;
})();

const timing = (value, toValue, duration, easing = 'inOut') =>
  Animated.timing(value, {
    toValue,
    duration: Math.max(1, duration),
    easing: EASE[easing] || EASE.inOut,
    useNativeDriver: true,
  });

/** The steps of one track, from its first key onward. */
const stepsFor = (value, keys) =>
  keys.slice(1).map((key, i) => timing(value, key[1], key[0] - keys[i][0], key[2]));

const addAll = (nodes) => nodes.reduce((sum, node) => Animated.add(sum, node));

const DEG_RANGE = { inputRange: [-7200, 7200], outputRange: ['-7200deg', '7200deg'] };
const CLAMP_01 = { inputRange: [-2, 0, 1, 3], outputRange: [0, 0, 1, 1] };

export const useRig = ({ unit, roam = 1 }) =>
  useMemo(() => {
    const values = {};
    Object.entries(USED).forEach(([part, props]) => {
      values[part] = { idle: {}, act: {} };
      props.forEach((prop) => {
        values[part].idle[prop] = new Animated.Value(IDLE_REST[prop]);
        values[part].act[prop] = new Animated.Value(ACT_REST[prop]);
      });
    });

    const look = {
      eyesX: new Animated.Value(0),
      eyesY: new Animated.Value(0),
      headRot: new Animated.Value(0),
      blink: new Animated.Value(1),
    };

    /* ---- transforms, built once per size -------------------------------- */

    const transforms = {};
    const opacity = {};

    Object.keys(values).forEach((part) => {
      const { idle, act } = values[part];
      const layer = (prop, extra) => {
        const nodes = [];
        if (idle[prop]) {
          // Root drift can be widened on screens with room to roam.
          nodes.push(part === 'root' && (prop === 'x' || prop === 'y') && roam !== 1
            ? Animated.multiply(idle[prop], roam)
            : idle[prop]);
        }
        if (act[prop]) nodes.push(act[prop]);
        if (extra) nodes.push(extra);
        return nodes.length ? addAll(nodes) : null;
      };

      const list = [];
      const x = layer('x', part === 'eyes' ? look.eyesX : null);
      const y = layer('y', part === 'eyes' ? look.eyesY : null);
      const rot = layer('rot', part === 'head' ? look.headRot : null);
      if (x) list.push({ translateX: Animated.multiply(x, unit) });
      if (y) list.push({ translateY: Animated.multiply(y, unit) });
      if (rot) list.push({ rotate: rot.interpolate(DEG_RANGE) });
      if (idle.scale) list.push({ scale: Animated.multiply(idle.scale, act.scale) });
      if (idle.scaleY) list.push({ scaleY: Animated.multiply(idle.scaleY, act.scaleY) });
      transforms[part] = list;

      if (idle.opacity) {
        opacity[part] = Animated.add(idle.opacity, act.opacity).interpolate(CLAMP_01);
      }
    });

    // The eyes may have no motion tracks of their own beyond gaze; make sure
    // look and blink always reach them.
    if (!values.eyes) {
      transforms.eyes = [
        { translateX: Animated.multiply(look.eyesX, unit) },
        { translateY: Animated.multiply(look.eyesY, unit) },
      ];
    }
    transforms.eyes = [...(transforms.eyes || []), { scaleY: look.blink }];
    if (!values.head || !values.head.idle.rot) {
      transforms.head = [...(transforms.head || []), { rotate: look.headRot.interpolate(DEG_RANGE) }];
    }

    /* ---- playing --------------------------------------------------------- */

    let idleAnimation = null;
    let actAnimation = null;

    /**
     * Starts a resting mood's loops. Every value eases into its new loop over
     * a moment rather than snapping - going to sleep is a slow roll onto its
     * side, not a jump - and anything the new mood does not use eases home.
     */
    const playIdle = (mood, { still = false } = {}) => {
      if (idleAnimation) idleAnimation.stop();
      const tracks = IDLE[mood] || IDLE.idle;
      const touched = new Set();

      const animations = tracks.map((item) => {
        const value = values[item.part].idle[item.prop];
        touched.add(value);
        const first = item.keys[0][1];
        if (still) {
          value.setValue(first);
          return null;
        }
        return Animated.sequence([
          timing(value, first, 450),
          // resetBeforeIteration must be off. The default resets each timing
          // with resetAnimation(), which snaps the value back to the number it
          // was CONSTRUCTED with - the rest pose - at the top of every loop. So
          // a sleeping astronaut would jerk upright every few seconds and never
          // settle into its pose. Every idle track ends where it starts (a test
          // holds that), so no reset is needed; the loop just carries on.
          Animated.loop(Animated.sequence(stepsFor(value, item.keys)), {
            resetBeforeIteration: false,
          }),
        ]);
      });

      const settles = [];
      Object.keys(values).forEach((part) => {
        Object.entries(values[part].idle).forEach(([prop, value]) => {
          if (touched.has(value)) return;
          if (still) value.setValue(IDLE_REST[prop]);
          else settles.push(timing(value, IDLE_REST[prop], 450));
        });
      });

      if (still) return;
      idleAnimation = Animated.parallel([...animations.filter(Boolean), ...settles]);
      idleAnimation.start();
    };

    const resetAct = () => {
      Object.keys(values).forEach((part) => {
        Object.entries(values[part].act).forEach(([prop, value]) => value.setValue(ACT_REST[prop]));
      });
    };

    /**
     * Plays a one-shot move on the act layer. Tracks start from wherever the
     * value is now, so interrupting one move with another blends rather than
     * snapping; anything the new move does not touch is eased home quickly.
     */
    const playAct = (move, onDone) => {
      if (actAnimation) actAnimation.stop();
      const touched = new Set();

      const animations = move.tracks.map((item) => {
        const value = values[item.part].act[item.prop];
        touched.add(value);
        return Animated.sequence(stepsFor(value, item.keys));
      });

      const settles = [];
      Object.keys(values).forEach((part) => {
        Object.entries(values[part].act).forEach(([prop, value]) => {
          if (!touched.has(value)) settles.push(timing(value, ACT_REST[prop], 200));
        });
      });

      actAnimation = Animated.parallel([...animations, ...settles]);
      actAnimation.start(({ finished }) => {
        if (!finished) return;
        // A backflip ends at 360 degrees. That looks identical to 0, so the
        // snap back is invisible - and without it the next flip would start
        // from 360 and spin the wrong way.
        resetAct();
        if (onDone) onDone();
      });
    };

    const stopAll = () => {
      if (idleAnimation) idleAnimation.stop();
      if (actAnimation) actAnimation.stop();
      idleAnimation = null;
      actAnimation = null;
    };

    /** Springs the gaze toward a point in -1..1 space. */
    const lookAt = (x, y, { instant = false } = {}) => {
      const targets = [
        [look.eyesX, x * 4.5],
        [look.eyesY, y * 3],
        [look.headRot, x * 7],
      ];
      if (instant) {
        targets.forEach(([value, to]) => value.setValue(to));
        return;
      }
      Animated.parallel(
        targets.map(([value, to]) =>
          Animated.spring(value, { toValue: to, speed: 14, bounciness: 7, useNativeDriver: true }),
        ),
      ).start();
    };

    const blink = (twice = false) => {
      const once = [timing(look.blink, 0.1, 70, 'in'), timing(look.blink, 1, 90, 'out')];
      Animated.sequence(twice ? [...once, Animated.delay(90), ...once] : once).start();
    };

    return { transforms, opacity, playIdle, playAct, resetAct, stopAll, lookAt, blink };
  }, [unit, roam]);

export default useRig;
