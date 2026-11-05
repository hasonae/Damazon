import { Avatar, Badge, Button, Divider, GlassCard, GlassPanel } from '@damazon/design-system';
import { type UserRole } from '@damazon/shared-types';
import { Link } from 'react-router-dom';

import { runtimeConfig } from '../config/runtime.js';
import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';
import { modeForRole } from '../utils/route-guards.js';

const ROLE_LABEL_KEYS: Readonly<
  Record<UserRole, Parameters<ReturnType<typeof useLocale>['t']>[0]>
> = {
  customer: 'role.customer',
  merchant: 'role.merchant',
  restaurant: 'role.restaurant',
  delivery_company: 'role.delivery_company',
  driver: 'role.driver',
  admin: 'role.admin',
};

export default function ProfilePage(): JSX.Element {
  const { t, locale, setLocale, formatDateTime } = useLocale();
  const { user, roles, activeRole, signOut, switchRole } = useSession();

  // The route guard guarantees an authenticated user, so a null user here means
  // the session was cleared mid-render; the shell reloads on the next render.
  if (user === null) {
    return <></>;
  }

  const mode = modeForRole(activeRole);

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{t('profile.title')}</h1>
      </header>

      <GlassCard blur="medium" transparency="light" padding="lg">
        <div className="order-row">
          <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatarUrl} size="lg" />
          <div className="order-row__meta">
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <span className="dz-numeric">{user.phone}</span>
            <span>{formatDateTime(user.createdAt)}</span>
          </div>
          <Badge tone={mode.role === 'customer' ? 'primary' : 'accent'}>
            {t(ROLE_LABEL_KEYS[activeRole ?? 'customer'])}
          </Badge>
        </div>
      </GlassCard>

      {roles.length > 1 && (
        <GlassPanel title={t('profile.switchRole')}>
          <div className="role-switcher">
            {roles.map((role) => (
              <Button
                key={role}
                size="sm"
                variant={role === activeRole ? 'primary' : 'secondary'}
                onClick={() => void switchRole(role)}
                disabled={role === activeRole}
              >
                {t(ROLE_LABEL_KEYS[role])}
              </Button>
            ))}
          </div>
        </GlassPanel>
      )}

      <GlassPanel title={t('business.registration')}>
        <p className="page__subtitle">{t('business.registrationHint')}</p>
        <Link to="/business/register">
          <Button variant="secondary" size="sm">
            {t('business.apply')}
          </Button>
        </Link>
      </GlassPanel>

      {activeRole === 'customer' && (
        <GlassPanel title={t('driver.applicationTitle')}>
          <p className="page__subtitle">{t('driver.applicationReviewNotice')}</p>
          <Link to="/driver/register">
            <Button variant="secondary" size="sm">
              {t('driver.apply')}
            </Button>
          </Link>
        </GlassPanel>
      )}

      {/* Staff and owners reach the administrative console from here; the two
          apps stay separate deployments (ADR-0008) but never feel disconnected. */}
      {roles.includes('admin') && (
        <GlassPanel title={t('profile.console')}>
          <div className="role-switcher">
            <a
              className="profile__console-link"
              href={runtimeConfig.consoleUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="secondary" size="sm">
                {t('profile.consoleOpen')}
              </Button>
            </a>
          </div>
        </GlassPanel>
      )}

      <GlassCard blur="subtle" transparency="faint" padding="md">
        <p className="page__subtitle">{t('profile.language')}</p>
        <div className="role-switcher">
          <Button
            size="sm"
            variant={locale === 'ar' ? 'primary' : 'secondary'}
            onClick={() => setLocale('ar')}
          >
            العربية
          </Button>
          <Button
            size="sm"
            variant={locale === 'en' ? 'primary' : 'secondary'}
            onClick={() => setLocale('en')}
          >
            English
          </Button>
        </div>
      </GlassCard>

      <Divider />

      <GlassPanel title={t('auth.signOut')}>
        <div className="role-switcher">
          <Button variant="secondary" onClick={() => void signOut(false)}>
            {t('auth.signOut')}
          </Button>
          <Button variant="danger" onClick={() => void signOut(true)}>
            {t('profile.signOutAll')}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
