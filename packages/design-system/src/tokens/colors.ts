/**
 * Colour tokens for the Damazon design system.
 *
 * Both palettes are sampled from the Damazon logo (`Damazon logo.png`): the
 * rose-gold/copper ramp that draws the hanger, cart, and rails is the consumer
 * primary; warm ivory replaces the old aqua surfaces; the brown ink ramp comes
 * from the letter outlines; and the focus accent keeps the mosaic teal that
 * appears in the letterforms. The administrative console overrides these with
 * the `professional` palette: warm graphite with a copper accent — neutral,
 * high-contrast, and motion-free.
 *
 * Consumers must reference these through CSS custom properties (see
 * `styles/tokens.css`) or through the exported constants, never with literal
 * colour values in component styles.
 */

export const consumerPalette = {
  primary: {
    50: '#fcf6f1',
    100: '#f4e4d8',
    200: '#e8cdba',
    300: '#d4aa8e',
    400: '#c09078',
    500: '#a87860',
    600: '#8c5a3f',
    700: '#784830',
    800: '#5f3826',
    900: '#472a1c',
  },
  accent: {
    100: '#d3f4f3',
    200: '#a9e9e8',
    300: '#74dad9',
    400: '#43c4c4',
    500: '#1a8789',
    600: '#176c6e',
    700: '#14595b',
    800: '#134a4c',
    900: '#123f40',
  },
  surface: {
    lightest: '#ffffff',
    lighter: '#fdf9f5',
    light: '#f8f0e8',
    base: '#f1e3d6',
    dim: '#e2cdba',
  },
  ink: {
    strongest: '#2c1a10',
    strong: '#462a1a',
    base: '#5e3f2d',
    muted: '#8a6a55',
    faint: '#ab8f7b',
  },
} as const;

export const professionalPalette = {
  primary: {
    50: '#f7f6f5',
    100: '#edebe9',
    200: '#dcd8d4',
    300: '#b8b1aa',
    400: '#8d847b',
    500: '#635a51',
    600: '#453d35',
    700: '#342d27',
    800: '#27211c',
    900: '#1a1613',
  },
  accent: {
    100: '#f7ece4',
    200: '#ecd6c5',
    300: '#dcb69d',
    400: '#cc9878',
    500: '#bd7f5c',
    600: '#a5674a',
    700: '#86523b',
    800: '#6b412e',
    900: '#4f3022',
  },
  surface: {
    lightest: '#ffffff',
    lighter: '#faf9f8',
    light: '#f2f0ee',
    base: '#e8e5e2',
    dim: '#d2cdc8',
  },
  ink: {
    strongest: '#171310',
    strong: '#271f1a',
    base: '#3a2f27',
    muted: '#655849',
    faint: '#948878',
  },
} as const;

export const semanticColors = {
  success: { base: '#12764f', strong: '#0b5a3c', surface: '#e6f5ee' },
  warning: { base: '#8a5a00', strong: '#6b4600', surface: '#fdf3e2' },
  danger: { base: '#a3262b', strong: '#821c20', surface: '#fbeaea' },
  info: { base: '#1f5f9c', strong: '#174a7c', surface: '#e8f1f9' },
} as const;

export type PaletteName = 'consumer' | 'professional';

export function resolvePalette(
  name: PaletteName,
): typeof consumerPalette | typeof professionalPalette {
  return name === 'professional' ? professionalPalette : consumerPalette;
}
