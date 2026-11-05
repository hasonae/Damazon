import {
  ApiRequestError,
  type BusinessNotification,
  type BusinessProductView,
  type BusinessSummary,
  type OrderSummary,
} from '@damazon/api-client';
import {
  Badge,
  BentoContainer,
  Button,
  EmptyState,
  GlassCard,
  Spinner,
  TextField,
} from '@damazon/design-system';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';
import { orderStatusKey, orderStatusTone } from '../utils/order-labels.js';

export default function MerchantPage(): JSX.Element {
  const { t, formatDateTime, formatMoney } = useLocale();
  const { activeBusinessId, client } = useSession();
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [orders, setOrders] = useState<readonly OrderSummary[]>([]);
  const [products, setProducts] = useState<readonly BusinessProductView[]>([]);
  const [notifications, setNotifications] = useState<readonly BusinessNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productNameAr, setProductNameAr] = useState('');
  const [productNameEn, setProductNameEn] = useState('');
  const [productSku, setProductSku] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('1');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      client.http.clearCache('businesses:');
      const [businesses, subscriptionNotifications] = await Promise.all([
        client.businesses.mine(),
        client.businesses.subscriptionNotifications(),
      ]);
      setNotifications(subscriptionNotifications);
      const activeBusiness = businesses.find((entry) => entry.id === activeBusinessId) ?? null;
      setBusiness(activeBusiness);
      if (activeBusiness === null || activeBusiness.status !== 'ACTIVE') {
        setOrders([]);
        setProducts([]);
        return;
      }
      const [page, businessProducts] = await Promise.all([
        client.orders.listBusiness({ limit: 50 }),
        client.businesses.products(activeBusiness.id),
      ]);
      setOrders(page.items);
      setProducts(businessProducts);
    } catch {
      setError(t('business.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [activeBusinessId, client, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateStatus = useCallback(
    async (orderId: string, status: 'preparing' | 'ready'): Promise<void> => {
      setUpdatingOrderId(orderId);
      setError(null);
      try {
        await client.orders.updateBusinessStatus(orderId, status);
        await reload();
      } catch {
        setError(t('business.loadFailed'));
      } finally {
        setUpdatingOrderId(null);
      }
    },
    [client, reload, t],
  );

  const createProduct = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (business === null) return;
      setSavingProduct(true);
      setError(null);
      try {
        await client.businesses.createProduct(business.id, {
          sku: productSku.trim(),
          nameAr: productNameAr.trim(),
          nameEn: productNameEn.trim(),
          priceMinor: Number(productPrice),
          stockQuantity: Number(productStock),
          imageUrls: [productImageUrl.trim()],
          status: 'draft',
        });
        setProductNameAr('');
        setProductNameEn('');
        setProductSku('');
        setProductPrice('');
        setProductStock('1');
        setProductImageUrl('');
        await reload();
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError ? cause.message : t('business.productSaveFailed'),
        );
      } finally {
        setSavingProduct(false);
      }
    },
    [
      business,
      client,
      productImageUrl,
      productNameAr,
      productNameEn,
      productPrice,
      productSku,
      productStock,
      reload,
      t,
    ],
  );

  const toggleProductStatus = useCallback(
    async (product: BusinessProductView): Promise<void> => {
      if (business === null) return;
      setError(null);
      try {
        await client.businesses.updateProduct(business.id, product.id, {
          status: product.status === 'active' ? 'draft' : 'active',
        });
        await reload();
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError ? cause.message : t('business.productSaveFailed'),
        );
      }
    },
    [business, client, reload, t],
  );

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
          <h1 className="page__title">{t('business.orders')}</h1>
          <Button variant="secondary" onClick={() => void reload()}>
            {t('common.retry')}
          </Button>
        </header>

        {notifications.map((notification) => (
          <GlassCard key={notification.id} padding="md">
            <Badge tone="warning">{notification.title}</Badge>
            <p className="page__subtitle">{notification.body}</p>
          </GlassCard>
        ))}

        {business !== null && (
          <GlassCard padding="md">
            <div className="order-card__head">
              <strong>{business.name}</strong>
              <Badge tone={business.status === 'ACTIVE' ? 'success' : 'warning'}>
                {business.status === 'ACTIVE'
                  ? t('business.active')
                  : business.status === 'SUSPENDED'
                    ? t('business.subscriptionSuspended')
                    : business.verificationStatus !== 'APPROVED'
                      ? t('business.notApproved')
                      : t('business.awaitingSubscription')}
              </Badge>
            </div>
            {business.status === 'SUSPENDED' ? (
              <p className="page__subtitle">{t('business.subscriptionSuspended')}</p>
            ) : business.verificationStatus !== 'APPROVED' ? (
              <p className="page__subtitle">{t('business.notApproved')}</p>
            ) : business.status !== 'ACTIVE' ? (
              <p className="page__subtitle">{t('business.awaitingSubscription')}</p>
            ) : null}
            {business.subscription !== null && (
              <p className="page__subtitle">
                {business.subscription.status === 'pending'
                  ? t('business.subscriptionPending')
                  : `${t('business.subscriptionUntil')} ${formatDateTime(business.subscription.periodEnd)}`}
              </p>
            )}
            <p className="page__subtitle">{t('business.subscriptionPrice')}</p>
          </GlassCard>
        )}

        {error !== null && (
          <GlassCard padding="md">
            <p className="dz-field__error" role="alert">
              {error}
            </p>
          </GlassCard>
        )}

        {business !== null && business.status === 'ACTIVE' && (
          <section aria-labelledby="merchant-products-heading">
            <h2 className="page__title" id="merchant-products-heading">
              {t('business.products')}
            </h2>
            <GlassCard padding="md">
              <form className="auth-card__form" onSubmit={(event) => void createProduct(event)}>
                <TextField
                  label={t('business.productNameAr')}
                  name="nameAr"
                  required
                  minLength={2}
                  maxLength={200}
                  value={productNameAr}
                  onChange={(event) => setProductNameAr(event.target.value)}
                />
                <TextField
                  label={t('business.productNameEn')}
                  name="nameEn"
                  required
                  minLength={2}
                  maxLength={200}
                  value={productNameEn}
                  onChange={(event) => setProductNameEn(event.target.value)}
                />
                <TextField
                  label={t('business.productSku')}
                  name="sku"
                  required
                  maxLength={64}
                  value={productSku}
                  onChange={(event) => setProductSku(event.target.value)}
                />
                <TextField
                  label={t('business.productPrice')}
                  name="priceMinor"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={productPrice}
                  onChange={(event) => setProductPrice(event.target.value)}
                />
                <TextField
                  label={t('business.productStock')}
                  name="stockQuantity"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={productStock}
                  onChange={(event) => setProductStock(event.target.value)}
                />
                <TextField
                  label={t('business.productImageUrl')}
                  name="imageUrl"
                  type="url"
                  required
                  value={productImageUrl}
                  onChange={(event) => setProductImageUrl(event.target.value)}
                />
                <Button type="submit" loading={savingProduct}>
                  {t('business.productAdd')}
                </Button>
              </form>
            </GlassCard>
            {products.length === 0 ? (
              <EmptyState title={t('business.productEmpty')} />
            ) : (
              products.map((product) => (
                <GlassCard key={product.id} padding="md">
                  <div className="order-card__head">
                    <div>
                      <strong>{product.nameAr}</strong>
                      <span className="page__subtitle" dir="ltr">
                        {product.nameEn} · {product.sku}
                      </span>
                    </div>
                    <Badge tone={product.status === 'active' ? 'success' : 'warning'}>
                      {t(`business.productStatus.${product.status}`)}
                    </Badge>
                  </div>
                  <div className="cart-summary__row">
                    <span>{formatMoney(BigInt(product.priceMinor), product.currency)}</span>
                    <span>{product.stockQuantity}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void toggleProductStatus(product)}
                  >
                    {t(
                      product.status === 'active'
                        ? 'business.productUnpublish'
                        : 'business.productPublish',
                    )}
                  </Button>
                </GlassCard>
              ))
            )}
          </section>
        )}

        {business === null ? (
          <EmptyState title={t('business.noActiveBusiness')} />
        ) : business.status !== 'ACTIVE' ? null : orders.length === 0 ? (
          <EmptyState title={t('business.noOrders')} />
        ) : (
          orders.map((order) => (
            <GlassCard key={order.id} padding="md" className="order-card">
              <div className="order-card__head">
                <div>
                  <strong dir="ltr">{order.orderNumber}</strong>
                  <span className="page__subtitle">{formatDateTime(order.createdAt)}</span>
                </div>
                <Badge tone={orderStatusTone(order.status)}>
                  {t(orderStatusKey(order.status))}
                </Badge>
              </div>
              <div className="cart-summary__row">
                <span>
                  {t('order.items')} · {order.itemCount}
                </span>
                <strong className="dz-money">
                  {formatMoney(BigInt(order.totalMinor), order.currency)}
                </strong>
              </div>
              <div className="role-switcher">
                {order.status === 'confirmed' && (
                  <Button
                    size="sm"
                    loading={updatingOrderId === order.id}
                    onClick={() => void updateStatus(order.id, 'preparing')}
                  >
                    {t('business.markPreparing')}
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button
                    size="sm"
                    loading={updatingOrderId === order.id}
                    onClick={() => void updateStatus(order.id, 'ready')}
                  >
                    {t('business.markReady')}
                  </Button>
                )}
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </BentoContainer>
  );
}
