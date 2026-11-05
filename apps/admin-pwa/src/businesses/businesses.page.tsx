import type { AdminBusinessReview } from '@damazon/api-client';
import { Badge, Button, EmptyState, GlassCard, Spinner, TextField } from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';

import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';

/** Business review and cash-subscription operations. */
export default function BusinessesPage(): JSX.Element {
  const { can, client } = useConsoleSession();
  const [businesses, setBusinesses] = useState<readonly AdminBusinessReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyBusinessId, setBusyBusinessId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Readonly<Record<string, string>>>({});
  const canApprove = can('businesses:approve');
  const canManageSubscriptions = can('subscriptions:manage') && can('invoices:manage');

  const load = useCallback(async (): Promise<void> => {
    if (!can('businesses:read')) {
      setError('صلاحية قراءة بيانات الشركات غير متاحة لقسمك.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setBusinesses(await client.admin.reviewBusinesses());
    } catch {
      setError('تعذّر تحميل طلبات مراجعة الشركات.');
    } finally {
      setIsLoading(false);
    }
  }, [can, client]);

  const runAction = useCallback(
    async (businessId: string, action: () => Promise<void>): Promise<void> => {
      setBusyBusinessId(businessId);
      setError(null);
      try {
        await action();
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'تعذّر تنفيذ الإجراء.');
      } finally {
        setBusyBusinessId(null);
      }
    },
    [load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleShell title="الشركات">
      <div className="console-metric-grid">
        <article className="console-metric">
          <p className="console-metric__label">طلبات بانتظار المراجعة</p>
          <p className="console-metric__value dz-money">
            {
              businesses.filter(
                (business) =>
                  business.verificationStatus === 'PENDING' ||
                  business.verificationStatus === 'UNDER_REVIEW',
              ).length
            }
          </p>
        </article>
      </div>

      {error !== null && (
        <p role="alert" className="page__subtitle">
          {error}
        </p>
      )}
      {isLoading ? (
        <Spinner size="lg" label="جارٍ التحميل" />
      ) : businesses.length === 0 ? (
        <EmptyState title="لا توجد أنشطة تجارية" />
      ) : (
        businesses.map((business) => (
          <GlassCard key={business.id} padding="md" className="order-card">
            <div className="order-card__head">
              <div>
                <strong>{business.name}</strong>
                <span className="page__subtitle">
                  {business.type} · {business.city}
                </span>
              </div>
              <div className="role-switcher">
                <Badge tone={business.verificationStatus === 'APPROVED' ? 'success' : 'warning'}>
                  {business.verificationStatus}
                </Badge>
                <Badge tone={business.businessStatus === 'ACTIVE' ? 'success' : 'warning'}>
                  {business.businessStatus}
                </Badge>
              </div>
            </div>
            <p>
              {business.ownerName} · <span dir="ltr">{business.ownerPhone}</span>
            </p>
            <div className="console-metric-grid">
              <p className="page__subtitle">
                المستندات المعتمدة: {business.approvedDocumentCount}/{business.documentCount}
              </p>
              <Badge tone={business.hasActiveSubscription ? 'success' : 'warning'}>
                {business.hasActiveSubscription
                  ? `اشتراك فعال حتى ${new Date(business.subscriptionPeriodEnd ?? '').toLocaleDateString('ar-SY')}${business.subscriptionStatus === 'pending' ? ' مع تجديد مسبق مسجل' : ''}`
                  : business.subscriptionStatus === 'pending'
                    ? 'تم تسجيل تجديد مدفوع، بانتظار بدء فترته'
                    : 'لا يوجد اشتراك فعال'}
              </Badge>
            </div>
            {business.verificationStatus === 'PENDING' ||
            business.verificationStatus === 'UNDER_REVIEW' ? (
              <div className="auth-card__form">
                <TextField
                  label="سبب الرفض (إلزامي عند الرفض)"
                  name={`reject-reason-${business.id}`}
                  value={rejectionReasons[business.id] ?? ''}
                  onChange={(event) =>
                    setRejectionReasons((previous) => ({
                      ...previous,
                      [business.id]: event.target.value,
                    }))
                  }
                />
                {canApprove && (
                  <div className="role-switcher">
                    <Button
                      disabled={busyBusinessId !== null}
                      loading={busyBusinessId === business.id}
                      onClick={() =>
                        void runAction(business.id, () => client.admin.approveBusiness(business.id))
                      }
                    >
                      موافقة على النشاط
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={
                        busyBusinessId !== null ||
                        (rejectionReasons[business.id] ?? '').trim().length < 3
                      }
                      onClick={() =>
                        void runAction(business.id, () =>
                          client.admin.rejectBusiness(
                            business.id,
                            rejectionReasons[business.id] ?? '',
                          ),
                        )
                      }
                    >
                      رفض الطلب
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
            {business.verificationStatus === 'APPROVED' &&
              business.subscriptionStatus !== 'pending' &&
              canManageSubscriptions && (
                <div className="role-switcher">
                  <p className="page__subtitle">
                    الاشتراك: 500 ليرة سورية جديدة نقداً لمدة 30 يوماً.
                  </p>
                  <Button
                    disabled={busyBusinessId !== null || business.businessStatus === 'CLOSED'}
                    loading={busyBusinessId === business.id}
                    onClick={() =>
                      void runAction(business.id, () =>
                        client.admin.confirmBusinessCashSubscription(business.id),
                      )
                    }
                  >
                    تأكيد استلام النقد وتسجيل 30 يوماً
                  </Button>
                </div>
              )}
          </GlassCard>
        ))
      )}
    </ConsoleShell>
  );
}
