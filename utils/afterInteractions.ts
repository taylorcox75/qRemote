/**
 * Stand-in for `InteractionManager.runAfterInteractions`, which React Native
 * 0.88 removed. Defers `task` until the JS thread is idle (after the current
 * gesture/navigation work), falling back to the next macrotask where
 * `requestIdleCallback` isn't available (e.g. Jest's node environment).
 */
export function runAfterInteractions(task: () => void): void {
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(() => task());
  } else {
    setTimeout(task, 0);
  }
}
