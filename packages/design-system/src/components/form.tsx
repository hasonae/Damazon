import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx, type Tone } from '../core/primitives.js';

export interface FieldShellProps {
  readonly label: ReactNode;
  readonly htmlFor: string;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * FieldShell wires a label, hint, and error message to a control. Errors are
 * announced through `aria-describedby`, and the control is marked invalid, so
 * assistive technology reports the same information a sighted user sees.
 */
export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className,
}: FieldShellProps): JSX.Element {
  return (
    <div className={cx('dz-field', error !== undefined && 'dz-field--invalid', className)}>
      <label className="dz-field__label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="dz-field__required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint !== undefined && (
        <p className="dz-field__hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="dz-field__error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly leadingIcon?: ReactNode;
  readonly trailingAddon?: ReactNode;
  readonly fieldSize?: 'sm' | 'md' | 'lg';
  readonly containerClassName?: string;
}

/**
 * TextField is the base text control. Its value, name, and type are always
 * supplied by the caller so that no control in either application invents its
 * own identity.
 */
export function TextField({
  label,
  hint,
  error,
  leadingIcon,
  trailingAddon,
  fieldSize = 'md',
  containerClassName,
  className,
  id,
  required,
  ...rest
}: TextFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <div className={cx('dz-input-wrap', `dz-input-wrap--${fieldSize}`)}>
        {leadingIcon !== undefined && (
          <span className="dz-input-wrap__leading" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          {...rest}
          id={fieldId}
          required={required}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={cx(
            hint !== undefined && `${fieldId}-hint`,
            error !== undefined && `${fieldId}-error`,
          )}
          className={cx('dz-input', className)}
        />
        {trailingAddon !== undefined && (
          <span className="dz-input-wrap__trailing">{trailingAddon}</span>
        )}
      </div>
    </FieldShell>
  );
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly containerClassName?: string;
}

export function TextAreaField({
  label,
  hint,
  error,
  containerClassName,
  className,
  id,
  required,
  rows = 4,
  ...rest
}: TextAreaFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <textarea
        {...rest}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={cx(
          hint !== undefined && `${fieldId}-hint`,
          error !== undefined && `${fieldId}-error`,
        )}
        className={cx('dz-textarea', className)}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  readonly label: ReactNode;
  readonly options: ReadonlyArray<SelectOption>;
  readonly placeholder?: string;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly fieldSize?: 'sm' | 'md' | 'lg';
  readonly containerClassName?: string;
}

export function SelectField({
  label,
  options,
  placeholder,
  hint,
  error,
  fieldSize = 'md',
  containerClassName,
  className,
  id,
  required,
  ...rest
}: SelectFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <select
        {...rest}
        id={fieldId}
        required={required}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={cx(
          hint !== undefined && `${fieldId}-hint`,
          error !== undefined && `${fieldId}-error`,
        )}
        className={cx('dz-select', `dz-select--${fieldSize}`, className)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly tone?: Tone;
}

export function Checkbox({
  label,
  description,
  className,
  id,
  ...rest
}: CheckboxProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={cx('dz-checkbox', className)}>
      <input {...rest} type="checkbox" id={fieldId} className="dz-checkbox__input" />
      <label className="dz-checkbox__label" htmlFor={fieldId}>
        <span className="dz-checkbox__box" aria-hidden="true" />
        <span className="dz-checkbox__text">
          <span>{label}</span>
          {description !== undefined && (
            <span className="dz-checkbox__description">{description}</span>
          )}
        </span>
      </label>
    </div>
  );
}
