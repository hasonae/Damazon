import { ApiRequestError } from '@damazon/api-client';
import { Button, GlassCard, TextField } from '@damazon/design-system';
import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

export default function RegisterPage(): JSX.Element {
  const { t } = useLocale();
  const { register, resendEmailVerification } = useSession();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
  });
  const [verificationPending, setVerificationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = useCallback((field: keyof typeof form, value: string): void => {
    setForm((previous) => ({ ...previous, [field]: value }));
  }, []);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setError(null);
      setNotice(null);
      setFieldErrors({});
      setIsSubmitting(true);

      try {
        if (verificationPending) {
          await resendEmailVerification(form.email);
          setNotice(t('auth.verificationSent'));
          return;
        }
        await register({
          phone: form.phone,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
        });
        setVerificationPending(true);
        setNotice(t('auth.verificationSent'));
      } catch (cause) {
        if (cause instanceof ApiRequestError) {
          setFieldErrors(cause.fieldErrors);
          setError(cause.fieldErrors === undefined ? cause.message : null);
        } else {
          setError(t('common.error'));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, register, resendEmailVerification, t, verificationPending],
  );

  return (
    <div className="auth-card">
      <GlassCard blur="strong" transparency="medium" elevation="high" padding="lg">
        <header className="page__header">
          <h1 className="page__title">{t('auth.register')}</h1>
        </header>

        <form className="auth-card__form" onSubmit={(event) => void onSubmit(event)} noValidate>
          {verificationPending ? (
            <p className="page__subtitle">{t('auth.emailVerificationInstructions')}</p>
          ) : (
            <>
              <TextField
                label={t('auth.firstName')}
                name="firstName"
                autoComplete="given-name"
                required
                value={form.firstName}
                error={fieldErrors.firstName}
                onChange={(event) => update('firstName', event.target.value)}
              />
              <TextField
                label={t('auth.lastName')}
                name="lastName"
                autoComplete="family-name"
                required
                value={form.lastName}
                error={fieldErrors.lastName}
                onChange={(event) => update('lastName', event.target.value)}
              />
              <TextField
                label={t('auth.phone')}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                hint="0941000001"
                required
                value={form.phone}
                error={fieldErrors.phone}
                onChange={(event) => update('phone', event.target.value)}
              />
              <TextField
                label={t('auth.email')}
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                error={fieldErrors.email}
                onChange={(event) => update('email', event.target.value)}
              />
              <TextField
                label={t('auth.password')}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                error={fieldErrors.password}
                onChange={(event) => update('password', event.target.value)}
              />
            </>
          )}

          {error !== null && (
            <p className="dz-field__error" role="alert">
              {error}
            </p>
          )}
          {notice !== null && (
            <p className="page__subtitle" role="status">
              {notice}
            </p>
          )}

          <Button type="submit" fullWidth loading={isSubmitting} loadingLabel={t('common.loading')}>
            {verificationPending ? t('auth.resendVerification') : t('auth.register')}
          </Button>
        </form>

        <p className="auth-card__alt">
          {t('auth.hasAccount')} <Link to="/sign-in">{t('auth.signIn')}</Link>
        </p>
      </GlassCard>
    </div>
  );
}
