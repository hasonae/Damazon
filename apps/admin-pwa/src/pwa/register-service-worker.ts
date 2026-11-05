/**
 * Console service worker registration.
 *
 * The console uses `registerType: 'prompt'` and never caches staff data, so an
 * update waits for the operator to accept it. Swapping the bundle mid-review
 * would be worse than a stale one, because the operator could lose their place
 * in a queue.
 */

import { registerSW } from 'virtual:pwa-register';

export interface ConsoleWorkerEvents {
  readonly onUpdateAvailable?: () => void;
  readonly onError?: (error: unknown) => void;
}

export function registerServiceWorker(events: ConsoleWorkerEvents = {}): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  registerSW({
    immediate: true,
    onNeedRefresh() {
      events.onUpdateAvailable?.();
    },
    onRegisterError(error: unknown) {
      events.onError?.(error);
    },
  });
}
