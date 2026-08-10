import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, PanResponder, Platform, Vibration } from 'react-native';
import {
  HAPTICS_ENABLED,
  HIT_RADIUS_RATIO,
  LIVE_POINT_EPSILON,
  MAX_SAMPLES_PER_MOVE,
  SAMPLE_SPACING_RATIO,
} from './game_constants.js';
import {
  cellKey,
  findNearestCell,
  foldCell,
  sampleSegment,
} from './swipe_logic.js';

/**
 * Swipe-to-connect selection engine.
 *
 * Design notes (why it behaves the way it does):
 *
 *  - Geometry is *measured*, never assumed. Every tile reports its own rect via
 *    onLayout and the board reports its window position via measureInWindow, so
 *    hit testing stays correct however the grid is styled, sized or laid out.
 *  - The gesture never reads React state. The live path lives in a ref, so two
 *    touch events in the same frame can't race each other; state is only
 *    mirrored out for rendering.
 *  - Movement between touch events is interpolated, so a fast swipe can't skip
 *    a cell.
 *
 * Wiring: spread `panHandlers` on the touch surface, put `ref`/`onGridLayout`
 * on the tile container, and `onCellLayout(row, col)` on every tile.
 */

let hapticsAvailable = HAPTICS_ENABLED && Platform.OS === 'android';
const tick = () => {
  if (!hapticsAvailable) return;
  try {
    Vibration.vibrate(8);
  } catch (error) {
    hapticsAvailable = false; // no VIBRATE permission - just go quiet
  }
};

