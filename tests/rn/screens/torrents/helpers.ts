// Shared helpers for the torrents-screen suites. Not a test file.
//
// In RNTL 14 fireEvent returns a promise; an un-awaited press or changeText
// leaves its state update pending, so a following handler can read a stale
// value. These wrappers await the event and let React settle afterwards.
import { act, fireEvent } from '@testing-library/react-native';

type El = Parameters<typeof fireEvent.press>[0];

export const flush = () => act(async () => {});

export async function press(el: El) {
  await fireEvent.press(el);
  await flush();
}

export async function type(el: El, text: string) {
  await fireEvent.changeText(el, text);
  await flush();
}

export async function fire(el: El, event: string, ...args: unknown[]) {
  await fireEvent(el, event, ...args);
  await flush();
}

/** Nearest ancestor (or self) whose props define `prop` — e.g. a Modal's onRequestClose. */
export function ancestorWith(el: El, prop: string): El {
  let node: El | null = el;
  while (node) {
    if (typeof (node.props as Record<string, unknown>)[prop] === 'function') return node;
    node = node.parent as El | null;
  }
  throw new Error(`No ancestor with ${prop}`);
}

/** Every host element under `root` (inclusive) matching `pred`, in tree order. */
export function findAllHost(root: El, pred: (node: El) => boolean): El[] {
  const out: El[] = [];
  const walk = (node: El) => {
    if (pred(node)) out.push(node);
    for (const child of node.children) {
      if (typeof child === 'object') walk(child as El);
    }
  };
  walk(root);
  return out;
}
