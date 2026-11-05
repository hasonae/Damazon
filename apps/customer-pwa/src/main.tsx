import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@damazon/design-system/styles.css';
import './styles/app.css';
import { App } from './app.js';
import { LocaleProvider } from './locales/locale-context.js';
import { registerServiceWorker } from './pwa/register-service-worker.js';
import { CartProvider } from './store/cart.js';
import { SessionProvider } from './store/session.js';

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
    <LocaleProvider defaultLocale="ar">
      <SessionProvider>
        {/* The cart reads the session, so it sits inside SessionProvider;
            the shell badge reads the cart, so it sits outside the routes. */}
        <CartProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <App />
          </BrowserRouter>
        </CartProvider>
      </SessionProvider>
    </LocaleProvider>
  </StrictMode>,
);
