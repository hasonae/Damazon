import type { CSSProperties, ReactNode } from 'react';
import { cx, type Direction } from '../core/primitives.js';

export interface BentoGridProps {
  readonly children: ReactNode;
  /** Responsive column count. `md` applies from the 768px breakpoint upward. */
  readonly columns?: 2 | 3 | 4;
  readonly gap?: 'sm' | 'md' | 'lg';
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly dir?: Direction;
}

/**
 * BentoGrid lays out bento cells on a responsive grid. On narrow screens every
 * cell spans the full width; the column count applies from the `md`
 * breakpoint so that the consumer layout collapses to a single column on
 * phones.
 */
export function BentoGrid({
  children,
  columns = 4,
  gap = 'md',
  className,
  style: styleOverride,
  dir = 'rtl',
}: BentoGridProps): JSX.Element {
  return (
    <div
      dir={dir}
      className={cx(
        'dz-bento-grid',
        `dz-bento-grid--cols-${columns}`,
        `dz-bento-grid--gap-${gap}`,
        className,
      )}
      style={styleOverride}
    >
      {children}
    </div>
  );
}

export interface BentoSpanProps {
  /** Column span at the md breakpoint and above. */
  readonly columns?: 1 | 2 | 3 | 4;
  /** Row span at the md breakpoint and above. */
  readonly rows?: 1 | 2 | 3;
}

/**
 * BentoCard is a bento cell. The span props only take effect once the grid is
 * wide enough, which keeps a single-column phone layout free of empty gaps.
 */
export interface BentoCardProps extends BentoSpanProps {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly surface?: 'glass' | 'solid' | 'gradient' | 'image';
  readonly interactive?: boolean;
  readonly radius?: 'lg' | 'xl' | '2xl' | '3xl';
  readonly padding?: 'none' | 'sm' | 'md' | 'lg';
  readonly as?: 'div' | 'article' | 'section' | 'li';
}

export function BentoCard({
  children,
  columns = 1,
  rows = 1,
  className,
  style: styleOverride,
  surface = 'glass',
  interactive = false,
  radius = 'xl',
  padding = 'md',
  as: Element = 'div',
}: BentoCardProps): JSX.Element {
  return (
    <Element
      className={cx(
        'dz-bento-card',
        `dz-bento-card--surface-${surface}`,
        `dz-bento-card--pad-${padding}`,
        interactive && 'dz-bento-card--interactive',
        className,
      )}
      style={
        {
          '--dz-bento-cols': columns,
          '--dz-bento-rows': rows,
          '--dz-radius': `var(--dz-radius-${radius})`,
          ...(styleOverride ?? {}),
        } as CSSProperties
      }
    >
      {children}
    </Element>
  );
}

export interface BentoHeroProps {
  readonly children: ReactNode;
  readonly mediaUrl?: string;
  readonly mediaAlt?: string;
  readonly overlayStrength?: 'light' | 'medium' | 'strong';
  readonly align?: 'start' | 'center' | 'end';
  readonly minHeight?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

/**
 * BentoHero is the full-width lead cell. Text sits over media with a gradient
 * scrim so that contrast holds regardless of the photograph.
 */
export function BentoHero({
  children,
  mediaUrl,
  mediaAlt = '',
  overlayStrength = 'medium',
  align = 'start',
  minHeight = 'md',
  className,
}: BentoHeroProps): JSX.Element {
  return (
    <section
      className={cx(
        'dz-bento-hero',
        `dz-bento-hero--${overlayStrength}`,
        `dz-bento-hero--min-${minHeight}`,
        className,
      )}
    >
      {mediaUrl !== undefined && (
        <img
          className="dz-bento-hero__media"
          src={mediaUrl}
          alt={mediaAlt}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="dz-bento-hero__scrim" aria-hidden="true" />
      <div className={cx('dz-bento-hero__content', `dz-bento-hero__content--${align}`)}>
        {children}
      </div>
    </section>
  );
}

export interface BentoSectionProps {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly columns?: 2 | 3 | 4;
  readonly gap?: 'sm' | 'md' | 'lg';
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
  readonly dir?: Direction;
}

/**
 * BentoSection is a titled region containing a BentoGrid. Headings are emitted
 * at a caller-chosen level so a page keeps a single coherent outline.
 */
export function BentoSection({
  title,
  description,
  action,
  children,
  columns = 4,
  gap = 'md',
  headingLevel = 2,
  className,
  dir = 'rtl',
}: BentoSectionProps): JSX.Element {
  const Heading = `h${headingLevel}` as 'h2' | 'h3';

  return (
    <section dir={dir} className={cx('dz-bento-section', className)}>
      {(title !== undefined || action !== undefined) && (
        <header className="dz-bento-section__header">
          <div className="dz-bento-section__heading">
            {title !== undefined && <Heading className="dz-bento-section__title">{title}</Heading>}
            {description !== undefined && (
              <p className="dz-bento-section__description">{description}</p>
            )}
          </div>
          {action !== undefined && <div className="dz-bento-section__action">{action}</div>}
        </header>
      )}
      <BentoGrid columns={columns} gap={gap} dir={dir}>
        {children}
      </BentoGrid>
    </section>
  );
}

export interface BentoContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly dir?: Direction;
  readonly width?: 'reading' | 'content' | 'full';
}

/**
 * BentoContainer is the page-width wrapper. It applies the reading and content
 * maximum widths from the layout tokens so that long-form pages and dashboards
 * share one horizontal rhythm.
 */
export function BentoContainer({
  children,
  className,
  style: styleOverride,
  dir = 'rtl',
  width = 'content',
}: BentoContainerProps): JSX.Element {
  return (
    <div
      dir={dir}
      className={cx('dz-bento-container', `dz-bento-container--${width}`, className)}
      style={styleOverride}
    >
      {children}
    </div>
  );
}
