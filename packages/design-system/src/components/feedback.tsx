import type { ReactNode } from 'react';
import { cx, type Tone } from '../core/primitives.js';

export interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: Tone;
  readonly variant?: 'soft' | 'solid' | 'outline';
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/**
 * Badge labels a status. Tone carries the semantic colour; the variant controls
 * how much of it is filled, so a dense administrative table can use `outline`
 * without losing the semantic distinction.
 */
export function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  className,
}: BadgeProps): JSX.Element {
  return (
    <span
      className={cx(
        'dz-badge',
        `dz-badge--${variant}`,
        `dz-badge--tone-${tone}`,
        `dz-badge--${size}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface AvatarProps {
  readonly src?: string | null;
  readonly name: string;
  readonly size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  readonly shape?: 'circle' | 'rounded';
  readonly className?: string;
}

/**
 * Avatar falls back to the initials derived from `name`, so a missing
 * photograph never leaves a broken or empty frame.
 */
export function Avatar({
  src,
  name,
  size = 'md',
  shape = 'circle',
  className,
}: AvatarProps): JSX.Element {
  const initials = name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');

  if (src != null && src.length > 0) {
    return (
      <img
        className={cx('dz-avatar', `dz-avatar--${size}`, `dz-avatar--${shape}`, className)}
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className={cx(
        'dz-avatar',
        'dz-avatar--initials',
        `dz-avatar--${size}`,
        `dz-avatar--${shape}`,
        className,
      )}
      role="img"
      aria-label={name}
    >
      {initials}
    </span>
  );
}

export interface EmptyStateProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly icon?: ReactNode;
  readonly className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div className={cx('dz-empty-state', className)}>
      {icon !== undefined && (
        <span className="dz-empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="dz-empty-state__title">{title}</p>
      {description !== undefined && <p className="dz-empty-state__description">{description}</p>}
      {action !== undefined && <div className="dz-empty-state__action">{action}</div>}
    </div>
  );
}

export interface SpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly label?: string;
  readonly className?: string;
}

export function Spinner({
  size = 'md',
  label = 'جارٍ التحميل',
  className,
}: SpinnerProps): JSX.Element {
  return (
    <span
      className={cx('dz-spinner', `dz-spinner--${size}`, className)}
      role="status"
      aria-label={label}
    />
  );
}

export interface SkeletonProps {
  readonly width?: string;
  readonly height?: string;
  readonly radius?: 'sm' | 'md' | 'lg' | 'full';
  readonly className?: string;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  radius = 'md',
  className,
}: SkeletonProps): JSX.Element {
  return (
    <span
      className={cx('dz-skeleton', `dz-skeleton--${radius}`, className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export interface ProgressBarProps {
  /** Completion from 0 to 100. Values outside the range are clamped. */
  readonly value: number;
  readonly tone?: Tone;
  readonly label?: string;
  readonly showValue?: boolean;
  readonly className?: string;
}

export function ProgressBar({
  value,
  tone = 'primary',
  label,
  showValue = false,
  className,
}: ProgressBarProps): JSX.Element {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <div className={cx('dz-progress', className)}>
      {label !== undefined && <span className="dz-progress__label">{label}</span>}
      <div
        className="dz-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label}
      >
        <span
          className={cx('dz-progress__fill', `dz-progress__fill--tone-${tone}`)}
          style={{ inlineSize: `${clamped}%` }}
        />
      </div>
      {showValue && <span className="dz-progress__value">{clamped}%</span>}
    </div>
  );
}
