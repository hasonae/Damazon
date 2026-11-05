import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Pagination,
  Spinner,
  TextField,
  type Tone,
} from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';
import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';
import type { AdminUserView } from '@damazon/api-client';

type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';

function statusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'نشط';
    case 'SUSPENDED':
      return 'موقوفا';
    case 'BLOCKED':
      return 'محظور';
    default:
      return status;
  }
}

function statusTone(status: string): Tone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'SUSPENDED':
      return 'warning';
    case 'BLOCKED':
      return 'danger';
    default:
      return 'neutral';
  }
}

const PAGE_SIZE = 25;

export default function UsersPage(): JSX.Element {
  const { client, can, status } = useConsoleSession();
  const canUpdate = can('users:update');
  const canSuspend = can('users:suspend');
  const [users, setUsers] = useState<readonly AdminUserView[]>([]);
  const [meta, setMeta] = useState<{
    hasMore: boolean;
    nextCursor: string | null;
    totalCount: number;
  }>({ hasMore: false, nextCursor: null, totalCount: 0 });
  const [cursorByPage, setCursorByPage] = useState<Readonly<Record<number, string>>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(
    async (fromCursor?: string, targetPage = 1): Promise<void> => {
      if (status !== 'authenticated') {
        setUsers([]);
        setMeta({ hasMore: false, nextCursor: null, totalCount: 0 });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = { limit: PAGE_SIZE };
        if (fromCursor !== undefined) params.cursor = fromCursor;
        const response = await client.admin.listUsers(params);
        setUsers(response.items);
        setMeta({
          hasMore: response.meta.hasMore,
          nextCursor: response.meta.nextCursor,
          totalCount: response.meta.totalCount ?? response.items.length,
        });
        const nextCursor = response.meta.nextCursor;
        if (nextCursor !== null) {
          setCursorByPage((cursors) => ({
            ...cursors,
            [targetPage + 1]: nextCursor,
          }));
        }
      } catch {
        setError('تعذر تحميل الحسابات. تحقق من اتصالاتك وإعادة المحاولة.');
      } finally {
        setLoading(false);
      }
    },
    [client, status],
  );

  useEffect(() => {
    void load();
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

  const handleStatusChange = useCallback(
    async (user: AdminUserView, nextStatus: UserStatus): Promise<void> => {
      if (selectedUserId !== user.id || updatingId !== null) return;
      setSelectedUserId(user.id);
      setUpdatingId(user.id);
      try {
        await client.admin.updateUserStatus(user.id, nextStatus);
        setUsers((c) =>
          c.map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item)),
        );
        setReason('');
      } catch {
        setError('تعذر تحديث حالة الحساب. يرجى المحاولة مرة أخرى.');
      } finally {
        setSelectedUserId((c) => (c === user.id ? null : c));
        setUpdatingId((c) => (c === user.id ? null : c));
      }
    },
    [client, selectedUserId, updatingId],
  );

  if (status === 'loading') {
    return (
      <ConsoleShell title="المستخدمون">
        <Spinner size="lg" label="جار التحميل" />
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      title="المستخدمون"
      actions={
        <Button variant="primary" disabled={!canUpdate}>
          إضافة حساب
        </Button>
      }
    >
      <form className="console-shell__search" onSubmit={(event) => event.preventDefault()}>
        <TextField label="البحث بالاسم أو البريد أو الهاتف" name="q" type="search" />
      </form>
      {error !== null && (
        <p className="console-shell__error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Spinner size="lg" label="جار التحميل" />
      ) : users.length === 0 ? (
        <EmptyState title="لا توجد حسابات" description="لا توجد حسابات مسجلة لعرضها حاليا." />
      ) : (
        <DataTable
          caption="حسابات"
          columns={[
            {
              key: 'firstName',
              header: 'الاسم',
              cell: (u) => `${u.firstName} ${u.lastName}`,
              align: 'start',
            },
            { key: 'email', header: 'البريد', cell: (u) => u.email ?? '—', align: 'start' },
            { key: 'phone', header: 'الهاتف', cell: (u) => u.phone, align: 'start' },
            {
              key: 'status',
              header: 'الحالة',
              cell: (u) => <Badge tone={statusTone(u.status)}>{statusLabel(u.status)}</Badge>,
              align: 'center',
            },
            { key: 'roles', header: 'الأدوار', cell: (u) => u.roles.join(', '), align: 'start' },
            {
              key: 'createdAt',
              header: 'تاريخ التسجيل',
              cell: (u) => new Date(u.createdAt).toLocaleString('ar-SY'),
              align: 'start',
            },
          ]}
          rows={users}
          rowKey={(u) => u.id}
          onRowClick={canUpdate ? (u) => setSelectedUserId(u.id) : () => undefined}
          dense
          stickyHeader
        />
      )}
      {!loading && users.length > 0 && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={meta.totalCount}
          onPageChange={handlePageChange}
          labels={{ previous: 'السابق', next: 'التالي' }}
        />
      )}
      {selectedUserId !== null && (
        <section className="console-metric-grid">
          <article className="console-metric">
            <p className="console-metric__label">حالة المستخدم</p>
            <p className="console-metric__value">
              <Badge tone={statusTone(users.find((i) => i.id === selectedUserId)?.status ?? '')}>
                {users.find((i) => i.id === selectedUserId)?.status ?? '—'}
              </Badge>
            </p>
            <TextField
              label="سبب الإجراء"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!canSuspend}
              hint="يسجل في سجل التدقيق"
            />
            <div className="console-metric__actions">
              {(['ACTIVE', 'SUSPENDED', 'BLOCKED'] as const).map((nextStatus) => (
                <Button
                  key={nextStatus}
                  variant="ghost"
                  size="sm"
                  disabled={updatingId !== null}
                  onClick={() => {
                    if (selectedUserId !== null)
                      void handleStatusChange(
                        users.find((i) => i.id === selectedUserId)!,
                        nextStatus,
                      );
                  }}
                >
                  {statusLabel(nextStatus)}
                </Button>
              ))}
            </div>
          </article>
        </section>
      )}
    </ConsoleShell>
  );
}
