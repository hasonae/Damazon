/**
 * Console shell.
 *
 * The visual language is deliberately different from the consumer application:
 * a neutral palette, a persistent sidebar, dense content, and no motion. All of
 * that comes from the `professional` token set and the motion scale of 0, not
 * from separate component code.
 */

import { Avatar, Divider } from '@damazon/design-system';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { runtimeConfig } from '../config/runtime.js';
import { useConsoleSession } from '../core/console-session.js';
import { visibleSections } from '../core/route-access.js';

export interface ConsoleShellProps {
  readonly title: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function ConsoleShell({ title, actions, children }: ConsoleShellProps): JSX.Element {
  const { user, departments, signOut } = useConsoleSession();
  const sections = visibleSections(departments);

  return (
    <div className="console-shell">
      <aside className="console-shell__sidebar">
        <div className="console-shell__brand">
          <img src="/damazon-logo.png" alt="" width={28} height={28} />
          <span>دامازون</span>
        </div>

        <nav aria-label="أقسام لوحة الإدارة">
          <ul className="console-nav">
            {sections.map((section) => (
              <li key={section.path}>
                <NavLink
                  to={section.path}
                  className={({ isActive }) =>
                    isActive ? 'console-nav__link console-nav__link--active' : 'console-nav__link'
                  }
                >
                  {section.label.ar}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Divider spacing="sm" />

        <div className="console-shell__account">
          <Avatar name={user?.firstName ?? '—'} src={user?.avatarUrl} size="sm" shape="rounded" />
          <div className="console-shell__account-meta">
            <span>{user === null ? '' : `${user.firstName} ${user.lastName}`}</span>
            <span>{user?.email ?? user?.phone}</span>
          </div>
        </div>

        <a
          className="console-button console-shell__storefront"
          href={runtimeConfig.storefrontUrl}
          target="_blank"
          rel="noreferrer"
        >
          فتح المتجر
        </a>

        <button type="button" className="console-button" onClick={() => void signOut()}>
          تسجيل الخروج
        </button>
      </aside>

      <div className="console-shell__main">
        <header className="console-shell__header">
          <h1 className="console-shell__title">{title}</h1>
          {actions !== undefined && <div className="console-shell__actions">{actions}</div>}
        </header>
        <main className="console-shell__content">{children}</main>
      </div>
    </div>
  );
}
