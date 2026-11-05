import { Badge, Button, EmptyState, TextAreaField } from '@damazon/design-system';
import { useCallback, useState } from 'react';

import { runtimeConfig } from '../config/runtime.js';
import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';

/**
 * Finance review.
 *
 * Every financial action requires a reason, and the reason is what the audit log
 * records. The screen refuses to submit an empty reason rather than letting the
 * API reject it, because an operator approving a refund should see the
 * requirement before they click.
 */
export default function FinancePage(): JSX.Element {
  const { can } = useConsoleSession();
  const [reason, setReason] = useState('');
  const [pendingPayoutId, setPendingPayoutId] = useState<string | null>(null);

  const canApprovePayouts = can('finance:payouts:approve');
  const canRefund = can('finance:refunds:approve');

  const reasonMissing = runtimeConfig.requireReasonForActions && reason.trim().length === 0;

  const submit = useCallback(() => setPendingPayoutId(null), []);

  return (
    <ConsoleShell title="المالية">
      <div className="console-metric-grid">
        <article className="console-metric">
          <p className="console-metric__label">مدفوعات معلّقة</p>
          <p className="console-metric__value dz-money">0</p>
        </article>
        <article className="console-metric">
          <p className="console-metric__label">مستردات قيد المراجعة</p>
          <p className="console-metric__value dz-money">0</p>
        </article>
        <article className="console-metric">
          <p className="console-metric__label">فواتير غير مسددة</p>
          <p className="console-metric__value dz-money">0</p>
        </article>
      </div>

      {!canApprovePayouts && !canRefund ? (
        <Badge tone="warning">لا تملك صلاحيات مالية</Badge>
      ) : (
        <EmptyState title="لا توجد بنود معلّقة" />
      )}

      {pendingPayoutId !== null && (
        <section className="console-metric-grid">
          <article className="console-metric">
            <TextAreaField
              label="سبب الإجراء"
              name="reason"
              required={runtimeConfig.requireReasonForActions}
              hint="يُسجَّل في سجل التدقيق ولا يظهر للتاجر"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {reasonMissing && (
              <p className="dz-field__error" role="alert">
                يجب ذكر سبب قبل التنفيذ
              </p>
            )}
            <Button variant="primary" disabled={reasonMissing} onClick={submit}>
              تنفيذ
            </Button>
          </article>
        </section>
      )}

      <button type="button" onClick={() => setPendingPayoutId(null)} hidden />
    </ConsoleShell>
  );
}
