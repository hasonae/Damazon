/**
 * Serialises the token maps into CSS custom properties.
 *
 * Each application writes the result into a `:root`-scoped block, which is how
 * the admin console overrides the consumer palette: both reference the same
 * variable names, and only the values differ.
 */

import {
  consumerPalette,
  professionalPalette,
  semanticColors,
  type PaletteName,
} from './colors.js';
import {
  borderWidth,
  breakpoints,
  elevation,
  glassBlur,
  glassTransparency,
  layoutMetrics,
  motionDuration,
  motionEasing,
  radius,
  spacing,
} from './layout.js';
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  typeStyles,
  type TypeStyleName,
} from './typography.js';

const normaliseSegment = (segment: string): string =>
  segment
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    // Fractional scale keys (`0.5`) are not valid inside a custom property
    // name, so the dot becomes a hyphen: `0.5` → `0-5`.
    .replace(/\./g, '-')
    // Numeric scale keys such as `50` or `2xs` must not produce a second hyphen
    // once joined, so any leading hyphen is dropped here.
    .replace(/^-+/, '');

function toCustomProperty(prefix: string, path: readonly string[]): string {
  // Token prefixes are written with a trailing hyphen in the token maps
  // (`space-`, `color-primary-`, …); strip it before joining so the emitted
  // name uses single hyphens only: `--dz-space-4`, not `--dz-space--4`.
  return ['--dz', prefix.replace(/-+$/, ''), ...path.map(normaliseSegment)].join('-');
}

function appendRecord(
  lines: string[],
  prefix: string,
  record: Readonly<Record<string, unknown>>,
  path: readonly string[] = [],
): void {
  for (const [key, value] of Object.entries(record)) {
    const nextPath = [...path, key];

    if (typeof value === 'object' && value !== null) {
      appendRecord(lines, prefix, value as Readonly<Record<string, unknown>>, nextPath);
    } else if (typeof value === 'string' || typeof value === 'number') {
      lines.push(`  ${toCustomProperty(prefix, nextPath)}: ${String(value)};`);
    }
  }
}

/**
 * Returns the design tokens as `property: value` lines, without a selector
 * wrapper. The caller decides the scope.
 */
export function tokenCustomProperties(palette: PaletteName = 'consumer'): string[] {
  const colors = palette === 'professional' ? professionalPalette : consumerPalette;
  const lines: string[] = [];

  lines.push('  color-scheme: light;');
  appendRecord(lines, 'color-primary-', colors.primary);
  appendRecord(lines, 'color-accent-', colors.accent);
  appendRecord(lines, 'color-surface-', colors.surface);
  appendRecord(lines, 'color-ink-', colors.ink);
  appendRecord(lines, 'color-semantic-', semanticColors);
  appendRecord(lines, 'space-', spacing);
  appendRecord(lines, 'radius-', radius);
  appendRecord(lines, 'border-', borderWidth);
  appendRecord(lines, 'blur-', glassBlur);
  appendRecord(lines, 'elevation-', elevation);
  appendRecord(lines, 'duration-', motionDuration);
  appendRecord(lines, 'easing-', motionEasing);
  appendRecord(lines, 'font-family-', fontFamily);
  appendRecord(lines, 'font-size-', fontSize);
  appendRecord(lines, 'font-weight-', fontWeight);
  appendRecord(lines, 'line-height-', lineHeight);
  appendRecord(lines, 'tracking-', letterSpacing);
  appendRecord(lines, 'metric-', layoutMetrics);
  appendRecord(lines, 'breakpoint-', breakpoints);

  for (const [name, tokens] of Object.entries(typeStyles) as Array<
    [TypeStyleName, (typeof typeStyles)[TypeStyleName]]
  >) {
    lines.push(
      `  ${toCustomProperty('type', [name])}: ${tokens.weight} ${tokens.size}/${tokens.lineHeight} ${tokens.family};`,
    );
  }

  for (const [name, value] of Object.entries(glassTransparency)) {
    lines.push(`  ${toCustomProperty('glass-alpha', [name])}: ${String(value)};`);
  }

  if (palette === 'professional') {
    lines.push('  --dz-motion-scale: 0;');
  } else {
    lines.push('  --dz-motion-scale: 1;');
  }

  return lines;
}

/** Returns the complete stylesheet text for the given palette. */
export function formatDesignTokens(palette: PaletteName = 'consumer'): string {
  const selector = palette === 'professional' ? '[data-dz-theme="professional"]' : ':root';
  return [`${selector} {`, ...tokenCustomProperties(palette), '}', ''].join('\n');
}
