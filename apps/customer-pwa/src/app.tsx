/**
 * Application root for the consumer PWA.
 *
 * Route splitting is deliberate: each feature module is loaded on demand so the
 * first paint on a mobile connection carries the home screen only. Protected
 * routes are declared with a lazy element plus a guard, so an unauthenticated
 * visitor never downloads the code for a screen they cannot open.
 */

import { Spinner } from '@damazon/design-system';
import type { UserRole } from '@damazon/shared-types';
import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './layouts/app-shell.js';
import { useLocale } from './locales/locale-context.js';
import { useSession } from './store/session.js';
import { isProtectedRoute, modeForRole } from './utils/route-guards.js';

const HomePage = lazy(() => import('./pages/home.page.js'));
const SearchPage = lazy(() => import('./pages/search.page.js'));
const ProductPage = lazy(() => import('./pages/product.page.js'));
const StorePage = lazy(() => import('./pages/store.page.js'));
const SignInPage = lazy(() => import('./pages/sign-in.page.js'));
const RegisterPage = lazy(() => import('./pages/register.page.js'));
const VerifyEmailPage = lazy(() => import('./pages/verify-email.page.js'));
const ResetPasswordPage = lazy(() => import('./pages/reset-password.page.js'));
const ProfilePage = lazy(() => import('./pages/profile.page.js'));
const OrdersPage = lazy(() => import('./pages/orders.page.js'));
const OrderDetailPage = lazy(() => import('./pages/order-detail.page.js'));
const CartPage = lazy(() => import('./pages/cart.page.js'));
const CheckoutPage = lazy(() => import('./pages/checkout.page.js'));
const FavoritesPage = lazy(() => import('./pages/favorites.page.js'));
const ZonesPage = lazy(() => import('./pages/zones.page.js'));
const MerchantPage = lazy(() => import('./pages/merchant.page.js'));
const DeliveryCompanyPage = lazy(() => import('./pages/delivery-company.page.js'));
const DriverPage = lazy(() => import('./pages/driver.page.js'));
const DriverRegistrationPage = lazy(() => import('./pages/driver-registration.page.js'));
const BusinessRegistrationPage = lazy(() => import('./pages/business-registration.page.js'));
const NotFoundPage = lazy(() => import('./pages/not-found.page.js'));

function RouteFallback(): JSX.Element {
  const { t } = useLocale();
  return (
    <div className="route-fallback">
      <Spinner size="lg" label={t('common.loading')} />
    </div>
  );
}

function RequireSession({ children }: { readonly children: ReactNode }): JSX.Element {
  const { status } = useSession();

  if (status === 'loading') {
    return <RouteFallback />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/sign-in" replace state={{ from: window.location.pathname }} />;
  }

  return <>{children}</>;
}

function RequireRole({
  roles,
  children,
}: {
  readonly roles: readonly UserRole[];
  readonly children: ReactNode;
}): JSX.Element {
  const { activeRole } = useSession();
  if (activeRole === null || !roles.includes(activeRole)) {
    return <Navigate to={modeForRole(activeRole).landingRoute} replace />;
  }
  return <>{children}</>;
}

export function App(): JSX.Element {
  const { t } = useLocale();
  const { status, activeRole } = useSession();
  const mode = modeForRole(status === 'authenticated' ? activeRole : null);

  return (
    <AppShell
      footer={
        <div className="app-footer">
          <span>{t('app.name')}</span>
          <span>{t('app.tagline')}</span>
        </div>
      }
    >
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/search" element={<SearchPage />} />

          {/* Public catalogue routes: guests browse before signing up. */}
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/store/:id" element={<StorePage />} />

          <Route
            path="/sign-in"
            element={
              status === 'authenticated' ? (
                <Navigate to={mode.landingRoute} replace />
              ) : (
                <SignInPage />
              )
            }
          />
          <Route
            path="/register"
            element={
              status === 'authenticated' ? (
                <Navigate to={mode.landingRoute} replace />
              ) : (
                <RegisterPage />
              )
            }
          />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/cart"
            element={
              <RequireSession>
                <CartPage />
              </RequireSession>
            }
          />
          <Route
            path="/checkout"
            element={
              <RequireSession>
                <CheckoutPage />
              </RequireSession>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireSession>
                <OrdersPage />
              </RequireSession>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <RequireSession>
                <OrderDetailPage />
              </RequireSession>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireSession>
                <ProfilePage />
              </RequireSession>
            }
          />
          <Route
            path="/favorites"
            element={
              <RequireSession>
                <FavoritesPage />
              </RequireSession>
            }
          />
          <Route
            path="/zones"
            element={
              <RequireSession>
                <ZonesPage />
              </RequireSession>
            }
          />

          {/* Role modes share the consumer shell. The administrative console is a
              separate application and is intentionally unreachable here
              (ADR-0008). */}
          <Route
            path="/business/register"
            element={
              <RequireSession>
                <BusinessRegistrationPage />
              </RequireSession>
            }
          />
          <Route
            path="/merchant"
            element={
              <RequireSession>
                <RequireRole roles={['merchant']}>
                  <MerchantPage />
                </RequireRole>
              </RequireSession>
            }
          />
          <Route
            path="/restaurant"
            element={
              <RequireSession>
                <RequireRole roles={['restaurant']}>
                  <MerchantPage />
                </RequireRole>
              </RequireSession>
            }
          />
          <Route
            path="/delivery-company"
            element={
              <RequireSession>
                <RequireRole roles={['delivery_company']}>
                  <DeliveryCompanyPage />
                </RequireRole>
              </RequireSession>
            }
          />
          <Route
            path="/driver"
            element={
              <RequireSession>
                <RequireRole roles={['driver']}>
                  <DriverPage />
                </RequireRole>
              </RequireSession>
            }
          />
          <Route
            path="/driver/register"
            element={
              <RequireSession>
                <DriverRegistrationPage />
              </RequireSession>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export { isProtectedRoute };
