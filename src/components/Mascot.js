import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useSettings } from '../hooks/useSettings.js';
import { backgroundFor } from '../theme/backgrounds.js';
import { EYES, MOUTHS, RIG, RIG_UNITS, expressionFor } from '../theme/astronaut.js';
import { FIDGETS, REACTIONS, fidgetDelay, nextFidget } from '../theme/astronautMoves.js';
import { costumeFor, paletteSwap } from '../theme/costumes.js';
import { useRig } from './mascot/useRig.js';
import { Puffs, Snores, Sparkles, Sweat } from './mascot/Effects.js';

/**
 * The mascot: an astronaut, rigged.
 *
 * THE CONTRACT (read before replacing this with a Rive or Lottie character):
 *
 *   <Mascot size mood reaction lookAt restless roam onPress style />
 *
 *   mood      resting mood: idle | sleepy | thinking | panic | focused
 *                                              -> a Rive state / enum input
 *   reaction  { mood, key } played once whenever key changes: happy | ecstatic |
 *             oops | dizzy | wave | thinking | wow   -> a Rive trigger
 *   lookAt    { x, y } in -1..1, or null to let it look around by itself
 *                                              -> two Rive number inputs
 *   restless  fidget unprompted (the menu); off in play so it never upstages
 *   roam      how far it drifts, 1 = normal
 *   size      width and height in dp
 *
 * Screens talk to the mascot only through these props. A RiveMascot with the
 * same signature is a one-import swap.
 *
 * Built from the data in theme/astronaut.js (the rig) and
 * theme/astronautMoves.js (the choreography); useRig turns keyframes into
 * native-driven motion. Under reduced motion it holds its pose and still
 * changes expression - nothing moves.
 */

const SVG_PAD = 3; // rig units of slack so outlines are never clipped by the viewport
// Costume pieces reach well outside their part (a wizard hat is taller than
// the head it sits on), so their layer gets far more room.
const COSTUME_PAD = 36;
const TAGS = { path: Path, circle: Circle, ellipse: Ellipse, rect: Rect };
const BLINKING_EYES = ['open', 'wide', 'focused'];

/** A rig colour after the costume's palette has had its say. */
const paint = (value, swap) => (swap && swap[value]) || value;

const renderElement = (element, index, reflection, swap) => {
  const { tag, ...attrs } = element;
  const Tag = TAGS[tag];
  if (!Tag) return null;
  const resolved = {};
  Object.keys(attrs).forEach((key) => {
    const value = attrs[key] === 'REFLECTION' ? reflection : attrs[key];
    resolved[key] = key === 'fill' || key === 'stroke' ? paint(value, swap) : value;
  });
  return <Tag key={index} {...resolved} />;
};

/** One part of the rig, and everything that moves with it. */
const RigPart = memo(({ part, unit, rig, eyes, mouth, reflection, costume, swap }) => {
  // A costume can replace a part outright - a crown and an antenna fight.
  if (costume.hide.includes(part.key)) return null;
  const { box, origin } = part;
  const dress = costume.parts[part.key];
  const overDress = costume.over && costume.over[part.key];
  const art = part.face === 'eyes' ? EYES[eyes] : part.face === 'mouth' ? MOUTHS[mouth] : part.art;

  const style = {
    position: 'absolute',
    left: box.x * unit,
    top: box.y * unit,
    width: box.w * unit,
    height: box.h * unit,
    transformOrigin: [origin.x * unit, origin.y * unit, 0],
  };
  if (rig.transforms[part.key]) style.transform = rig.transforms[part.key];
  if (rig.opacity[part.key]) style.opacity = rig.opacity[part.key];
  if (part.clip) {
    Object.assign(style, {
      overflow: 'hidden',
      borderRadius: part.radius * unit,
      backgroundColor: paint(part.fill, swap),
      borderWidth: Math.max(1, 1.4 * unit),
      borderColor: paint(part.edge, swap),
    });
  }

  return (
    <Animated.View style={style} pointerEvents="none">
      {!!art && (
        <Svg
          width={(box.w + SVG_PAD * 2) * unit}
          height={(box.h + SVG_PAD * 2) * unit}
          viewBox={`${-SVG_PAD} ${-SVG_PAD} ${box.w + SVG_PAD * 2} ${box.h + SVG_PAD * 2}`}
          style={{ position: 'absolute', left: -SVG_PAD * unit, top: -SVG_PAD * unit }}
        >
          {art.map((element, index) => renderElement(element, index, reflection, swap))}
        </Svg>
      )}
      {/* The costume layer: on top of the part's own art, under its children,
          so a hat sits on the helmet but the visor stays in front of it. It
          belongs to the part, so it tilts, bobs and flips with it for free. */}
      {!!dress && <CostumeLayer elements={dress} box={box} unit={unit} reflection={reflection} />}
      {(part.children || []).map((child) => (
        <RigPart
          key={child.key}
          part={child}
          unit={unit}
          rig={rig}
          eyes={eyes}
          mouth={mouth}
          reflection={reflection}
          costume={costume}
          swap={swap}
        />
      ))}
      {/* Above the children: what has to cover something inside the part, like
          an eyepatch over an eye that lives inside the visor. */}
      {!!overDress && <CostumeLayer elements={overDress} box={box} unit={unit} reflection={reflection} />}
    </Animated.View>
  );
});

