/**
 * Shared React utilities for the design system.
 */

import type { CSSProperties, ReactNode } from 'react';

export type Direction = 'rtl' | 'ltr';

export interface WithDirection {
  /** Document direction applied to the subtree. Defaults to `rtl`. */
  readonly dir?: Direction;
}

/**
 * Builds inline style objects from token maps without leaving stray
 * `undefined` keys, so React does not emit empty declarations.
 */
export function cx(...values: ReadonlyArray<string | false | null | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}

export function style(
  ...values: ReadonlyArray<CSSProperties | false | null | undefined>
): CSSProperties {
  const merged: Record<string, string | number> = {};

  for (const value of values) {
    if (!value) {
      continue;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        merged[key] = entry as string | number;
      }
    }
  }

  return merged as CSSProperties;
}

export interface PolymorphicProps {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly id?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly 'aria-describedby'?: string;
}

export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export type SurfaceTone = 'default' | 'raised' | 'sunken' | 'glass';
