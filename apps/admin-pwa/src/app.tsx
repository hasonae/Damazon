/**
 * Administrative console root.
 *
 * Every route is guarded by two independent checks: a session must exist, and
 * the session's department must unlock the section. A failure renders an
 * explicit refusal rather than a blank screen, so an operator who lands on a
 * section they cannot use learns why.
 */

import { Spinner } from '@damazon/design-system';
import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useConsoleSession, type ConsoleStatus } from './core/console-session.js';
import { isSectionAllowed, sectionForPath } from './core/route-access.js';

const DashboardPage = lazy(() => import('./dashboard/dashboard.page.js'));
const SignInPage = lazy(() => import('./security/sign-in.page.js'));
const ForbiddenPage = lazy(() => import('./security/forbidden.page.js'));
const OrdersPage = lazy(() => import('./orders/orders.page.js'));
const UsersPage = lazy(() => import('./users/users.page.js'));
const DriversPage = lazy(() => import('./drivers/drivers.page.js'));
const AuditLogsPage = lazy(() => import('./audit-logs/audit-logs.page.js'));
const BusinessesPage = lazy(() => import('./businesses/businesses.page.js'));
const AdvertisementsPage = lazy(() => import('./advertisements/advertisements.page.js'));
const FinancePage = lazy(() => import('./finance/finance.page.js'));
const AnalyticsPage = lazy(() => import('./analytics/analytics.page.js'));
const SecurityPage = lazy(() => import('./security/security.page.js'));
const SettingsPage = lazy(() => import('./settings/settings.page.js'));
const NotFoundPage = lazy(() => import('./security/not-found.page.js'));

const ROUTE_ELEMENTS: Readonly<Record<string, ReactNode>> = {
  '/dashboard': <DashboardPage />,
  '/orders': <OrdersPage />,
  '/users': <UsersPage />,
  '/audit-logs': <AuditLogsPage />,
  '/drivers': <DriversPage />,
  '/businesses': <BusinessesPage />,
  '/advertisements': <AdvertisementsPage />,
  '/finance': <FinancePage />,
  '/analytics': <AnalyticsPage />,
  '/security': <SecurityPage />,
  '/settings': <SettingsPage />,
};

function ConsoleFallback(): JSX.Element {
  return (
    <div className="console-signin">
      <Spinner size="lg" label="جارٍ التحميل" />
    </div>
  );
}

function RequireConsoleSection({ children }: { readonly children: ReactNode }): JSX.Element {
  const { status, departments } = useConsoleSession();
  const section = sectionForPath(window.location.pathname);

  if (status === 'loading') {
    return <ConsoleFallback />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/sign-in" replace />;
  }

  if (status === 'forbidden') {
    return <Navigate to="/forbidden" replace />;
  }

  if (section !== null && !isSectionAllowed(section, departments)) {
    // The section exists but this operator's departments do not cover it.
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}

function StatusGate({
  status,
  children,
}: {
  readonly status: ConsoleStatus;
  readonly children: ReactNode;
}): JSX.Element {
  if (status === 'loading') {
    return <ConsoleFallback />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/sign-in" replace />;
  }

  if (status === 'forbidden') {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}

export function ConsoleApp(): JSX.Element {
  const { status } = useConsoleSession();

  return (
    <Suspense fallback={<ConsoleFallback />}>
      <Routes>
        <Route
          path="/sign-in"
          element={status === 'anonymous' ? <SignInPage /> : <Navigate to="/dashboard" replace />}
        />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        <Route
          path="/"
          element={
            <StatusGate status={status}>
              <Navigate to="/dashboard" replace />
            </StatusGate>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireConsoleSection>
              <DashboardPage />
            </RequireConsoleSection>
          }
        />

        {Object.entries(ROUTE_ELEMENTS)
          .filter(([path]) => path !== '/dashboard')
          .map(([path, element]) => (
            <Route
              key={path}
              path={path}
              element={<RequireConsoleSection>{element}</RequireConsoleSection>}
            />
          ))}

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
