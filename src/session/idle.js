/**
 * "Do this once the app has a moment."
 *
 * Replaces InteractionManager.runAfterInteractions, which React Native 0.86
 * deprecated in favour of requestIdleCallback - and which now logs a warning
 * the moment it is so much as read.
 *
 * Same { cancel } shape as the old handle, so call sites changed by one line.
 *
 * The timeout is the important part. Idle means the JS thread has nothing to
 * do, and a screen with JS-driven animation may never quite get there; without
 * a deadline, boot's audio init could wait forever and the app would simply be
 * silent. 500ms is long enough to let the first frame paint.
 */
export const runWhenIdle = (task, { timeout = 500 } = {}) => {
  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(() => task(), { timeout });
    return {
      cancel: () => {
        if (typeof globalThis.cancelIdleCallback === 'function') globalThis.cancelIdleCallback(id);
      },
    };
  }

  // Anywhere without it (tests, older runtimes): next tick.
  const id = setTimeout(task, 0);
  return { cancel: () => clearTimeout(id) };
};

export default runWhenIdle;
