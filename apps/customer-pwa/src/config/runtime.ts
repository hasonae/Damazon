/**
 * Runtime configuration for the customer PWA.
 *
 * Values come from Vite environment variables so one build can be deployed to
 * several environments without code changes. The API base URL is same-origin by
 * default because the dev server proxies `/api` and production serves both behind
 * one domain.
 */

const readEnv = (key: string, fallback: string): string => {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

export const runtimeConfig = {
  apiBaseUrl: readEnv('VITE_API_BASE_URL', '/api/v1'),
  appName: 'دامازون',
  defaultLocale: readEnv('VITE_DEFAULT_LOCALE', 'ar') as 'ar' | 'en',
  supportPhone: readEnv('VITE_SUPPORT_PHONE', ''),
  mapsBaseUrl: readEnv('VITE_MAPS_BASE_URL', 'https://www.openstreetmap.org/'),
  enableRealtime: readEnv('VITE_ENABLE_REALTIME', 'true') === 'true',
  /** Where the administrative console is hosted; profile links to it for admins. */
  consoleUrl: readEnv('VITE_CONSOLE_URL', 'http://localhost:5174'),
} as const;
