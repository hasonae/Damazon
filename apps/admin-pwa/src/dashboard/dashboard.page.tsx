import { Badge, DataTable, EmptyState, type DataTableColumn } from '@damazon/design-system';
import { useState } from 'react';

import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';

import { useDashboardMetrics } from './dashboard-metrics.js';

interface OrderRow {
  readonly id: string;
  readonly business: string;
  readonly city: string;
  readonly status: string;
  readonly totalMinorUnits: string;
  readonly currency: string;
}

const COLUMNS: ReadonlyArray<DataTableColumn<OrderRow>> = [
  { key: 'id', header: 'رقم الطلب', cell: (row) => <span className="dz-numeric">{row.id}</span> },
  { key: 'business', header: 'التاجر', cell: (row) => row.business },
  { key: 'city', header: 'المدينة', cell: (row) => row.city },
  {
    key: 'status',
    header: 'الحالة',
    cell: (row) => (
      <Badge tone={row.status === 'DELIVERED' ? 'success' : 'warning'}>{row.status}</Badge>
    ),
  },
  {
    key: 'total',
    header: 'الإجمالي',
    cell: (row) => (
      <span className="dz-money">
        {row.totalMinorUnits} {row.currency}
      </span>
    ),
    numeric: true,
    align: 'end',
  },
];

/**
 * Landing screen for the console: operational metrics across the permitted
 * sections, followed by the most recent orders.
 */
export default function DashboardPage(): JSX.Element {
  const { user, departments } = useConsoleSession();
  const { metrics, recentOrders, isLoading, error } = useDashboardMetrics();
  const [selected, setSelected] = useState<OrderRow | null>(null);

  return (
    <ConsoleShell
      title="لوحة المؤشرات"
      actions={<Badge tone="primary">{departments.join('، ')}</Badge>}
    >
      <section className="console-metric-grid">
        {metrics.map((metric) => (
          <article key={metric.key} className="console-metric">
            <p className="console-metric__label">{metric.label}</p>
            <p className="console-metric__value dz-money">{metric.value}</p>
            <p className="console-metric__label">{metric.caption}</p>
          </article>
        ))}
      </section>
      {error !== null && (
        <p role="alert" className="page__subtitle">
          {error}
        </p>
      )}

      <DataTable
        caption={`آخر الطلبات — ${user === null ? '' : user.firstName}`}
        columns={COLUMNS}
        rows={recentOrders}
        rowKey={(row) => row.id}
        dense
        stickyHeader
        onRowClick={setSelected}
        emptyState={
          isLoading ? (
            <p className="page__subtitle">جارٍ التحميل</p>
          ) : (
            <EmptyState title="لا توجد طلبات" />
          )
        }
      />

      {selected !== null && <p className="page__subtitle">تم اختيار الطلب {selected.id}</p>}
    </ConsoleShell>
  );
}
