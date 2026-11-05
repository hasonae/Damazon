import { Badge, DataTable, EmptyState, type DataTableColumn } from '@damazon/design-system';
import { useState } from 'react';

import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';

interface AuditRow {
  readonly at: string;
  readonly actor: string;
  readonly action: string;
  readonly target: string;
}

/**
 * Audit log.
 *
 * Reading customer data is itself an audited action, so this screen is the
 * console's own accountability record. Entries are append-only and rendered
 * newest first; there is no edit or delete affordance by design.
 */
export default function SecurityPage(): JSX.Element {
  const { can } = useConsoleSession();
  const [entries] = useState<readonly AuditRow[]>([]);
  const canReadAudit = can('audit:read');

  const columns: ReadonlyArray<DataTableColumn<AuditRow>> = [
    { key: 'at', header: 'الوقت', cell: (row) => <span className="dz-numeric">{row.at}</span> },
    { key: 'actor', header: 'المنفّذ', cell: (row) => row.actor },
    {
      key: 'action',
      header: 'الإجراء',
      cell: (row) => (
        <Badge tone={row.action.includes('DELETE') ? 'danger' : 'neutral'}>{row.action}</Badge>
      ),
    },
    {
      key: 'target',
      header: 'الهدف',
      cell: (row) => <span className="dz-numeric">{row.target}</span>,
    },
  ];

  return (
    <ConsoleShell title="الأمان">
      {!canReadAudit ? (
        <Badge tone="warning">قراءة سجل التدقيق غير متاحة لقسمك</Badge>
      ) : entries.length === 0 ? (
        <EmptyState title="لا توجد أحداث مسجّلة" />
      ) : (
        <DataTable
          caption="سجل التدقيق"
          columns={columns}
          rows={entries}
          rowKey={(row) => `${row.at}-${row.target}`}
          dense
          stickyHeader
        />
      )}
    </ConsoleShell>
  );
}
