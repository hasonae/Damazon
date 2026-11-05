import type { AdminOrder } from '@damazon/api-client';
import {
  Badge,
  DataTable,
  EmptyState,
  Pagination,
  Spinner,
  type DataTableColumn,
} from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';

import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';

/**
 * Order review screen.
 *
 * The table is a real `<table>` with header association, and rows are
 * focusable, because an operator works through this list for hours with a
 * keyboard. Status is shown with a semantic badge so a forced-transition control
 * cannot be misread as a normal one.
 */
export default function OrdersPage(): JSX.Element {
  const { can, client } = useConsoleSession();
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [orders, setOrders] = useState<readonly AdminOrder[]>([]);
  const [nextCursorByPage, setNextCursorByPage] = useState<
    Readonly<Record<number, string | undefined>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canReview = can('orders:update');
  const cursor = nextCursorByPage[page];

  const load = useCallback(async (): Promise<void> => {
    if (!can('orders:read')) {
      setError('صلاحية قراءة الطلبات غير متاحة لقسمك.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.admin.listOrders({
        limit: 25,
        ...(cursor === undefined ? {} : { cursor }),
      });
      setOrders(result.items);
      setTotalItems(result.meta.totalCount ?? 0);
      if (result.meta.nextCursor !== null) {
        setNextCursorByPage((previous) => ({
          ...previous,
          [page + 1]: result.meta.nextCursor ?? undefined,
        }));
      }
    } catch {
      setError('تعذّر تحميل الطلبات.');
    } finally {
      setIsLoading(false);
    }
  }, [can, client, cursor, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ReadonlyArray<DataTableColumn<AdminOrder>> = [
    {
      key: 'orderNumber',
      header: 'رقم الطلب',
      cell: (row) => <span className="dz-numeric">{row.orderNumber}</span>,
    },
    { key: 'business', header: 'التاجر', cell: (row) => row.business },
    { key: 'city', header: 'المدينة', cell: (row) => row.city },
    {
      key: 'status',
      header: 'الحالة',
      cell: (row) => (
        <Badge tone={row.status === 'delivered' ? 'success' : 'warning'}>{row.status}</Badge>
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

  return (
    <ConsoleShell title="الطلبات">
      <div className="console-metric-grid">
        <article className="console-metric">
          <p className="console-metric__label">الطلبات المفتوحة</p>
          <p className="console-metric__value dz-money">0</p>
        </article>
        <article className="console-metric">
          <p className="console-metric__label">نزاعات</p>
          <p className="console-metric__value dz-money">0</p>
        </article>
        <article className="console-metric">
          <p className="console-metric__label">مراجعة الإرجاع</p>
          <p className="console-metric__value dz-money">0</p>
        </article>
      </div>

      {canReview ? null : (
        <p className="page__subtitle">
          <Badge tone="warning">صلاحية تعديل الطلبات غير متاحة لقسمك</Badge>
        </p>
      )}

      {error !== null && (
        <p role="alert" className="page__subtitle">
          {error}
        </p>
      )}

      {isLoading ? (
        <Spinner size="lg" label="جارٍ التحميل" />
      ) : orders.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات بعد"
          description="تظهر الطلبات هنا فور وصولها من التطبيق."
        />
      ) : (
        <DataTable
          caption="طلبات العملاء"
          columns={columns}
          rows={orders}
          rowKey={(row) => row.id}
          dense
          stickyHeader
        />
      )}

      <Pagination
        page={page}
        pageSize={25}
        totalItems={totalItems}
        onPageChange={(nextPage) => {
          if (nextCursorByPage[nextPage] !== undefined || nextPage < page) {
            setPage(nextPage);
          }
        }}
        labels={{
          previous: 'السابق',
          next: 'التالي',
          summary: (p, total) => `صفحة ${p} من ${total}`,
        }}
      />
    </ConsoleShell>
  );
}