/** A costume's pieces for one part. Never palette-swapped: they are the
    costume's own colours, whatever suit they are worn on. */
const CostumeLayer = ({ elements, box, unit, reflection }) => (
  <Svg
    width={(box.w + COSTUME_PAD * 2) * unit}
    height={(box.h + COSTUME_PAD * 2) * unit}
    viewBox={`${-COSTUME_PAD} ${-COSTUME_PAD} ${box.w + COSTUME_PAD * 2} ${box.h + COSTUME_PAD * 2}`}
    style={{ position: 'absolute', left: -COSTUME_PAD * unit, top: -COSTUME_PAD * unit }}
  >
    {elements.map((element, index) => renderElement(element, index, reflection))}
  </Svg>
);

/** A move that spins the whole body must not be cut off halfway round. */
const isBig = (move) =>
  move.tracks.some(
    (item) => item.part === 'root' && item.prop === 'rot' &&
      Math.abs(item.keys[item.keys.length - 1][1]) >= 360,
  );

const Mascot = ({
  size = 96,
  mood = 'idle',
  reaction,
  lookAt,
  restless = false,
  roam = 1,
  reflection: reflectionProp,
  costumeKey,
  still: stillProp = false,
  onPress,
  style,
}) => {
  const settings = useSettings();
  // `still` holds a pose without animating - for small previews in a list,
  // where a dozen astronauts all floating would cost more than they show.
  const still = stillProp || !!settings.reducedMotion;
  // What it is wearing: the equipped costume, unless a preview says otherwise.
  const costume = costumeFor(costumeKey || settings.costumeKey);
  // The catalog entry is a stable object, so this recomputes only on a change
  // of outfit - and RigPart's memo still holds between frames.
  const swap = useMemo(() => paletteSwap(costume), [costume]);
  const unit = size / RIG_UNITS;
  const rig = useRig({ unit, roam });

  // The visor reflects whatever world it is floating in.
  const reflection = reflectionProp || backgroundFor(settings.backgroundKey).particles.tint;

  const [actMood, setActMood] = useState(null);
  const [puffs, setPuffs] = useState(0);
  const [sparkles, setSparkles] = useState(0);

  const actMoodRef = useRef(null);
  const bigRunning = useRef(false);
  const pending = useRef(null);
  const lastFidget = useRef(null);
  const timers = useRef([]);
  const fidgetTimer = useRef(null);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      if (fidgetTimer.current) clearTimeout(fidgetTimer.current);
      rig.stopAll();
    },
    [rig],
  );

  /* ---- resting mood -------------------------------------------------- */

  useEffect(() => {
    rig.playIdle(mood, { still });
  }, [rig, mood, still]);

  /* ---- reactions and fidgets ------------------------------------------ */

  const scheduleFidgetRef = useRef(() => {});

  const play = useCallback(
    (key) => {
      const move = REACTIONS[key] || FIDGETS[key];
      if (!move) return;

      if (still) {
        setActMood(key);
        actMoodRef.current = key;
        later(() => {
          setActMood(null);
          actMoodRef.current = null;
        }, move.duration);
        return;
      }

      // A small reaction waits for a backflip to land rather than cutting it
      // off mid-air. Only the latest waits - a queue would play stale news.
      if (bigRunning.current && !isBig(move)) {
        pending.current = key;
        return;
      }

      bigRunning.current = isBig(move);
      setActMood(key);
      actMoodRef.current = key;
      if (move.puffAt !== undefined) later(() => setPuffs((n) => n + 1), move.puffAt);
      if (move.sparkle) later(() => setSparkles((n) => n + 1), 460);

      rig.playAct(move, () => {
        bigRunning.current = false;
        setActMood(null);
        actMoodRef.current = null;
        const next = pending.current;
        pending.current = null;
        if (next) play(next);
        else scheduleFidgetRef.current();
      });
    },
    [rig, still, later],
  );

  // Keyed on the stamp, remembered, so a re-render (or a new `play` after a
  // settings change) can never replay a reaction that already happened.
  const reactionKey = reaction ? reaction.key : null;
  const reactionMood = reaction ? reaction.mood : null;
  const lastReaction = useRef(null);
  useEffect(() => {
    if (reactionKey === null || reactionKey === undefined || !reactionMood) return;
    if (reactionKey === lastReaction.current) return;
    lastReaction.current = reactionKey;
    play(reactionMood);
  }, [reactionKey, reactionMood, play]);

  /* It never simply stands there: every few seconds, something. Only when
     restless (the menu) and at rest - never in the middle of your game. */
  const scheduleFidget = useCallback(() => {
    if (fidgetTimer.current) clearTimeout(fidgetTimer.current);
    if (!restless || still || mood !== 'idle') return;
    fidgetTimer.current = setTimeout(() => {
      if (actMoodRef.current) {
        scheduleFidget();
        return;
      }
      const key = nextFidget(lastFidget.current);
      lastFidget.current = key;
      play(key);
    }, fidgetDelay());
  }, [restless, still, mood, play]);
  scheduleFidgetRef.current = scheduleFidget;

  useEffect(() => {
    scheduleFidget();
    return () => {
      if (fidgetTimer.current) clearTimeout(fidgetTimer.current);
    };
  }, [scheduleFidget]);

  /* ---- gaze ------------------------------------------------------------ */

  const lookX = lookAt ? lookAt.x : null;
  const lookY = lookAt ? lookAt.y : null;

  useEffect(() => {
    if (still) {
      rig.lookAt(0, 0, { instant: true });
      return undefined;
    }
    if (lookX !== null && lookY !== null) {
      rig.lookAt(Math.max(-1, Math.min(1, lookX)), Math.max(-1, Math.min(1, lookY)));
      return undefined;
    }
    if (mood === 'thinking') {
      rig.lookAt(-0.7, -0.8);
      return undefined;
    }
    if (mood === 'sleepy' || mood === 'panic') {
      rig.lookAt(0, mood === 'sleepy' ? 0.2 : 0);
      return undefined;
    }

    // Nobody to look at: take in the scenery.
    let alive = true;
    let timer;
    const wander = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (Math.random() < 0.3) rig.lookAt(0, 0);
        else rig.lookAt(Math.random() * 1.6 - 0.8, Math.random() * 1.1 - 0.6);
        wander();
      }, 1400 + Math.random() * 2000);
    };
    wander();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rig, still, lookX, lookY, mood]);

  /* ---- blinking -------------------------------------------------------- */

  const expression = expressionFor(actMood || mood);
  const canBlink = !still && BLINKING_EYES.includes(expression.eyes);

  useEffect(() => {
    if (!canBlink) return undefined;
    let alive = true;
    let timer;
    const next = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        rig.blink(Math.random() < 0.2);
        next();
      }, 2200 + Math.random() * 3000);
    };
    next();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rig, canBlink]);

  /* ---- drawing --------------------------------------------------------- */

  const body = (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <RigPart
        part={RIG}
        unit={unit}
        rig={rig}
        eyes={expression.eyes}
        mouth={expression.mouth}
        reflection={reflection}
        costume={costume}
        swap={swap}
      />
      {!still && <Puffs burst={puffs} unit={unit} />}
      {!still && <Sparkles burst={sparkles} unit={unit} />}
      <Snores active={!still && mood === 'sleepy'} unit={unit} />
      <Sweat active={!still && mood === 'panic'} unit={unit} />
    </View>
  );

  if (!onPress) {
    return (
      <View style={style} pointerEvents="none" accessible={false}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={style}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="The astronaut. Say hello."
    >
      {body}
    </Pressable>
  );
};

export default Mascot;
