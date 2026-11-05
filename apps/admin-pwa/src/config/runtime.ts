/**
 * Runtime configuration for the administrative console.
 *
 * The console is deployed separately from the customer application and points at
 * its own API origin. It is never bundled with consumer code, so it also carries
 * a `noindex` policy in `index.html` to keep staff screens out of search results.
 */

const readEnv = (key: string, fallback: string): string => {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

export const runtimeConfig = {
  apiBaseUrl: readEnv('VITE_API_BASE_URL', '/api/v1'),
  appName: 'دامازون - لوحة الإدارة',
  /** Console sessions are short by policy: staff re-authenticate more often. */
  idleSignOutMinutes: Number.parseInt(readEnv('VITE_IDLE_SIGNOUT_MINUTES', '30'), 10),
  /** Destructive and financial actions always require an explicit reason. */
  requireReasonForActions: readEnv('VITE_REQUIRE_ACTION_REASON', 'true') === 'true',
  pageSize: Number.parseInt(readEnv('VITE_DEFAULT_PAGE_SIZE', '25'), 10),
  /** Where the customer storefront is hosted; the sidebar links back to it. */
  storefrontUrl: readEnv('VITE_STOREFRONT_URL', 'http://localhost:5173'),
} as const;
