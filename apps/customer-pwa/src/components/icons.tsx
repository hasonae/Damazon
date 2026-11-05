/**
 * Inline icon set.
 *
 * The project carries no icon dependency, so the handful of glyphs the shell
 * needs live here: one 24×24 stroke style, `currentColor` throughout, and
 * `aria-hidden` by default so assistive technology reads the label on the
 * control instead of the shape.
 */

import type { ReactNode, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { readonly size?: number };

function Svg({ size = 22, children, ...rest }: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </Svg>
  );
}

export function CartIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3 4h2l2.6 12.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L21 8H6" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
    </Svg>
  );
}

export function ReceiptIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6" />
    </Svg>
  );
}

export function HeartIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z" />
    </Svg>
  );
}

export function HeartFilledIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props} fill="currentColor">
      <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z" />
    </Svg>
  );
}

export function UserIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </Svg>
  );
}

export function PinIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </Svg>
  );
}

export type CategoryIconKind =
  | 'restaurant'
  | 'shopping'
  | 'pharmacy'
  | 'bakery'
  | 'electronics'
  | 'home'
  | 'fashion'
  | 'services';

export function CategoryIcon({
  kind,
  ...props
}: IconProps & { readonly kind: CategoryIconKind }): JSX.Element {
  return (
    <Svg {...props} size={props.size ?? 24} strokeWidth={1.7}>
      {kind === 'restaurant' && (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="4.5" />
          <path d="M3 4v5M5 4v5M7 4v5M5 9v11M19 4v16M19 4c-2 2-2 5 0 7" />
        </>
      )}
      {kind === 'shopping' && (
        <>
          <path d="M5 8h14l1 12H4L5 8Z" />
          <path d="M9 9V6a3 3 0 0 1 6 0v3M8 13h8" />
        </>
      )}
      {kind === 'pharmacy' && (
        <>
          <path d="M5 3h14v18H5z" />
          <path d="M12 7v10M7 12h10" />
        </>
      )}
      {kind === 'bakery' && (
        <>
          <path d="M4 13a8 8 0 0 1 16 0v6H4v-6Z" />
          <path d="M9 8c1 1 1 2 0 3M14 7c1 1 1 2 0 3M4 15h16" />
        </>
      )}
      {kind === 'electronics' && (
        <>
          <rect x="6" y="2.5" width="12" height="19" rx="2" />
          <path d="M10 18h4" />
        </>
      )}
      {kind === 'home' && (
        <>
          <path d="m3 11 9-8 9 8M5.5 9.5V21h13V9.5M9.5 21v-7h5v7" />
        </>
      )}
      {kind === 'fashion' && (
        <>
          <path d="m12 4 7 5-7 4-7-4 7-5Z" />
          <path d="M5 9v2c0 5 14 5 14 0V9M4 20h16" />
        </>
      )}
      {kind === 'services' && (
        <>
          <path d="M4 8h16l1 12H3L4 8Z" />
          <path d="M9 8a3 3 0 0 1 6 0M8 13h8" />
        </>
      )}
    </Svg>
  );
}

export function ChevronStartIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="m14 6-6 6 6 6" />
    </Svg>
  );
}

export function ChevronEndIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="m10 6 6 6-6 6" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function MinusIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" />
    </Svg>
  );
}

export function StarIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z" />
    </Svg>
  );
}

export function StarFilledIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}
