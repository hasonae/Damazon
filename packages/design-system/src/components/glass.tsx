import type { CSSProperties, ReactNode } from 'react';
import { cx, style, type Direction } from '../core/primitives.js';

export interface GlassSurfaceProps {
  readonly children: ReactNode;
  readonly dir?: Direction;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Blur strength applied to the frosted backdrop. */
  readonly blur?: 'subtle' | 'medium' | 'strong';
  /** Surface opacity. Higher values read as more opaque over the backdrop. */
  readonly transparency?: 'faint' | 'light' | 'medium' | 'heavy';
  readonly elevation?: 'low' | 'medium' | 'high' | 'overlay';
  readonly radius?: 'none' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  readonly as?: 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'li';
  readonly id?: string;
}

/**
 * GlassContainer is the base frosted surface. Every other glass component
 * composes it so that blur, transparency, border, and elevation stay consistent
 * across the consumer application.
 */
export function GlassContainer({
  children,
  dir = 'rtl',
  className,
  style: styleOverride,
  blur = 'medium',
  transparency = 'light',
  elevation = 'medium',
  radius = 'xl',
  as: Element = 'div',
  id,
}: GlassSurfaceProps): JSX.Element {
  return (
    <Element
      id={id}
      dir={dir}
      className={cx(
        'dz-glass',
        `dz-glass--blur-${blur}`,
        `dz-glass--fill-${transparency}`,
        `dz-glass--radius-${radius}`,
        className,
      )}
      style={style(
        {
          '--dz-elevation': `var(--dz-elevation-${elevation})`,
          '--dz-radius': `var(--dz-radius-${radius})`,
        } as CSSProperties,
        styleOverride,
      )}
    >
      {children}
    </Element>
  );
}

export interface GlassCardProps extends Omit<GlassSurfaceProps, 'as'> {
  readonly as?: 'div' | 'article' | 'li';
  readonly interactive?: boolean;
  readonly padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * GlassCard is the standard content card in the consumer application. With
 * `interactive` it adds the hover lift and press states used by tappable
 * catalogue cards.
 */
export function GlassCard({
  children,
  dir = 'rtl',
  className,
  style: styleOverride,
  blur = 'medium',
  transparency = 'light',
  elevation = 'medium',
  radius = 'xl',
  as = 'div',
  interactive = false,
  padding = 'md',
  id,
}: GlassCardProps): JSX.Element {
  return (
    <GlassContainer
      as={as}
      id={id}
      dir={dir}
      blur={blur}
      transparency={transparency}
      elevation={elevation}
      radius={radius}
      className={cx(
        'dz-glass-card',
        `dz-glass-card--pad-${padding}`,
        interactive && 'dz-glass-card--interactive',
        className,
      )}
      style={styleOverride}
    >
      {children}
    </GlassContainer>
  );
}

export interface GlassPanelProps extends Omit<GlassSurfaceProps, 'as'> {
  readonly title?: ReactNode;
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
  readonly padded?: boolean;
}

/**
 * GlassPanel groups related content under a heading. It is the shell for filter
 * drawers and detail panes in the consumer application.
 */
export function GlassPanel({
  children,
  title,
  actions,
  footer,
  padded = true,
  className,
  style: styleOverride,
  blur = 'strong',
  transparency = 'medium',
  elevation = 'high',
  radius = '2xl',
  dir = 'rtl',
  id,
}: GlassPanelProps): JSX.Element {
  return (
    <GlassContainer
      id={id}
      dir={dir}
      blur={blur}
      transparency={transparency}
      elevation={elevation}
      radius={radius}
      className={cx('dz-glass-panel', padded && 'dz-glass-panel--padded', className)}
      style={styleOverride}
    >
      {(title !== undefined || actions !== undefined) && (
        <header className="dz-glass-panel__header">
          {title !== undefined && <h2 className="dz-glass-panel__title">{title}</h2>}
          {actions !== undefined && <div className="dz-glass-panel__actions">{actions}</div>}
        </header>
      )}
      <div className="dz-glass-panel__body">{children}</div>
      {footer !== undefined && <footer className="dz-glass-panel__footer">{footer}</footer>}
    </GlassContainer>
  );
}

export interface GlassModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly closeLabel?: string;
  readonly className?: string;
}

/**
 * GlassModal renders through a portal-free fixed overlay. It closes on Escape
 * and on backdrop press, and it marks the page behind it as inert with
 * `aria-modal`.
 */
export function GlassModal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeLabel = 'إغلاق',
  className,
}: GlassModalProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="dz-modal-root" role="presentation">
      <button
        type="button"
        className="dz-modal__backdrop"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx('dz-modal', `dz-modal--${size}`, className)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose();
          }
        }}
      >
        <GlassContainer
          blur="strong"
          transparency="medium"
          elevation="overlay"
          radius="2xl"
          className="dz-modal__surface"
        >
          <header className="dz-modal__header">
            {title !== undefined && <h2 className="dz-modal__title">{title}</h2>}
            <button
              type="button"
              className="dz-modal__close"
              onClick={onClose}
              aria-label={closeLabel}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="dz-modal__body">{children}</div>
          {footer !== undefined && <footer className="dz-modal__footer">{footer}</footer>}
        </GlassContainer>
      </div>
    </div>
  );
}

export interface GlassBottomSheetProps extends Omit<GlassModalProps, 'size'> {
  readonly snapPoints?: ReadonlyArray<'peek' | 'half' | 'full'>;
}

/**
 * GlassBottomSheet is the mobile presentation of the same content a modal shows
 * on larger screens. It is anchored to the bottom edge and respects safe-area
 * insets.
 */
export function GlassBottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  snapPoints = ['peek', 'half'],
  closeLabel = 'إغلاق',
  className,
}: GlassBottomSheetProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  const tallest = snapPoints.includes('full')
    ? 'full'
    : snapPoints.includes('half')
      ? 'half'
      : 'peek';

  return (
    <div className="dz-sheet-root" role="presentation">
      <button
        type="button"
        className="dz-modal__backdrop"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        className={cx('dz-sheet', `dz-sheet--${tallest}`, className)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose();
          }
        }}
      >
        <span className="dz-sheet__grabber" aria-hidden="true" />
        {title !== undefined && <h2 className="dz-sheet__title">{title}</h2>}
        <div className="dz-sheet__body">{children}</div>
        {footer !== undefined && <footer className="dz-sheet__footer">{footer}</footer>}
      </section>
    </div>
  );
}

export interface GlassNavigationProps {
  readonly children: ReactNode;
  readonly brand?: ReactNode;
  readonly actions?: ReactNode;
  readonly sticky?: boolean;
  readonly variant?: 'floating' | 'solid';
  readonly className?: string;
}

/**
 * GlassNavigation is the consumer application's top bar. It floats over content
 * by default, so pages must reserve top padding equal to the bar height.
 */
export function GlassNavigation({
  children,
  brand,
  actions,
  sticky = true,
  variant = 'floating',
  className,
}: GlassNavigationProps): JSX.Element {
  return (
    <header
      className={cx(
        'dz-glass-nav',
        sticky && 'dz-glass-nav--sticky',
        `dz-glass-nav--${variant}`,
        className,
      )}
    >
      <div className="dz-glass-nav__inner">
        {brand !== undefined && <div className="dz-glass-nav__brand">{brand}</div>}
        <div className="dz-glass-nav__links">{children}</div>
        {actions !== undefined && <div className="dz-glass-nav__actions">{actions}</div>}
      </div>
    </header>
  );
}
