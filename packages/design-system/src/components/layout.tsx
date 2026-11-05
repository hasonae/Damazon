import type { ReactNode } from 'react';
import { cx, type Direction } from '../core/primitives.js';

export interface AppShellProps {
  readonly children: ReactNode;
  readonly header?: ReactNode;
  readonly sidebar?: ReactNode;
  readonly sidebarPosition?: 'inline-start' | 'inline-end';
  readonly dir?: Direction;
  readonly className?: string;
}

/**
 * AppShell provides the three-region layout both applications use: an optional
 * header, an optional navigation rail, and the content region. It sets the
 * document direction once, so no component below it has to reason about RTL.
 */
export function AppShell({
  children,
  header,
  sidebar,
  sidebarPosition = 'inline-start',
  dir = 'rtl',
  className,
}: AppShellProps): JSX.Element {
  return (
    <div dir={dir} className={cx('dz-shell', className)}>
      {header !== undefined && <div className="dz-shell__header">{header}</div>}
      <div className="dz-shell__body">
        {sidebar !== undefined && (
          <aside className={cx('dz-shell__sidebar', `dz-shell__sidebar--${sidebarPosition}`)}>
            {sidebar}
          </aside>
        )}
        <main className="dz-shell__content">{children}</main>
      </div>
    </div>
  );
}

export interface StackProps {
  readonly children: ReactNode;
  readonly direction?: 'block' | 'row' | 'column';
  readonly gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  readonly align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  readonly justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  readonly wrap?: boolean;
  readonly className?: string;
}

/**
 * Stack is the default way to space content. It maps to logical CSS properties
 * so the same declaration works in both directions without a `dir`-specific
 * override.
 */
export function Stack({
  children,
  direction = 'column',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className,
}: StackProps): JSX.Element {
  return (
    <div
      className={cx(
        'dz-stack',
        `dz-stack--${direction}`,
        `dz-stack--gap-${gap}`,
        `dz-stack--align-${align}`,
        `dz-stack--justify-${justify}`,
        wrap && 'dz-stack--wrap',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ClusterProps {
  readonly children: ReactNode;
  readonly gap?: 'xs' | 'sm' | 'md' | 'lg';
  readonly justify?: 'start' | 'center' | 'end' | 'between';
  readonly align?: 'start' | 'center' | 'end';
  readonly wrap?: boolean;
  readonly className?: string;
}

/** Cluster lays out inline items that wrap, for filter rows and toolbars. */
export function Cluster({
  children,
  gap = 'sm',
  justify = 'start',
  align = 'center',
  wrap = true,
  className,
}: ClusterProps): JSX.Element {
  return (
    <div
      className={cx(
        'dz-cluster',
        `dz-cluster--gap-${gap}`,
        `dz-cluster--justify-${justify}`,
        `dz-cluster--align-${align}`,
        wrap && 'dz-cluster--wrap',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface DividerProps {
  readonly orientation?: 'horizontal' | 'vertical';
  readonly spacing?: 'none' | 'sm' | 'md' | 'lg';
  readonly label?: ReactNode;
  readonly className?: string;
}

export function Divider({
  orientation = 'horizontal',
  spacing = 'md',
  label,
  className,
}: DividerProps): JSX.Element {
  if (label !== undefined) {
    return (
      <div
        className={cx('dz-divider dz-divider--labelled', `dz-divider--space-${spacing}`, className)}
        role="separator"
      >
        <span className="dz-divider__rule" aria-hidden="true" />
        <span className="dz-divider__label">{label}</span>
        <span className="dz-divider__rule" aria-hidden="true" />
      </div>
    );
  }

  return (
    <hr
      className={cx(
        'dz-divider',
        `dz-divider--${orientation}`,
        `dz-divider--space-${spacing}`,
        className,
      )}
    />
  );
}