export const useSwipeSelection = ({ enabled, onCommit }) => {
  // Cells currently under the word being traced. Mirrored out for rendering.
  const [path, setPath] = useState([]);
  // Bumped whenever measured geometry changes, so consumers can redraw.
  const [geometryVersion, setGeometryVersion] = useState(0);

  const pathRef = useRef([]);
  const enabledRef = useRef(enabled);
  const onCommitRef = useRef(onCommit);

  const gridRef = useRef(null);
  const originRef = useRef(null); // board position/size in window coordinates
  const centersRef = useRef(new Map()); // cellKey -> center, in board coordinates
  const pitchRef = useRef(0); // distance between neighbouring cell centers
  const lastPointRef = useRef(null); // previous touch, in board coordinates
  const liveListenersRef = useRef(new Set());
  const lastEmittedRef = useRef(null);
  const cellLayoutHandlersRef = useRef(new Map());
  const bumpScheduledRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  /* ----------------------------------------------------------- geometry -- */

  const measureGrid = useCallback(() => {
    const node = gridRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return;

    node.measureInWindow((x, y, width, height) => {
      if (!width || !height) return;
      originRef.current = { x, y, width, height };
    });
  }, []);

  const scheduleGeometryBump = useCallback(() => {
    if (bumpScheduledRef.current) return;
    bumpScheduledRef.current = true;
    requestAnimationFrame(() => {
      bumpScheduledRef.current = false;
      measureGrid();
      setGeometryVersion((version) => version + 1);
    });
  }, [measureGrid]);

  const refreshPitch = useCallback(() => {
    const centers = centersRef.current;
    const first = centers.get(cellKey(0, 0));
    if (!first) return;

    const right = centers.get(cellKey(0, 1));
    const below = centers.get(cellKey(1, 0));

    let pitch = 0;
    if (right) pitch = Math.abs(right.x - first.x);
    if (below) {
      const vertical = Math.abs(below.y - first.y);
      pitch = pitch ? Math.min(pitch, vertical) : vertical;
    }
    pitchRef.current = pitch || first.size;
  }, []);

  const onGridLayout = useCallback(() => {
    measureGrid();
    // Android sometimes reports layout before the view has settled into its
    // final position, so take a second look on the next frame.
    requestAnimationFrame(measureGrid);
  }, [measureGrid]);

  /** Stable onLayout handler for one tile. */
  const onCellLayout = useCallback(
    (row, col) => {
      const key = cellKey(row, col);
      const cached = cellLayoutHandlersRef.current.get(key);
      if (cached) return cached;

      const handler = (event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        const center = {
          row,
          col,
          x: x + width / 2,
          y: y + height / 2,
          size: Math.min(width, height),
        };

        const previous = centersRef.current.get(key);
        if (previous && previous.x === center.x && previous.y === center.y) return;

        centersRef.current.set(key, center);
        refreshPitch();
        scheduleGeometryBump();
      };

      cellLayoutHandlersRef.current.set(key, handler);
      return handler;
    },
    [refreshPitch, scheduleGeometryBump],
  );

  const getCellCenter = useCallback((row, col) => {
    const center = centersRef.current.get(cellKey(row, col));
    return center ? { x: center.x, y: center.y } : null;
  }, []);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      requestAnimationFrame(measureGrid);
    });
    return () => subscription?.remove?.();
  }, [measureGrid]);

  /* ------------------------------------------------------- live pointer -- */

  const subscribeToLivePoint = useCallback((listener) => {
    liveListenersRef.current.add(listener);
    return () => {
      liveListenersRef.current.delete(listener);
    };
  }, []);

  const emitLivePoint = useCallback((point) => {
    let next = point;

    if (next) {
      // Keep the trailing line inside the board: Android can clip children that
      // spill outside a rounded, elevated parent.
      const origin = originRef.current;
      if (origin) {
        const pad = 10;
        next = {
          x: Math.max(-pad, Math.min(origin.width + pad, next.x)),
          y: Math.max(-pad, Math.min(origin.height + pad, next.y)),
        };
      }

      const previous = lastEmittedRef.current;
      if (
        previous &&
        Math.abs(previous.x - next.x) < LIVE_POINT_EPSILON &&
        Math.abs(previous.y - next.y) < LIVE_POINT_EPSILON
      ) {
        return; // not enough movement to be worth a redraw
      }
    } else if (!lastEmittedRef.current) {
      return;
    }

    lastEmittedRef.current = next;
    liveListenersRef.current.forEach((listener) => listener(next));
  }, []);

  /* ---------------------------------------------------------- selection -- */

  const applyPath = useCallback((next, grew) => {
    pathRef.current = next;
    setPath(next);
    if (grew) tick();
  }, []);

  /** Feed one touch position (window coordinates) through the sampler. */
  const trackTouch = useCallback(
    (pageX, pageY) => {
      const origin = originRef.current;
      const pitch = pitchRef.current;
      if (!origin || !pitch) {
        measureGrid(); // not measured yet - the next event will land
        return;
      }

      const point = { x: pageX - origin.x, y: pageY - origin.y };
      const previous = lastPointRef.current;
      const samples = previous
        ? sampleSegment(
            previous,
            point,
            Math.max(4, pitch * SAMPLE_SPACING_RATIO),
            MAX_SAMPLES_PER_MOVE,
          )
        : [point];

      const radius = pitch * HIT_RADIUS_RATIO;
      samples.forEach((sample) => {
        const hit = findNearestCell(centersRef.current, sample.x, sample.y, radius);
        if (!hit) return;
        const folded = foldCell(pathRef.current, hit);
        if (folded) applyPath(folded.path, folded.grew);
      });

      lastPointRef.current = point;
      emitLivePoint(point);
    },
    [applyPath, emitLivePoint, measureGrid],
  );

  const finishGesture = useCallback(
    (shouldCommit) => {
      const finished = pathRef.current;
      lastPointRef.current = null;
      emitLivePoint(null);
      if (finished.length > 0) applyPath([], false);
      if (shouldCommit && finished.length > 0) onCommitRef.current?.(finished);
    },
    [applyPath, emitLivePoint],
  );

  const clearSelection = useCallback(() => finishGesture(false), [finishGesture]);

  /* ------------------------------------------------------------ gesture -- */

  const responderRef = useRef(null);
  if (!responderRef.current) {
    responderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => enabledRef.current,
      onMoveShouldSetPanResponder: () => enabledRef.current,
      // Once a word is being traced, nothing gets to steal the gesture.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => false,

      onPanResponderGrant: (event) => {
        lastPointRef.current = null;
        trackTouch(event.nativeEvent.pageX, event.nativeEvent.pageY);
        // Cheap insurance against the board having moved since the last layout
        // pass; lands before the first move event.
        measureGrid();
      },
      onPanResponderMove: (event) => {
        trackTouch(event.nativeEvent.pageX, event.nativeEvent.pageY);
      },
      onPanResponderRelease: () => finishGesture(true),
      onPanResponderTerminate: () => finishGesture(false),
    });
  }

  return {
    panHandlers: responderRef.current.panHandlers,
    path,
    clearSelection,
    gridRef,
    onGridLayout,
    onCellLayout,
    getCellCenter,
    subscribeToLivePoint,
    geometryVersion,
  };
};

export default useSwipeSelection;
