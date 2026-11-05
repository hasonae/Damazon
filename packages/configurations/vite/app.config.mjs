/**
 * Shared Vite application preset.
 *
 * Both PWAs import this and override only what genuinely differs: the dev-server
 * port, the API proxy target, and the PWA manifest fields. Keeping the plugin
 * order and the build target here means a change to the bundling contract
 * cannot land in one application and miss the other.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

/**
 * Where the dev proxy sends `/api` requests. Resolution order:
 *
 * 1. `VITE_API_TARGET` in the environment (explicit override),
 * 2. the `PORT` in the repository-root `.env` (single source of truth for the
 *    local backend port — it may differ from 3000 when that port is taken),
 * 3. `http://localhost:3000`.
 */
function resolveApiTarget() {
  if (process.env.VITE_API_TARGET) {
    return process.env.VITE_API_TARGET;
  }
  try {
    const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
    if (existsSync(rootEnv)) {
      const match = readFileSync(rootEnv, 'utf8').match(/^PORT=(\d+)/m);
      if (match) {
        return `http://localhost:${match[1]}`;
      }
    }
  } catch {
    // Fall through to the default.
  }
  return 'http://localhost:3000';
}

export const DAMAZON_API_TARGET = resolveApiTarget();

export function damazonAppConfig({ port = 5173 } = {}) {
  return {
    plugins: [],
    server: {
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: DAMAZON_API_TARGET,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      strictPort: true,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      cssTarget: 'chrome111',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
}

export default defineConfig(damazonAppConfig());
