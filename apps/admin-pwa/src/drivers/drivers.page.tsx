import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  SelectField,
  Spinner,
  TextField,
  type Tone,
} from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';
import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';
import type { AdminBusinessReview, AdminDriverView } from '@damazon/api-client';

type DriverStatus = 'available' | 'offline' | 'on_break' | 'suspended';

function statusLabel(status: string): string {
  switch (status) {
    case 'available':
      return 'متاح';
    case 'offline':
      return 'غير متصل';
    case 'on_break':
      return 'استراحة';
    case 'suspended':
      return 'موقوف';
    default:
      return status;
  }
}

function statusTone(status: string): Tone {
  switch (status) {
    case 'available':
      return 'success';
    case 'on_break':
      return 'warning';
    case 'suspended':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function DriversPage(): JSX.Element {
  const { client, can, status } = useConsoleSession();
  const canUpdate = can('drivers:update');
  const [rows, setRows] = useState<readonly AdminDriverView[]>([]);
  const [deliveryCompanies, setDeliveryCompanies] = useState<readonly AdminBusinessReview[]>([]);
  const [selectedCompanyBusinessId, setSelectedCompanyBusinessId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (status !== 'authenticated') {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [response, businesses] = await Promise.all([
        client.admin.listDrivers(),
        client.admin.reviewBusinesses(),
      ]);
      setRows(response);
      const companies = businesses.filter(
        (business) =>
          business.type === 'delivery_company' &&
          business.businessStatus === 'ACTIVE' &&
          business.verificationStatus === 'APPROVED' &&
          business.hasActiveSubscription,
      );
      setDeliveryCompanies(companies);
      setSelectedCompanyBusinessId((current) => current || companies[0]?.id || '');
    } catch {
      setError('تعذر تحميل السائقين. تحقق من اتصالاتك وإعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = useCallback(
    async (driver: AdminDriverView, nextStatus: DriverStatus): Promise<void> => {
      if (selectedDriverId !== driver.id || updatingId !== null) return;
      setSelectedDriverId(driver.id);
      setUpdatingId(driver.id);
      try {
        await client.admin.updateDriverStatus(driver.id, nextStatus);
        setRows((c) =>
          c.map((item) => (item.id === driver.id ? { ...item, status: nextStatus } : item)),
        );
      } catch {
        setError('تعذر تحديث حالة السائق. يرجى المحاولة مرة أخرى.');
      } finally {
        setSelectedDriverId((c) => (c === driver.id ? null : c));
        setUpdatingId((c) => (c === driver.id ? null : c));
      }
    },
    [client, selectedDriverId, updatingId],
  );

  const handleApplicationReview = useCallback(
    async (driver: AdminDriverView, approve: boolean): Promise<void> => {
      setUpdatingId(driver.id);
      setError(null);
      try {
        if (approve) {
          if (selectedCompanyBusinessId.length === 0) {
            setError('اختر شركة توصيل نشطة لاعتماد السائق.');
            return;
          }
          await client.admin.approveDriverApplication(driver.id, selectedCompanyBusinessId);
        } else {
          if (rejectionReason.trim().length < 3) {
            setError('اكتب سبباً واضحاً لرفض الطلب.');
            return;
          }
          await client.admin.rejectDriverApplication(driver.id, rejectionReason.trim());
          setRejectionReason('');
        }
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'تعذر مراجعة طلب السائق.');
      } finally {
        setUpdatingId(null);
      }
    },
    [client, load, rejectionReason, selectedCompanyBusinessId],
  );

  if (status === 'loading') {
    return (
      <ConsoleShell title="السائقون">
        <Spinner size="lg" label="جار التحميل" />
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      title="السائقون"
      actions={
        <Button variant="secondary" onClick={() => void load()}>
          تحديث
        </Button>
      }
    >
      {error !== null && (
        <p className="console-shell__error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Spinner size="lg" label="جار التحميل" />
      ) : rows.length === 0 ? (
        <EmptyState title="لا يوجد سائقون" description="ستظهر حسابات السائقين هنا عند توفرها." />
      ) : (
        <DataTable
          caption="سائقون"
          columns={[
            { key: 'name', header: 'الاسم', cell: (d) => d.name },
            { key: 'phone', header: 'الهاتف', cell: (d) => d.phone, align: 'start' },
            {
              key: 'status',
              header: 'الحالة',
              cell: (d) => <Badge tone={statusTone(d.status)}>{statusLabel(d.status)}</Badge>,
              align: 'center',
            },
            {
              key: 'applicationStatus',
              header: 'طلب الانضمام',
              cell: (d) => (
                <Badge tone={d.applicationStatus === 'APPROVED' ? 'success' : 'warning'}>
                  {d.applicationStatus}
                </Badge>
              ),
              align: 'center',
            },
            { key: 'vehicleType', header: 'نوع المركبة', cell: (d) => d.vehicleType },
            {
              key: 'completedDeliveries',
              header: 'التسليمات المكتملة',
              cell: (d) => d.completedDeliveries.toLocaleString('ar-SY'),
              numeric: true,
              align: 'end',
            },
            {
              key: 'companyName',
              header: 'الشركة',
              cell: (d) => <span>{d.companyName ?? '—'}</span>,
            },
          ]}
          rows={rows}
          rowKey={(d) => d.id}
          onRowClick={canUpdate ? (d) => setSelectedDriverId(d.id) : () => undefined}
          dense
          stickyHeader
        />
      )}
      {selectedDriverId !== null && (
        <section className="console-metric-grid">
          <article className="console-metric">
            {(() => {
              const selectedDriver = rows.find((item) => item.id === selectedDriverId);
              if (selectedDriver === undefined) return null;
              if (
                selectedDriver.applicationStatus === 'PENDING' ||
                selectedDriver.applicationStatus === 'UNDER_REVIEW'
              ) {
                return (
                  <>
                    <p className="console-metric__label">مراجعة طلب السائق</p>
                    <SelectField
                      label="شركة التوصيل"
                      name="deliveryCompany"
                      value={selectedCompanyBusinessId}
                      disabled={deliveryCompanies.length === 0}
                      onChange={(event) => setSelectedCompanyBusinessId(event.target.value)}
                      options={[
                        { value: '', label: 'اختر شركة توصيل' },
                        ...deliveryCompanies.map((company) => ({
                          value: company.id,
                          label: company.name,
                        })),
                      ]}
                    />
                    {deliveryCompanies.length === 0 && (
                      <p className="page__subtitle">لا توجد شركة توصيل معتمدة باشتراك نشط.</p>
                    )}
                    <TextField
                      label="سبب الرفض"
                      name="rejectionReason"
                      minLength={3}
                      maxLength={500}
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                    />
                    <div className="console-metric__actions">
                      <Button
                        variant="primary"
                        disabled={!canUpdate || deliveryCompanies.length === 0}
                        loading={updatingId === selectedDriver.id}
                        onClick={() => void handleApplicationReview(selectedDriver, true)}
                      >
                        اعتماد وربط بالشركة
                      </Button>
                      <Button
                        variant="danger"
                        disabled={!canUpdate || rejectionReason.trim().length < 3}
                        loading={updatingId === selectedDriver.id}
                        onClick={() => void handleApplicationReview(selectedDriver, false)}
                      >
                        رفض الطلب
                      </Button>
                    </div>
                  </>
                );
              }
              return (
                <>
                  <p className="console-metric__label">حالة السائق</p>
                  <p className="console-metric__value">
                    <Badge tone={statusTone(selectedDriver.status)}>{selectedDriver.status}</Badge>
                  </p>
                  <div className="console-metric__actions">
                    {(['available', 'offline', 'on_break', 'suspended'] as const).map(
                      (nextStatus) => (
                        <Button
                          key={nextStatus}
                          variant="ghost"
                          size="sm"
                          disabled={updatingId !== null}
                          onClick={() => {
                            if (selectedDriverId !== null)
                              void handleStatusChange(selectedDriver, nextStatus);
                          }}
                        >
                          {statusLabel(nextStatus)}
                        </Button>
                      ),
                    )}
                  </div>
                </>
              );
            })()}
          </article>
        </section>
      )}
    </ConsoleShell>
  );
}
