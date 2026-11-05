/**
 * Service worker registration.
 *
 * `vite-plugin-pwa` generates the worker and its manifest. This module only
 * registers it and surfaces update availability, because an update that arrives
 * mid-order must not swap the bundle underneath a half-completed checkout.
 */

import { registerSW } from 'virtual:pwa-register';

import { runtimeConfig } from '../config/runtime.js';

export interface ServiceWorkerEvents {
  readonly onUpdateAvailable?: () => void;
  readonly onOfflineReady?: () => void;
  readonly onError?: (error: unknown) => void;
}

export function registerServiceWorker(events: ServiceWorkerEvents = {}): void {
  if (!runtimeConfig.enableRealtime || !('serviceWorker' in navigator)) {
    return;
  }

  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Reported rather than auto-applied: `registerType: 'autoUpdate'` still
      // activates on the next navigation, so the user is told what happened.
      events.onUpdateAvailable?.();
    },
    onOfflineReady() {
      events.onOfflineReady?.();
    },
    onRegisterError(error: unknown) {
      events.onError?.(error);
    },
  });
}
