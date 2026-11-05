import { ApiRequestError } from '@damazon/api-client';
import { Button, TextField } from '@damazon/design-system';
import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useConsoleSession } from '../core/console-session.js';

export default function SignInPage(): JSX.Element {
  const { signIn, startPasswordRecovery } = useConsoleSession();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setError(null);
      setIsSubmitting(true);

      try {
        if (recoveryMode) {
          await startPasswordRecovery(identifier);
          setRecoverySent(true);
          setNotice('إذا كان الحساب موجوداً، فقد أرسلنا رابط استعادة إلى بريده المسجل.');
        } else {
          await signIn(identifier, password);
          navigate('/', { replace: true });
        }
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError && cause.isAuthenticationFailure
            ? 'بيانات الدخول غير صحيحة'
            : cause instanceof ApiRequestError
              ? cause.message
              : 'تعذّر تسجيل الدخول',
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [identifier, navigate, password, recoveryMode, signIn, startPasswordRecovery],
  );

  const toggleRecovery = (): void => {
    setRecoveryMode((previous) => !previous);
    setRecoverySent(false);
    setError(null);
    setNotice(null);
  };

  return (
    <div className="console-signin">
      <div className="console-signin__card">
        <h1 className="console-shell__title">دامازون - لوحة الإدارة</h1>
        <p className="page__subtitle">
          {recoveryMode
            ? 'أدخل اسم المستخدم أو البريد أو الهاتف المرتبط بالحساب'
            : 'سجّل الدخول باسم المستخدم أو البريد الإلكتروني أو الهاتف'}
        </p>

        <form
          className="console-signin__form"
          onSubmit={(event) => void onSubmit(event)}
          noValidate
        >
          {(!recoveryMode || !recoverySent) && (
            <TextField
              label="اسم المستخدم أو البريد أو الهاتف"
              name="identifier"
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          )}
          {!recoveryMode && (
            <TextField
              label="كلمة المرور"
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
          <Button type="submit" fullWidth loading={isSubmitting} loadingLabel="جارٍ الإرسال">
            {recoveryMode
              ? recoverySent
                ? 'إعادة إرسال رابط الاستعادة'
                : 'استعادة كلمة المرور'
              : 'تسجيل الدخول'}
          </Button>
          <Button type="button" variant="ghost" onClick={toggleRecovery} disabled={isSubmitting}>
            {recoveryMode ? 'العودة لتسجيل الدخول' : 'نسيت كلمة المرور؟'}
          </Button>
        </form>
      </div>
    </div>
  );
}
