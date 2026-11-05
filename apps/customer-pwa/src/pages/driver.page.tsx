import type {
  DeliveryTask,
  DeliveryTaskStatus,
  DriverAvailability,
  DriverStatus,
} from '@damazon/api-client';
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

const NEXT_ACTION: Partial<
  Record<DeliveryTaskStatus, { status: DeliveryTaskStatus; label: StringKey }>
> = {
  assigned: { status: 'accepted', label: 'delivery.accept' },
  accepted: { status: 'picked_up', label: 'delivery.pickUpAction' },
  picked_up: { status: 'in_transit', label: 'delivery.startTrip' },
  in_transit: { status: 'arrived_at_destination', label: 'delivery.arrived' },
  arrived_at_destination: { status: 'delivered', label: 'delivery.complete' },
};

export default function DriverPage(): JSX.Element {
  const { t, formatDateTime } = useLocale();
  const { client } = useSession();
  const [tasks, setTasks] = useState<readonly DeliveryTask[]>([]);
  const [availability, setAvailability] = useState<DriverStatus>('offline');
  const [loading, setLoading] = useState(true);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [nextTasks, driver] = await Promise.all([
        client.delivery.listTasks(),
        client.delivery.getAvailability(),
      ]);
      setTasks(nextTasks);
      setAvailability(driver.status);
    } catch {
      setError(t('delivery.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [client, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateStatus = useCallback(
    async (taskId: string, status: DeliveryTaskStatus): Promise<void> => {
      if (status === 'delivered' && !window.confirm(t('delivery.cashCollectedConfirm'))) {
        return;
      }
      setBusyTaskId(taskId);
      setError(null);
      try {
        await client.delivery.updateTaskStatus(taskId, status, status === 'delivered');
        await reload();
      } catch {
        setError(t('delivery.loadFailed'));
      } finally {
        setBusyTaskId(null);
      }
    },
    [client, reload, t],
  );

  const changeAvailability = useCallback(
    async (status: DriverAvailability): Promise<void> => {
      setError(null);
      try {
        await client.delivery.updateAvailability(status);
        setAvailability(status);
      } catch {
        setError(t('delivery.loadFailed'));
      }
    },
    [client, t],
  );

  const shareLocation = useCallback((): void => {
    if (!navigator.geolocation) {
      setError(t('delivery.locationFailed'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void client.delivery
          .updateLocation(position.coords.latitude, position.coords.longitude)
          .then(() => setNotice(t('delivery.locationUpdated')))
          .catch(() => setError(t('delivery.locationFailed')));
      },
      () => setError(t('delivery.locationFailed')),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, [client, t]);

  if (loading) {
    return (
      <BentoContainer>
        <div className="route-fallback">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      </BentoContainer>
    );
  }

  return (
    <BentoContainer>
      <div className="page">
        <header className="page__header">
          <h1 className="page__title">{t('delivery.tasks')}</h1>
          <Button variant="secondary" onClick={() => void reload()}>
            {t('delivery.refresh')}
          </Button>
        </header>
        <GlassCard padding="md">
          <div className="role-switcher">
            <SelectField
              label={t('delivery.availability')}
              name="availability"
              value={availability}
              disabled={tasks.some((task) =>
                [
                  'assigned',
                  'accepted',
                  'picked_up',
                  'in_transit',
                  'arrived_at_destination',
                ].includes(task.status),
              )}
              onChange={(event) => {
                const next = event.target.value;
                if (next === 'offline' || next === 'available' || next === 'on_break') {
                  void changeAvailability(next);
                }
              }}
              options={[
                { value: 'offline', label: t('delivery.offline') },
                { value: 'available', label: t('delivery.available') },
                { value: 'on_break', label: t('delivery.onBreak') },
                ...(availability === 'busy'
                  ? [{ value: 'busy', label: t('delivery.busy'), disabled: true }]
                  : []),
                ...(availability === 'suspended'
                  ? [{ value: 'suspended', label: t('delivery.suspended'), disabled: true }]
                  : []),
              ]}
            />
            <Button variant="secondary" onClick={shareLocation}>
              {t('delivery.shareLocation')}
            </Button>
          </div>
        </GlassCard>
        {error !== null && (
          <GlassCard padding="md">
            <p className="dz-field__error" role="alert">
              {error}
            </p>
          </GlassCard>
        )}
        {notice !== null && <Badge tone="success">{notice}</Badge>}
        {tasks.length === 0 ? (
          <EmptyState title={t('delivery.noTasks')} />
        ) : (
          tasks.map((task) => {
            const action = NEXT_ACTION[task.status];
            return (
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
                {action !== undefined && (
                  <Button
                    loading={busyTaskId === task.id}
                    onClick={() => void updateStatus(task.id, action.status)}
                  >
                    {t(action.label)}
                  </Button>
                )}
              </GlassCard>
            );
          })
        )}
      </div>
    </BentoContainer>
  );
}
