/**
 * Order tracking detail (Part 5.2 §13): status timeline, seller, payment,
 * delivery destination, line items, and customer cancellation guarded by the
 * same state machine the API enforces.
 */

import type { OrderDetail, OrderTracking } from '@damazon/api-client';
import {
  Badge,
  BentoContainer,
  Button,
  GlassCard,
  Spinner,
  TextAreaField,
} from '@damazon/design-system';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';
import {
  canCustomerCancel,
  deliveryStatusKey,
  orderStatusKey,
  orderStatusTone,
  paymentMethodKey,
  paymentStatusKey,
} from '../utils/order-labels.js';

const POLL_INTERVAL_MS = 10_000;

export default function OrderDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ readonly id: string }>();
  const { t, locale, formatMoney, formatDateTime } = useLocale();
  const { client } = useSession();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setOrder(await client.orders.get(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [client, id, t]);

  const reloadTracking = useCallback(async (): Promise<void> => {
    try {
      setTrackingError(null);
      setTracking(await client.orders.track(id));
    } catch (cause) {
      setTrackingError(cause instanceof Error ? cause.message : null);
    }
  }, [client, id]);

  useEffect(() => {
    void reload();
    void reloadTracking();
    const timer = setInterval(() => void reloadTracking(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reload, reloadTracking]);

  if (isLoading) {
    return (
      <BentoContainer>
        <div className="route-fallback">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      </BentoContainer>
    );
  }

  if (order === null) {
    return (
      <BentoContainer>
        <div className="page">
          <header className="page__header">
            <h1 className="page__title">{t('order.detail')}</h1>
          </header>
          <GlassCard padding="lg">
            <p className="dz-field__error">{error ?? t('common.error')}</p>
            <Button variant="secondary" onClick={reload}>
              {t('common.retry')}
            </Button>
          </GlassCard>
        </div>
      </BentoContainer>
    );
  }

  const submitCancel = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (reason.trim().length < 3) {
      return;
    }
    setCancelling(true);
    void client.orders
      .cancel(id, reason.trim())
      .then((updated) => {
        setOrder(updated);
        setCancelDone(t('order.cancelledSuccessfully'));
        window.setTimeout(() => setCancelDone(null), 2600);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : t('common.error'));
      })
      .finally(() => setCancelling(false));
  };

  return (
    <BentoContainer>
      <div className="page">
        <header className="page__header">
          <h1 className="page__title" dir="ltr">
            {order.orderNumber}
          </h1>
          <div className="order-row">
            <span className="page__subtitle">
              {order.business.name} · {formatDateTime(order.createdAt)}
            </span>
            <Badge tone={orderStatusTone(order.status)}>{t(orderStatusKey(order.status))}</Badge>
          </div>
        </header>

        {error !== null && <p className="dz-field__error">{error}</p>}
        {cancelDone !== null && (
          <p className="page__subtitle" role="status">
            ✓ {cancelDone}
          </p>
        )}

        <GlassCard padding="lg">
          <h2 className="section-label">{t('order.timeline')}</h2>
          <ol className="timeline">
            {order.history.map((event, index) => (
              <li key={`${event.toStatus}-${index}`} className="timeline__event">
                <span className="timeline__dot" aria-hidden="true" />
                <div>
                  <strong>{t(orderStatusKey(event.toStatus))}</strong>
                  <span className="page__subtitle">{formatDateTime(event.createdAt)}</span>
                  {event.note !== null && event.note.length > 0 && (
                    <p className="page__subtitle">{event.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </GlassCard>

        <GlassCard padding="lg">
          <h2 className="section-label">{t('order.items')}</h2>
          <div className="cart-lines">
            {order.items.map((item) => (
              <div key={item.id} className="cart-line">
                <div className="cart-line__info">
                  <span className="cart-line__name">
                    {locale === 'ar' ? item.nameAr : item.nameEn}
                  </span>
                  <span className="cart-line__meta">
                    × {item.quantity} · {formatMoney(BigInt(item.unitPriceMinor), order.currency)}
                  </span>
                </div>
                <span className="dz-money">
                  {formatMoney(BigInt(item.totalMinor), order.currency)}
                </span>
              </div>
            ))}
          </div>
          <div className="cart-summary__row cart-summary__row--total">
            <span>{t('cart.total')}</span>
            <span className="dz-money">
              {formatMoney(BigInt(order.totalMinor), order.currency)}
            </span>
          </div>
        </GlassCard>

        <GlassCard padding="lg">
          <h2 className="section-label">{t('order.paymentMethod')}</h2>
          <p className="page__subtitle">
            {order.paymentMethod !== null
              ? t(paymentMethodKey(order.paymentMethod))
              : t('common.na')}
          </p>
          <h2 className="section-label">{t('order.paymentStatus')}</h2>
          <p className="page__subtitle">{t(paymentStatusKey(order.paymentStatus))}</p>
          {order.deliveryZone !== null && (
            <>
              <h2 className="section-label">{t('order.zone')}</h2>
              <p className="page__subtitle">{order.deliveryZone.name}</p>
            </>
          )}
          {order.customerNote !== null && order.customerNote.length > 0 && (
            <>
              <h2 className="section-label">{t('checkout.orderNote')}</h2>
              <p className="page__subtitle">{order.customerNote}</p>
            </>
          )}
          {order.cancellationReason !== null && order.cancellationReason.length > 0 && (
            <>
              <h2 className="section-label">{t('order.cancel')}</h2>
              <p className="page__subtitle">{order.cancellationReason}</p>
            </>
          )}
        </GlassCard>

        {tracking !== null && (
          <GlassCard padding="lg">
            <h2 className="section-label">{t('order.tracking')}</h2>
            {trackingError !== null && (
              <p className="page__subtitle dz-field__error" role="alert">
                {trackingError}
              </p>
            )}
            <div className="tracking-card">
              <div className="tracking__route">
                {tracking.driverLocation !== null && tracking.destination !== null && (
                  <>
                    <svg
                      className="tracking__map"
                      viewBox="0 0 100 60"
                      aria-label={t('order.trackingMap')}
                    >
                      <defs>
                        <marker
                          id="arrow"
                          markerWidth="10"
                          markerHeight="10"
                          refX="9"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0,0 0,6 6,3 0,0" fill="#94a3b8" />
                        </marker>
                      </defs>
                      <line
                        x1="15"
                        y1="30"
                        x2="85"
                        y2="30"
                        stroke="#cbd5e1"
                        strokeWidth="2"
                        marker-end="url(#arrow)"
                      />
                      <circle
                        cx="15"
                        cy="30"
                        r="4"
                        fill="#2563eb"
                        className="tracking__marker--start"
                      />
                      <circle
                        cx="85"
                        cy="30"
                        r="4"
                        fill="#dc2626"
                        className="tracking__marker--destination"
                      />
                      {tracking.driverLocation !== null && (
                        <circle
                          cx={50}
                          cy="30"
                          r="3.5"
                          fill="#16a34a"
                          className="tracking__marker--driver"
                          transform={`translate(${tracking.driverLocation.latitude > 0 ? 10 : -10}, 0)`}
                        />
                      )}
                    </svg>
                    <div className="tracking__legend">
                      <span className="tracking__legend-item">
                        <span className="tracking__dot tracking__dot--store" />
                        {t('order.store')}
                      </span>
                      <span className="tracking__legend-item">
                        <span className="tracking__dot tracking__dot--driver" />
                        {t('order.driver')}
                      </span>
                      <span className="tracking__legend-item">
                        <span className="tracking__dot tracking__dot--destination" />
                        {t('order.destination')}
                      </span>
                    </div>
                  </>
                )}
              </div>
              {tracking.driver !== null && (
                <div className="tracking__driver">
                  <div className="tracking__driver-info">
                    <strong>{t('order.driverName')}</strong>
                    <span>{tracking.driver.name}</span>
                    <a href={`tel:${tracking.driver.phone}`} className="tracking__driver-phone">
                      {tracking.driver.phone}
                    </a>
                  </div>
                  {tracking.driverLocation !== null && (
                    <div className="tracking__location">
                      <span className="tracking__label">{t('order.driverLocation')}</span>
                      <span className="tracking__value">
                        {tracking.driverLocation.latitude.toFixed(4)},{' '}
                        {tracking.driverLocation.longitude.toFixed(4)}
                      </span>
                      <span className="tracking__updated">
                        {t('order.updatedAt', {
                          time: new Date(tracking.driverLocation.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        })}
                      </span>
                    </div>
                  )}
                  {tracking.estimatedArrivalAt !== null && (
                    <div className="tracking__eta">
                      <span className="tracking__label">{t('order.estimatedArrival')}</span>
                      <span className="tracking__value">
                        {new Date(tracking.estimatedArrivalAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {tracking.driver === null &&
                tracking.deliveryTaskStatus !== null &&
                tracking.deliveryTaskStatus !== 'delivered' && (
                  <div className="tracking__unassigned">
                    <Badge tone="warning">{t('order.driverNotAssigned')}</Badge>
                  </div>
                )}
            </div>
            <p className="page__subtitle tracking__status">
              {t('order.orderStatus', { status: t(orderStatusKey(tracking.orderStatus)) })}
            </p>
            <p className="page__subtitle tracking__task">
              {t('order.deliveryStatus', {
                status: t(deliveryStatusKey(tracking.deliveryTaskStatus)),
              })}
            </p>
          </GlassCard>
        )}
        {canCustomerCancel(order.status) && (
          <GlassCard padding="lg">
            <h2 className="section-label">{t('order.cancel')}</h2>
            <p className="page__subtitle">{t('order.cancelConfirm')}</p>
            <form onSubmit={submitCancel}>
              <TextAreaField
                label={t('order.cancel')}
                name="cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={cancelling || reason.trim().length < 3}
              >
                {t('order.cancel')}
              </Button>
            </form>
          </GlassCard>
        )}

        <Link to="/orders" className="page__subtitle">
          ← {t('nav.orders')}
        </Link>
      </div>
    </BentoContainer>
  );
}
