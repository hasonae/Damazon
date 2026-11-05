/**
 * Order history (Part 5.2): the customer's orders with status badges,
 * totals, and links into the tracking timeline.
 */

import type { OrderSummary } from '@damazon/api-client';
import {
  Badge,
  BentoContainer,
  Button,
  EmptyState,
  GlassCard,
  Spinner,
} from '@damazon/design-system';
import { isOrderStatus, orderProgressPercent } from '@damazon/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';
import { orderStatusKey, orderStatusTone } from '../utils/order-labels.js';

export default function OrdersPage(): JSX.Element {
  const { t, formatMoney, formatDateTime } = useLocale();
  const { client } = useSession();

  const [orders, setOrders] = useState<readonly OrderSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setCursor(null);
    setHasMore(false);
    try {
      const page = await client.orders.list({ limit: 30 });
      setOrders(page.items);
      setCursor(page.meta.nextCursor);
      setHasMore(page.meta.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [client, t]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (cursor === null || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);
    try {
      const page = await client.orders.list({ limit: 30, cursor });
      setOrders((current) => [...(current ?? []), ...page.items]);
      setCursor(page.meta.nextCursor);
      setHasMore(page.meta.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.error'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [client, cursor, isLoadingMore, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (isLoading) {
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
          <h1 className="page__title">{t('nav.orders')}</h1>
        </header>

        {error !== null && (
          <GlassCard padding="lg">
            <p className="dz-field__error">{error}</p>
            <Button
              variant="secondary"
              onClick={orders === null ? reload : loadMore}
              disabled={isLoadingMore}
            >
              {t('common.retry')}
            </Button>
          </GlassCard>
        )}

        {error === null && orders !== null && orders.length === 0 && (
          <EmptyState
            title={t('order.empty')}
            action={
              <Link to="/search">
                <Button variant="primary">{t('cart.continueShopping')}</Button>
              </Link>
            }
          />
        )}

        {orders !== null &&
          orders.map((order) => (
            <Link key={order.id} to={`/orders/${order.id}`} className="order-card-link">
              <GlassCard padding="md" interactive className="order-card">
                <div className="order-card__head">
                  <div>
                    <strong dir="ltr">{order.orderNumber}</strong>
                    <span className="page__subtitle">
                      {order.business.name} · {formatDateTime(order.createdAt)}
                    </span>
                  </div>
                  <Badge tone={orderStatusTone(order.status)}>
                    {t(orderStatusKey(order.status))}
                  </Badge>
                </div>
                <div className="order-card__progress">
                  {isOrderStatus(order.status) && (
                    <span
                      className="order-card__bar"
                      style={{ width: `${orderProgressPercent(order.status)}%` }}
                    />
                  )}
                </div>
                <div className="cart-summary__row">
                  <span>
                    {t('order.items')} · {order.itemCount}
                  </span>
                  <span className="dz-money">
                    {formatMoney(BigInt(order.totalMinor), order.currency)}
                  </span>
                </div>
              </GlassCard>
            </Link>
          ))}

        {hasMore && orders !== null && orders.length > 0 && (
          <div className="load-more">
            <Button variant="secondary" disabled={isLoadingMore} onClick={loadMore}>
              {isLoadingMore ? t('common.loading') : t('common.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </BentoContainer>
  );
}
