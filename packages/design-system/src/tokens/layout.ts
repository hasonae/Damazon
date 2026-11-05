/**
 * Spacing, radius, elevation, and motion tokens.
 *
 * The scale is a 4px base with half-steps for optical adjustment inside dense
 * administrative tables. The consumer application enables motion through the
 * `motion` tokens; the administrative console sets `MOTION_DURATION_SCALE` to 0
 * so that nothing animates (ADR-0008).
 */

export const spacing = {
  '0': '0',
  px: '1px',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '1.5': '0.375rem',
  '2': '0.5rem',
  '2.5': '0.625rem',
  '3': '0.75rem',
  '3.5': '0.875rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
  '12': '3rem',
  '14': '3.5rem',
  '16': '4rem',
  '20': '5rem',
  '24': '6rem',
} as const;

export const radius = {
  none: '0',
  xs: '0.25rem',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  full: '9999px',
} as const;

export const borderWidth = {
  hairline: '1px',
  thin: '1.5px',
  thick: '2px',
} as const;

/** Glass surfaces need a light border that reads against a blurred backdrop. */
export const glassBlur = {
  subtle: 'blur(8px) saturate(120%)',
  medium: 'blur(18px) saturate(135%)',
  strong: 'blur(32px) saturate(150%)',
} as const;

export const glassTransparency = {
  faint: 0.12,
  light: 0.2,
  medium: 0.32,
  heavy: 0.46,
} as const;

export const elevation = {
  none: 'none',
  low: '0 1px 2px rgba(7, 40, 42, 0.06), 0 1px 1px rgba(7, 40, 42, 0.04)',
  medium: '0 6px 16px rgba(7, 40, 42, 0.1), 0 2px 4px rgba(7, 40, 42, 0.06)',
  high: '0 16px 32px rgba(7, 40, 42, 0.14), 0 4px 8px rgba(7, 40, 42, 0.08)',
  overlay: '0 24px 48px rgba(7, 40, 42, 0.22), 0 8px 16px rgba(7, 40, 42, 0.1)',
} as const;

export const motionDuration = {
  instant: 0,
  fast: 120,
  base: 200,
  slow: 320,
  deliberate: 480,
} as const;

export const motionEasing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const breakpoints = {
  xs: 360,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointName = keyof typeof breakpoints;

export const layoutMetrics = {
  headerHeight: '3.5rem',
  tabBarHeight: '4rem',
  sidebarWidth: '15rem',
  sidebarCollapsedWidth: '4rem',
  contentMaxWidth: '80rem',
  readingMaxWidth: '45rem',
  touchTargetMin: '2.75rem',
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
