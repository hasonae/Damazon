import { Link } from 'react-router-dom';

import { useConsoleSession } from '../core/console-session.js';

export default function NotFoundPage(): JSX.Element {
  const { status } = useConsoleSession();

  return (
    <div className="console-signin">
      <div className="console-signin__card">
        <h1 className="console-shell__title">الصفحة غير موجودة</h1>
        <div className="console-signin__form">
          <Link
            className="console-button"
            to={status === 'authenticated' ? '/dashboard' : '/sign-in'}
          >
            العودة
          </Link>
        </div>
      </div>
    </div>
  );
}
