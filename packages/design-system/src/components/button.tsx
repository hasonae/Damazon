import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx, type Tone } from '../core/primitives.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly tone?: Tone;
  /** Renders a spinner, disables the button, and keeps its width stable. */
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly fullWidth?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  readonly children?: ReactNode;
}

/**
 * Button is the single interactive control in the design system. Every pressable
 * action in both applications renders through it so that focus rings, disabled
 * treatment, and loading behaviour cannot diverge between screens.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  tone = 'primary',
  loading = false,
  loadingLabel,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const isDisabled = disabled === true || loading;

  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-live={loading ? 'polite' : undefined}
      className={cx(
        'dz-button',
        `dz-button--${variant}`,
        `dz-button--${size}`,
        `dz-button--tone-${tone}`,
        fullWidth && 'dz-button--full',
        loading && 'dz-button--loading',
        className,
      )}
    >
      {loading && <span className="dz-button__spinner" aria-hidden="true" />}
      {leadingIcon !== undefined && !loading && (
        <span className="dz-button__leading" aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      <span className="dz-button__label">
        {loading && loadingLabel !== undefined ? loadingLabel : children}
      </span>
      {trailingIcon !== undefined && !loading && (
        <span className="dz-button__trailing" aria-hidden="true">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}

export interface IconButtonProps extends Omit<
  ButtonProps,
  'children' | 'leadingIcon' | 'trailingIcon'
> {
  readonly label: string;
  readonly icon: ReactNode;
  readonly active?: boolean;
}

/**
 * IconButton is a square, icon-only control. `label` is required because the
 * icon carries no accessible text of its own.
 */
export function IconButton({
  label,
  icon,
  active = false,
  size = 'md',
  variant = 'ghost',
  className,
  ...rest
}: IconButtonProps): JSX.Element {
  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      className={cx('dz-icon-button', active && 'dz-icon-button--active', className)}
      aria-label={label}
    >
      <span aria-hidden="true">{icon}</span>
    </Button>
  );
}
