/**
 * Typography scale for the Damazon design system.
 *
 * The Arabic-first interface uses Noto Kufi Arabic as the display face and Noto
 * Sans Arabic as the body face, with Latin fallbacks so that mixed Arabic/Latin
 * text in the same string stays on a compatible baseline. Money is always
 * rendered with Latin digits regardless of locale, so `tabularFigures` is the
 * default for numeric styles.
 */

export const fontFamily = {
  display: "'Noto Kufi Arabic', 'Segoe UI', system-ui, sans-serif",
  body: "'Noto Sans Arabic', 'Segoe UI', system-ui, sans-serif",
  latin: "'Inter', 'Segoe UI', system-ui, sans-serif",
  numeric: "'Inter', 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Cascadia Mono', Consolas, monospace",
} as const;

export const fontSize = {
  '3xs': '0.625rem',
  '2xs': '0.6875rem',
  xs: '0.75rem',
  sm: '0.8125rem',
  base: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.375rem',
  '2xl': '1.75rem',
  '3xl': '2.25rem',
  '4xl': '3rem',
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
} as const;

export const lineHeight = {
  tight: 1.15,
  snug: 1.35,
  normal: 1.6,
  relaxed: 1.8,
} as const;

export const letterSpacing = {
  tightest: '-0.03em',
  tight: '-0.015em',
  normal: '0',
  wide: '0.01em',
  widest: '0.04em',
} as const;

export type TypeStyleName =
  | 'display-lg'
  | 'display-md'
  | 'heading-lg'
  | 'heading-md'
  | 'heading-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'label-lg'
  | 'label-md'
  | 'label-sm'
  | 'money-lg'
  | 'money-md'
  | 'money-sm'
  | 'code';

export interface TypeStyle {
  readonly family: string;
  readonly size: string;
  readonly weight: number;
  readonly lineHeight: number;
  readonly letterSpacing: string;
  readonly fontVariantNumeric: 'normal' | 'tabular-nums';
}

export const typeStyles: Readonly<Record<TypeStyleName, TypeStyle>> = {
  'display-lg': {
    family: fontFamily.display,
    size: fontSize['3xl'],
    weight: fontWeight.heavy,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tightest,
    fontVariantNumeric: 'normal',
  },
  'display-md': {
    family: fontFamily.display,
    size: fontSize['2xl'],
    weight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    fontVariantNumeric: 'normal',
  },
  'heading-lg': {
    family: fontFamily.display,
    size: fontSize.xl,
    weight: fontWeight.bold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.tight,
    fontVariantNumeric: 'normal',
  },
  'heading-md': {
    family: fontFamily.display,
    size: fontSize.lg,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'normal',
  },
  'heading-sm': {
    family: fontFamily.body,
    size: fontSize.md,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'normal',
  },
  'body-lg': {
    family: fontFamily.body,
    size: fontSize.md,
    weight: fontWeight.regular,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'normal',
  },
  'body-md': {
    family: fontFamily.body,
    size: fontSize.base,
    weight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'normal',
  },
  'body-sm': {
    family: fontFamily.body,
    size: fontSize.sm,
    weight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'normal',
  },
  'label-lg': {
    family: fontFamily.body,
    size: fontSize.base,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.wide,
    fontVariantNumeric: 'normal',
  },
  'label-md': {
    family: fontFamily.body,
    size: fontSize.sm,
    weight: fontWeight.medium,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.wide,
    fontVariantNumeric: 'normal',
  },
  'label-sm': {
    family: fontFamily.body,
    size: fontSize.xs,
    weight: fontWeight.medium,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.widest,
    fontVariantNumeric: 'normal',
  },
  'money-lg': {
    family: fontFamily.numeric,
    size: fontSize.xl,
    weight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    fontVariantNumeric: 'tabular-nums',
  },
  'money-md': {
    family: fontFamily.numeric,
    size: fontSize.md,
    weight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'tabular-nums',
  },
  'money-sm': {
    family: fontFamily.numeric,
    size: fontSize.base,
    weight: fontWeight.medium,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'tabular-nums',
  },
  code: {
    family: fontFamily.mono,
    size: fontSize.sm,
    weight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontVariantNumeric: 'tabular-nums',
  },
};
