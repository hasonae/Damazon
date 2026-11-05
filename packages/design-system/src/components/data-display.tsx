import type { ReactNode } from 'react';
import { cx } from '../core/primitives.js';

export interface DataTableColumn<TRow> {
  /** Stable key, also used as the accessible header association. */
  readonly key: string;
  readonly header: ReactNode;
  readonly cell: (row: TRow) => ReactNode;
  readonly width?: string;
  readonly align?: 'start' | 'center' | 'end';
  /** Columns marked `numeric` align to the end and use tabular figures. */
  readonly numeric?: boolean;
}

export interface DataTableProps<TRow> {
  readonly caption: ReactNode;
  readonly columns: ReadonlyArray<DataTableColumn<TRow>>;
  readonly rows: ReadonlyArray<TRow>;
  readonly rowKey: (row: TRow) => string;
  readonly onRowClick?: (row: TRow) => void;
  readonly emptyState?: ReactNode;
  readonly dense?: boolean;
  readonly stickyHeader?: boolean;
  readonly className?: string;
}

/**
 * DataTable is the administrative listing primitive. It renders a real table so
 * that column association, header semantics, and keyboard navigation come from
 * the platform rather than from a grid of divs.
 *
 * The administrative console is animation-free, so rows do not transition; the
 * hover affordance is an instant background change instead.
 */
export function DataTable<TRow>({
  caption,
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyState,
  dense = false,
  stickyHeader = false,
  className,
}: DataTableProps<TRow>): JSX.Element {
  if (rows.length === 0 && emptyState !== undefined) {
    return <div className="dz-table-empty">{emptyState}</div>;
  }

  return (
    <div className={cx('dz-table-scroll', stickyHeader && 'dz-table-scroll--sticky', className)}>
      <table className={cx('dz-table', dense && 'dz-table--dense')}>
        <caption className="dz-table__caption">{caption}</caption>
        <thead className="dz-table__head">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ inlineSize: column.width }}
                className={cx(
                  column.numeric === true && 'dz-table__cell--numeric',
                  column.align !== undefined && `dz-table__cell--${column.align}`,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cx(
                'dz-table__row',
                onRowClick !== undefined && 'dz-table__row--clickable',
              )}
              onClick={onRowClick === undefined ? undefined : () => onRowClick(row)}
              onKeyDown={
                onRowClick === undefined
                  ? undefined
                  : (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
              }
              tabIndex={onRowClick === undefined ? undefined : 0}
              role={onRowClick === undefined ? undefined : 'button'}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    column.numeric === true && 'dz-table__cell--numeric',
                    column.align !== undefined && `dz-table__cell--${column.align}`,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly onPageChange: (page: number) => void;
  readonly className?: string;
  readonly labels?: {
    readonly previous?: string;
    readonly next?: string;
    readonly summary?: (page: number, totalPages: number) => string;
  };
}

/**
 * Pagination renders the control for a server-paginated collection. It never
 * fetches: it only reports the requested page.
 */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className,
  labels,
}: PaginationProps): JSX.Element | null {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  if (totalPages <= 1) {
    return null;
  }

  const summary =
    labels?.summary ?? ((activePage: number, pages: number) => `صفحة ${activePage} من ${pages}`);

  return (
    <nav className={cx('dz-pagination', className)} aria-label="ترقيم الصفحات">
      <button
        type="button"
        className="dz-pagination__step"
        disabled={current <= 1}
        onClick={() => onPageChange(current - 1)}
      >
        {labels?.previous ?? 'السابق'}
      </button>
      <span className="dz-pagination__summary">{summary(current, totalPages)}</span>
      <button
        type="button"
        className="dz-pagination__step"
        disabled={current >= totalPages}
        onClick={() => onPageChange(current + 1)}
      >
        {labels?.next ?? 'التالي'}
      </button>
    </nav>
  );
}
