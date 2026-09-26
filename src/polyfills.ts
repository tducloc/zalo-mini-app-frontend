/**
 * The few newer built-ins the app and its libraries call, for iOS 15.1–15.3 (the app
 * supports 15.1, these arrived in 15.4). Imported first in app.ts. The build only rewrites
 * syntax for es2020; it does not add missing functions.
 *
 * - AbortSignal.throwIfAborted: upload retries (and p-retry) check it between steps.
 * - Object.hasOwn: p-retry checks its options with it.
 * - Array.prototype.at: p-queue reads the last queued task with it.
 */

function define(target: object, name: string, value: unknown) {
  if (!(name in target)) {
    Object.defineProperty(target, name, { value, writable: true, configurable: true });
  }
}

define(AbortSignal.prototype, 'throwIfAborted', function throwIfAborted(this: AbortSignal) {
  if (this.aborted) {
    // Old WebKit keeps no abort reason: throw what fetch would.
    throw this.reason ?? new DOMException('This operation was aborted', 'AbortError');
  }
});

define(Object, 'hasOwn', (object: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(object, key),
);

define(Array.prototype, 'at', function at(this: unknown[], index: number) {
  const position = Math.trunc(index) || 0;
  return this[position < 0 ? this.length + position : position];
});
