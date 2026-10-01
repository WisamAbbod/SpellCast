import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors.js';

/**
 * A horizontal 0-1 slider, drawn here rather than installed: it is a track, a
 * fill and a thumb, and a package for that would be the screen's only native
 * dependency.
 *
 * onChange fires on every movement (for live feedback), onCommit once on
 * release (for persisting), so a drag writes storage once, not sixty times.
 *
 * The thumb and fill ignore touches, so every touch lands on the track itself
 * and locationX is always measured from its left edge.
 */

const THUMB = 22;
const HEIGHT = 36; // the touch target; the visible track is much thinner
const A11Y_STEP = 0.1;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const Slider = ({ value, onChange, onCommit, label, dimmed = false, style }) => {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startRef = useRef(0);
  const latestRef = useRef(value);
  // The responder is created once; the handlers it calls must not be stale.
  const handlersRef = useRef({ onChange, onCommit });
  handlersRef.current = { onChange, onCommit };

  const report = (next) => {
    latestRef.current = next;
    if (handlersRef.current.onChange) handlersRef.current.onChange(next);
  };
  const commit = () => {
    if (handlersRef.current.onCommit) handlersRef.current.onCommit(latestRef.current);
  };
  const travel = () => Math.max(1, widthRef.current - THUMB);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Once dragging, a slight vertical wobble must not hand the gesture to
      // the settings ScrollView and strand the thumb mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        // A tap anywhere on the track jumps there; a drag continues from it.
        startRef.current = clamp01((event.nativeEvent.locationX - THUMB / 2) / travel());
        report(startRef.current);
      },
      onPanResponderMove: (event, gesture) => report(clamp01(startRef.current + gesture.dx / travel())),
      onPanResponderRelease: commit,
      onPanResponderTerminate: commit,
    }),
  ).current;

  const nudge = (direction) => {
    const next = clamp01(Math.round((value + direction * A11Y_STEP) * 100) / 100);
    latestRef.current = next;
    if (onChange) onChange(next);
    if (onCommit) onCommit(next);
  };

  const percent = Math.round(clamp01(value) * 100);
  const offset = clamp01(value) * Math.max(0, width - THUMB);

  return (
    <View
      {...responder.panHandlers}
      onLayout={(event) => {
        widthRef.current = event.nativeEvent.layout.width;
        setWidth(event.nativeEvent.layout.width);
      }}
      style={[styles.hit, dimmed && styles.dimmed, style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent} percent`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => nudge(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: offset }]} />
      </View>
      <View style={[styles.thumb, { transform: [{ translateX: offset }] }]} pointerEvents="none" />
    </View>
  );
};

const styles = StyleSheet.create({
  hit: { height: HEIGHT, justifyContent: 'center' },
  dimmed: { opacity: 0.45 },
  track: {
    height: 6,
    marginHorizontal: THUMB / 2,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  // The track starts half a thumb in, where the thumb's centre does, so the
  // fill's width is simply the thumb's offset.
  fill: { height: '100%', backgroundColor: colors.primary },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});

export default Slider;
