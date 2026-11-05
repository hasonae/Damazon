/**
 * Application shell for the consumer PWA.
 *
 * The layout is the glass-and-bento language: a floating navigation bar over a
 * water-toned backdrop, a bottom tab bar on phones (Part 9.5: Home, Search,
 * Orders, Favorites, Profile), and content regions sized by the design
 * system's layout tokens. Direction comes from the locale context, so no
 * component below this one branches on RTL. All navigation uses router
 * `NavLink`, never an anchor, so a tab press is a client-side transition
 * instead of a full page reload.
 */

import { GlassNavigation } from '@damazon/design-system';
import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';

import {
  CartIcon,
  HeartIcon,
  HomeIcon,
  ReceiptIcon,
  SearchIcon,
  UserIcon,
} from '../components/icons.js';
import { useLocale } from '../locales/locale-context.js';
import { useCart } from '../store/cart.js';
import { useSession } from '../store/session.js';

export interface AppShellProps {
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

function linkClass(isActive: boolean): string {
  return isActive ? 'app-shell__link app-shell__link--active' : 'app-shell__link';
}

export function AppShell({ header, footer, children }: AppShellProps): JSX.Element {
  const { direction, t } = useLocale();
  const { status } = useSession();
  const { itemCount } = useCart();

  const tabs = [
    { to: '/', label: t('nav.home'), icon: HomeIcon, end: true },
    { to: '/search', label: t('nav.search'), icon: SearchIcon, end: false },
    { to: '/orders', label: t('nav.orders'), icon: ReceiptIcon, end: false },
    { to: '/favorites', label: t('nav.favorites'), icon: HeartIcon, end: false },
    { to: '/profile', label: t('nav.profile'), icon: UserIcon, end: false },
  ] as const;

  return (
    <div dir={direction} className="app-shell" data-session={status}>
      <a className="app-shell__skip" href="#main-content">
        {t('nav.home')}
      </a>

      <GlassNavigation
        brand={
          <Link className="app-shell__brand" to="/">
            <img
              className="app-shell__logo"
              src="/damazon-logo.png"
              alt=""
              width={28}
              height={28}
            />
            <span>{t('app.name')}</span>
          </Link>
        }
        variant="floating"
        actions={
          <>
            {header}
            <Link
              className="app-shell__cart"
              to="/cart"
              aria-label={t('nav.cart')}
              title={t('nav.cart')}
            >
              <CartIcon />
              {itemCount > 0 && (
                <span className="app-shell__badge" aria-hidden="true">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </>
        }
      >
        <nav aria-label={t('nav.home')} className="app-shell__links">
          <NavLink end to="/" className={({ isActive }) => linkClass(isActive)}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => linkClass(isActive)}>
            {t('nav.search')}
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => linkClass(isActive)}>
            {t('nav.orders')}
          </NavLink>
          <NavLink to="/favorites" className={({ isActive }) => linkClass(isActive)}>
            {t('nav.favorites')}
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => linkClass(isActive)}>
            {t('nav.profile')}
          </NavLink>
        </nav>
      </GlassNavigation>

      <main id="main-content" className="app-shell__main">
        {children}
      </main>

      {/* Bottom tab bar: the primary navigation on phones, hidden on the
          desktop layout where the top bar already exposes every destination. */}
      <nav className="app-shell__tabbar" aria-label={t('nav.home')}>
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? 'app-shell__tab app-shell__tab--active' : 'app-shell__tab'
            }
          >
            <Icon size={20} />
            <span className="app-shell__tab-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {footer !== undefined && <footer className="app-shell__footer">{footer}</footer>}
    </div>
  );
}
