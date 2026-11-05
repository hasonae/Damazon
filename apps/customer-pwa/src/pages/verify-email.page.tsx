import { ApiRequestError } from '@damazon/api-client';
import { Button, GlassCard } from '@damazon/design-system';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

export default function VerifyEmailPage(): JSX.Element {
  const { t } = useLocale();
  const { verifyEmail } = useSession();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const linkParams = new URLSearchParams(hash.slice(1));
  const challengeId = linkParams.get('challengeId') ?? '';
  const token = linkParams.get('token') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyEmail(challengeId, token);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const invalidLink = challengeId.length === 0 || token.length === 0;

  return (
    <div className="auth-card">
      <GlassCard blur="strong" transparency="medium" elevation="high" padding="lg">
        <header className="page__header">
          <h1 className="page__title">{t('auth.verifyEmail')}</h1>
          <p className="page__subtitle">{t('auth.emailVerificationInstructions')}</p>
        </header>
        <form className="auth-card__form" onSubmit={(event) => void onSubmit(event)}>
          {invalidLink && (
            <p className="dz-field__error" role="alert">
              {t('auth.invalidVerificationLink')}
            </p>
          )}
          {error !== null && (
            <p className="dz-field__error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            fullWidth
            disabled={invalidLink}
            loading={isSubmitting}
            loadingLabel={t('common.loading')}
          >
            {t('auth.verifyEmail')}
          </Button>
        </form>
        <p className="auth-card__alt">
          <Link to="/sign-in">{t('auth.signIn')}</Link>
        </p>
      </GlassCard>
    </div>
  );
}
