import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Pagination,
  Spinner,
  TextField,
} from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';
import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';
import type { AdminAuditLogView } from '@damazon/api-client';

type AuditEntityType = 'User' | 'Driver' | 'Business' | 'Order' | 'Payment' | 'Invoice';
type AuditLogMeta = { hasMore: boolean; nextCursor: string | null; totalCount: number };

function entityLabel(entityType: string | null): string {
  switch (entityType) {
    case 'User':
      return 'مستخدم';
    case 'Driver':
      return 'سائق';
    case 'Business':
      return 'نشاط';
    case 'Order':
      return 'طلب';
    case 'Payment':
      return 'دفعة';
    case 'Invoice':
      return 'فاتورة';
    default:
      return entityType ?? '—';
  }
}

const PAGE_SIZE = 20;

export default function AuditLogsPage(): JSX.Element {
  const { client, status } = useConsoleSession();
  const [rows, setRows] = useState<readonly AdminAuditLogView[]>([]);
  const [meta, setMeta] = useState<AuditLogMeta>({
    hasMore: false,
    nextCursor: null,
    totalCount: 0,
  });
  const [cursorByPage, setCursorByPage] = useState<Readonly<Record<number, string>>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterActorId, setFilterActorId] = useState('');
  const [filterEntityType, setFilterEntityType] = useState<AuditEntityType | ''>('');

  const load = useCallback(
    async (fromCursor?: string, targetPage = 1): Promise<void> => {
      if (status !== 'authenticated') {
        setRows([]);
        setMeta({ hasMore: false, nextCursor: null, totalCount: 0 });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = { limit: PAGE_SIZE };
        if (fromCursor !== undefined) params.cursor = fromCursor;
        if (filterActorId !== '') params.actorId = filterActorId;
        if (filterEntityType !== '') params.entityType = filterEntityType;
        const response = await client.admin.listAuditLogs(params);
        setRows(response.items);
        setMeta(response.meta);
        const nextCursor = response.meta.nextCursor;
        if (nextCursor !== null) {
          setCursorByPage((cursors) => ({
            ...cursors,
            [targetPage + 1]: nextCursor,
          }));
        }
      } catch {
        setError('تعذر تحميل سجلات التدقق. تحقق من اتصالاتك وإعادة المحاولة.');
      } finally {
        setLoading(false);
      }
    },
    [client, filterActorId, filterEntityType, status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleFilterApply = useCallback((): void => {
    setPage(1);
    setCursorByPage({});
    void load(undefined, 1);
  }, [load]);
  const handlePageChange = useCallback(
    (nextPage: number): void => {
      const cursor = cursorByPage[nextPage];
      if (cursor === undefined && nextPage !== 1) return;
      setPage(nextPage);
      void load(cursor, nextPage);
    },
    [cursorByPage, load],
  );
  const handleClearFilters = useCallback((): void => {
    setFilterActorId('');
    setFilterEntityType('');
    setPage(1);
    setCursorByPage({});
  }, []);

  if (status === 'loading') {
    return (
      <ConsoleShell title="سجلات التدقيق">
        <Spinner size="lg" label="جار التحميل" />
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell title="سجلات التدقيق">
      <div className="console-shell__filters">
        <TextField
          label="البحث بالأئسة/سجل التدقق"
          name="actorId"
          type="search"
          value={filterActorId}
          onChange={(e) => {
            setFilterActorId(e.target.value);
            setPage(1);
            setCursorByPage({});
          }}
          placeholder="UUID"
        />
        <select
          value={filterEntityType}
          onChange={(e) => {
            setFilterEntityType(e.target.value as AuditEntityType | '');
            setPage(1);
            setCursorByPage({});
          }}
          className="console-shell__filter-select"
        >
          <option value="">كل الأقسام</option>
          <option value="User">المستخدمون</option>
          <option value="Driver">السائقون</option>
          <option value="Business">الأنشطة</option>
          <option value="Order">الطلبات</option>
          <option value="Payment">الدفعات</option>
          <option value="Invoice">الفواتير</option>
        </select>
        <div className="console-shell__filters-actions">
          <Button variant="primary" onClick={handleFilterApply}>
            تطبيق
          </Button>
          {filterActorId !== '' || filterEntityType !== '' ? (
            <Button variant="ghost" onClick={handleClearFilters}>
              مسح الفلاتر
            </Button>
          ) : null}
        </div>
      </div>
      {error !== null && (
        <p className="console-shell__error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Spinner size="lg" label="جار التحميل" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="لا توجد سجلات"
          description="لا توجد سجلات تدقيق مطابقة للمرشحات الحالية. سجلات التدقيق يتم تسجيلها تلقائيا عند أفعال الإدارة."
        />
      ) : (
        <>
          <DataTable
            caption="سجلات التدقق"
            columns={[
              {
                key: 'createdAt',
                header: 'الوقت',
                cell: (l) => new Date(l.createdAt).toLocaleString('ar-SY'),
                align: 'start',
              },
              {
                key: 'actorName',
                header: 'الأخبار',
                cell: (l) => l.actorName ?? '—',
                align: 'start',
              },
              { key: 'action', header: 'الإجراء', cell: (l) => l.action, align: 'start' },
              {
                key: 'entityType',
                header: 'الكيان',
                cell: (l) => <Badge tone="neutral">{entityLabel(l.entityType)}</Badge>,
                align: 'center',
              },
              { key: 'entityId', header: 'المعرف', cell: (l) => l.entityId ?? '—', align: 'start' },
            ]}
            rows={rows}
            rowKey={(l) => l.id}
            dense
            stickyHeader
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={meta.totalCount}
            onPageChange={handlePageChange}
            labels={{ previous: 'السابق', next: 'التالي' }}
          />
        </>
      )}
    </ConsoleShell>
  );
}
