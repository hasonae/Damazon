import { useConsoleSession } from '../core/console-session.js';

/**
 * Rendered when a session is valid but the operator's departments do not cover
 * the requested section, or when the account has no department at all. It names
 * the reason so an operator knows to request a department rather than retry.
 */
export default function ForbiddenPage(): JSX.Element {
  const { status, departments, signOut } = useConsoleSession();

  return (
    <div className="console-signin">
      <div className="console-signin__card">
        <h1 className="console-shell__title">لا تملك صلاحية الوصول</h1>

        {status === 'forbidden' ? (
          <p className="page__subtitle">
            حسابك لا يرتبط بأي قسم إداري. صلاحية الوصول تُمنح من خلال الانتماء إلى قسم، ولا تمنح
            صلاحية الدور الإداري وحده.
          </p>
        ) : (
          <p className="page__subtitle">
            أقسامك الحالية: {departments.length > 0 ? departments.join('، ') : '—'}. هذا القسم غير
            مشمول بصلاحياتك.
          </p>
        )}

        <div className="console-signin__form">
          <button type="button" className="console-button" onClick={() => void signOut()}>
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}
