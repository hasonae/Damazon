import {
  ApiRequestError,
  type BusinessNotification,
  type BusinessSummary,
  type RegisterBusinessClientRequest,
} from '@damazon/api-client';
import { Badge, Button, GlassCard, SelectField, TextField } from '@damazon/design-system';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

type BusinessType = Extract<
  RegisterBusinessClientRequest['type'],
  'merchant' | 'restaurant' | 'delivery_company'
>;

export default function BusinessRegistrationPage(): JSX.Element {
  const { t } = useLocale();
  const { client, user } = useSession();
  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType>('merchant');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [businesses, setBusinesses] = useState<readonly BusinessSummary[]>([]);
  const [notifications, setNotifications] = useState<readonly BusinessNotification[]>([]);

  const loadApplications = useCallback(async (): Promise<void> => {
    client.http.clearCache('businesses:');
    const [ownedBusinesses, ownerNotifications] = await Promise.all([
      client.businesses.mine(),
      client.businesses.subscriptionNotifications(),
    ]);
    setBusinesses(ownedBusinesses);
    setNotifications(ownerNotifications);
  }, [client]);

  useEffect(() => {
    void loadApplications().catch(() => setError(t('business.loadFailed')));
  }, [loadApplications, t]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setError(null);
      setFieldErrors({});
      setIsSubmitting(true);
      try {
        await client.businesses.register({ type, name, phone });
        await loadApplications();
        setSubmitted(true);
      } catch (cause) {
        if (cause instanceof ApiRequestError) {
          setFieldErrors(cause.fieldErrors ?? {});
          setError(cause.fieldErrors === undefined ? cause.message : null);
        } else {
          setError(t('common.error'));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, loadApplications, name, phone, t, type],
  );

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{t('business.registration')}</h1>
      </header>

      <GlassCard blur="medium" transparency="light" padding="lg">
        {submitted ? (
          <>
            <Badge tone="success">{t('business.pending')}</Badge>
            <p className="page__subtitle">{t('business.pending')}</p>
            <p className="page__subtitle">{t('business.subscriptionPrice')}</p>
            <Link to="/profile">{t('common.back')}</Link>
          </>
        ) : (
          <form className="auth-card__form" onSubmit={(event) => void onSubmit(event)}>
            <SelectField
              label={t('business.type')}
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as BusinessType)}
              options={[
                { value: 'merchant', label: t('business.merchant') },
                { value: 'restaurant', label: t('business.restaurant') },
                { value: 'delivery_company', label: t('business.deliveryCompany') },
              ]}
            />
            <TextField
              label={t('business.name')}
              name="name"
              required
              value={name}
              error={fieldErrors.name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              label={t('auth.identifier')}
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              error={fieldErrors.phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            {error !== null && (
              <p className="dz-field__error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={isSubmitting} loadingLabel={t('common.loading')}>
              {t('business.submit')}
            </Button>
          </form>
        )}
      </GlassCard>
      {notifications.map((notification) => (
        <GlassCard key={notification.id} padding="md">
          <Badge tone="warning">{notification.title}</Badge>
          <p className="page__subtitle">{notification.body}</p>
        </GlassCard>
      ))}
      {businesses.map((business) => (
        <GlassCard key={business.id} padding="md">
          <div className="order-card__head">
            <strong>{business.name}</strong>
            <Badge tone={business.verificationStatus === 'APPROVED' ? 'success' : 'warning'}>
              {business.verificationStatus}
            </Badge>
          </div>
          <p className="page__subtitle">
            {business.status === 'SUSPENDED'
              ? t('business.subscriptionSuspended')
              : business.verificationStatus !== 'APPROVED'
                ? t('business.notApproved')
                : business.status !== 'ACTIVE'
                  ? t('business.awaitingSubscription')
                  : t('business.active')}
          </p>
          {business.subscription !== null && (
            <p className="page__subtitle">
              {business.subscription.status === 'pending'
                ? t('business.subscriptionPending')
                : `${t('business.subscriptionUntil')} ${new Date(business.subscription.periodEnd).toLocaleString()}`}
            </p>
          )}
          <p className="page__subtitle">{t('business.subscriptionPrice')}</p>
        </GlassCard>
      ))}
    </div>
  );
}
