import { ApiRequestError } from '@damazon/api-client';
import { Button, GlassCard, TextField } from '@damazon/design-system';
import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

export default function SignInPage(): JSX.Element {
  const { t } = useLocale();
  const { signIn, startPasswordRecovery } = useSession();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryStarted, setRecoveryStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setError(null);
      setNotice(null);
      setIsSubmitting(true);

      try {
        if (recoveryMode) {
          await startPasswordRecovery(identifier);
          setRecoveryStarted(true);
          setNotice(t('auth.recoveryInstructions'));
        } else {
          await signIn(identifier, password);
          navigate('/', { replace: true });
        }
      } catch (cause) {
        if (cause instanceof ApiRequestError) {
          setError(cause.isAuthenticationFailure ? t('auth.invalidCredentials') : cause.message);
        } else {
          setError(t('common.error'));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [identifier, navigate, password, recoveryMode, signIn, startPasswordRecovery, t],
  );

  const toggleRecovery = useCallback((): void => {
    setRecoveryMode((previous) => !previous);
    setRecoveryStarted(false);
    setError(null);
    setNotice(null);
  }, []);

  return (
    <div className="auth-card">
      <GlassCard blur="strong" transparency="medium" elevation="high" padding="lg">
        <header className="page__header">
          <h1 className="page__title">
            {recoveryMode ? t('auth.recoverPassword') : t('auth.signIn')}
          </h1>
          <p className="page__subtitle">{t('app.tagline')}</p>
        </header>

        <form className="auth-card__form" onSubmit={(event) => void onSubmit(event)} noValidate>
          {(!recoveryMode || !recoveryStarted) && (
            <TextField
              label={t('auth.identifier')}
              name="identifier"
              type="text"
              inputMode="email"
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          )}

          {!recoveryMode && (
            <TextField
              label={t('auth.password')}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
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
            {recoveryMode
              ? recoveryStarted
                ? t('auth.resendVerification')
                : t('auth.recoverPassword')
              : t('auth.signIn')}
          </Button>

          <Button type="button" variant="ghost" onClick={toggleRecovery} disabled={isSubmitting}>
            {recoveryMode ? t('auth.signIn') : t('auth.forgotPassword')}
          </Button>
        </form>

        {!recoveryMode && (
          <p className="auth-card__alt">
            {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
          </p>
        )}
      </GlassCard>
    </div>
  );
}
