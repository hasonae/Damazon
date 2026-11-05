import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@damazon/design-system/styles.css';
import './styles/console.css';
import { ConsoleApp } from './app.js';
import { ConsoleSessionProvider } from './core/console-session.js';
import { registerServiceWorker } from './pwa/register-service-worker.js';

const pagesRoute = new URLSearchParams(window.location.search).get('__ghPagesRoute');
if (pagesRoute !== null) {
  const redirect = new URL(pagesRoute, window.location.origin);
  if (
    redirect.origin === window.location.origin &&
    redirect.pathname.startsWith(import.meta.env.BASE_URL)
  ) {
    window.history.replaceState(null, '', `${redirect.pathname}${redirect.search}${redirect.hash}`);
  }
}

registerServiceWorker();

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Root container #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    {/* The `professional` theme attribute is already set on <body> in
        index.html, so the document is in the neutral palette before the first
        paint rather than switching after React mounts. */}
    <ConsoleSessionProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ConsoleApp />
      </BrowserRouter>
    </ConsoleSessionProvider>
  </StrictMode>,
);
