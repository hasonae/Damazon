import type { DeliveryDriver, DeliveryTask, DriverStatus } from '@damazon/api-client';
import {
  Badge,
  BentoContainer,
  Button,
  EmptyState,
  GlassCard,
  SelectField,
  Spinner,
} from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';

import { useLocale, type StringKey } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

const DRIVER_STATUS_LABEL: Record<DriverStatus, StringKey> = {
  offline: 'delivery.offline',
  available: 'delivery.available',
  busy: 'delivery.busy',
  on_break: 'delivery.onBreak',
  suspended: 'delivery.suspended',
};

export default function DeliveryCompanyPage(): JSX.Element {
  const { t, formatDateTime } = useLocale();
  const { client } = useSession();
  const [tasks, setTasks] = useState<readonly DeliveryTask[]>([]);
  const [drivers, setDrivers] = useState<readonly DeliveryDriver[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<Readonly<Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [nextTasks, nextDrivers] = await Promise.all([
        client.delivery.listTasks(),
        client.delivery.listDrivers(),
      ]);
      setTasks(nextTasks);
      setDrivers(nextDrivers);
    } catch {
      setError(t('delivery.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [client, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const assign = useCallback(
    async (taskId: string): Promise<void> => {
      const driverId = selectedDrivers[taskId];
      if (driverId === undefined) return;
      setBusyTaskId(taskId);
      setError(null);
      try {
        await client.delivery.assignTask(taskId, driverId);
        await reload();
      } catch {
        setError(t('delivery.loadFailed'));
      } finally {
        setBusyTaskId(null);
      }
    },
    [client, reload, selectedDrivers, t],
  );

  if (loading) {
    return (
      <BentoContainer>
        <div className="route-fallback">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      </BentoContainer>
    );
  }

  const availableDrivers = drivers.filter((driver) => driver.status === 'available');

  return (
    <BentoContainer>
      <div className="page">
        <header className="page__header">
          <h1 className="page__title">{t('delivery.title')}</h1>
          <Button variant="secondary" onClick={() => void reload()}>
            {t('delivery.refresh')}
          </Button>
        </header>
        {error !== null && (
          <GlassCard padding="md">
            <p className="dz-field__error" role="alert">
              {error}
            </p>
          </GlassCard>
        )}
        <h2 className="page__title">{t('delivery.drivers')}</h2>
        {drivers.length === 0 ? (
          <EmptyState title={t('delivery.noDrivers')} />
        ) : (
          <div className="business-grid">
            {drivers.map((driver) => (
              <GlassCard key={driver.id} padding="md">
                <div className="order-card__head">
                  <strong>{driver.name}</strong>
                  <Badge tone={driver.status === 'available' ? 'success' : 'warning'}>
                    {t(DRIVER_STATUS_LABEL[driver.status])}
                  </Badge>
                </div>
                <p className="page__subtitle" dir="ltr">
                  {driver.phone}
                </p>
                <p className="page__subtitle">
                  {driver.vehicleType} · {driver.completedDeliveries}
                </p>
              </GlassCard>
            ))}
          </div>
        )}

        <h2 className="page__title">{t('delivery.tasks')}</h2>
        {tasks.length === 0 ? (
          <EmptyState title={t('delivery.noTasks')} />
        ) : (
          tasks.map((task) => (
            <GlassCard key={task.id} padding="md" className="order-card">
              <div className="order-card__head">
                <div>
                  <strong dir="ltr">{task.order.orderNumber}</strong>
                  <span className="page__subtitle">{task.order.businessName}</span>
                </div>
                <Badge tone={task.status === 'delivered' ? 'success' : 'warning'}>
                  {t(`delivery.status.${task.status}`)}
                </Badge>
              </div>
              <p>
                {t('delivery.customer')}: {task.order.customerName}
              </p>
              <p dir="ltr">{task.order.customerPhone}</p>
              <p className="page__subtitle">{formatDateTime(task.createdAt)}</p>
              {task.driver !== null ? (
                <p>
                  {t('delivery.driver')}: {task.driver.name}
                </p>
              ) : task.status === 'unassigned' ? (
                availableDrivers.length > 0 ? (
                  <div className="role-switcher">
                    <SelectField
                      label={t('delivery.selectDriver')}
                      name={`driver-${task.id}`}
                      value={selectedDrivers[task.id] ?? ''}
                      onChange={(event) =>
                        setSelectedDrivers((previous) => ({
                          ...previous,
                          [task.id]: event.target.value,
                        }))
                      }
                      options={[
                        { value: '', label: t('delivery.selectDriver') },
                        ...availableDrivers.map((driver) => ({
                          value: driver.id,
                          label: driver.name,
                        })),
                      ]}
                    />
                    <Button
                      size="sm"
                      loading={busyTaskId === task.id}
                      disabled={selectedDrivers[task.id] === undefined}
                      onClick={() => void assign(task.id)}
                    >
                      {t('delivery.assign')}
                    </Button>
                  </div>
                ) : (
                  <p className="page__subtitle">{t('delivery.noDrivers')}</p>
                )
              ) : null}
            </GlassCard>
          ))
        )}
      </div>
    </BentoContainer>
  );
}
