/**
 * Shopping cart (Part 7.1 §9, unified with the spec's multi-store rule):
 * quantity editing, removal, subtotal, and the per-store split notice.
 */

import { BentoContainer, Button, EmptyState, GlassCard, Spinner } from '@damazon/design-system';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { MinusIcon, PlusIcon, TrashIcon } from '../components/icons.js';
import { useLocale } from '../locales/locale-context.js';
import { useCart } from '../store/cart.js';

export default function CartPage(): JSX.Element {
  const { t, locale, formatMoney } = useLocale();
  const { cart, isLoading, itemCount, lastError, updateQuantity, removeItem, clear, dismissError } =
    useCart();
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);

  // Memoised so `items` keeps referential identity across renders while the
  // cart object is unchanged; otherwise `businessCount` recomputes every render.
  const items = useMemo(() => cart?.items ?? [], [cart]);

  const businessCount = useMemo(
    () => new Set(items.map((item) => item.product.businessId)).size,
    [items],
  );

  const checkout = useCallback((): void => {
    void navigate('/checkout');
  }, [navigate]);

  return (
    <BentoContainer>
      <div className="page">
        <header className="page__header">
          <h1 className="page__title">{t('cart.title')}</h1>
          {itemCount > 0 && (
            <p className="page__subtitle">
              {itemCount} {t('cart.item')}
            </p>
          )}
        </header>

        {lastError !== null && (
          <GlassCard padding="sm">
            <p className="dz-field__error" role="alert">
              {lastError}
            </p>
            <Button variant="ghost" size="sm" onClick={dismissError}>
              {t('common.close')}
            </Button>
          </GlassCard>
        )}

        {isLoading && items.length === 0 && (
          <div className="route-fallback">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <>
            <EmptyState
              title={t('cart.empty')}
              action={
                <Link to="/search">
                  <Button variant="primary">{t('cart.continueShopping')}</Button>
                </Link>
              }
            />
            <GlassCard blur="medium" transparency="light" padding="md">
              <div className="cart-summary__row">
                <span>{t('cart.subtotal')}</span>
                <span className="dz-money">{formatMoney(0n)}</span>
              </div>
              <div className="cart-summary__row">
                <span>{t('cart.deliveryFee')}</span>
                <span className="dz-money">{formatMoney(0n)}</span>
              </div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>{t('cart.total')}</span>
                <span className="dz-money">{formatMoney(0n)}</span>
              </div>
            </GlassCard>
          </>
        )}

        {items.length > 0 && (
          <>
            {businessCount > 1 && (
              <p className="page__subtitle" role="note">
                {t('cart.multiStore')}
              </p>
            )}

            <GlassCard padding="sm" className="cart-lines">
              {items.map((item) => {
                const name = locale === 'ar' ? item.product.nameAr : item.product.nameEn;
                return (
                  <div key={item.id} className="cart-line">
                    <Link to={`/product/${item.product.id}`} className="cart-line__media">
                      {item.product.imageUrl !== null ? (
                        <img src={item.product.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">{name.slice(0, 1)}</span>
                      )}
                    </Link>
                    <div className="cart-line__info">
                      <Link to={`/product/${item.product.id}`} className="cart-line__name">
                        {name}
                      </Link>
                      <span className="cart-line__meta">
                        {item.variant !== null &&
                          (locale === 'ar' ? item.variant.nameAr : item.variant.nameEn)}
                        {item.variant !== null && ' · '}
                        {formatMoney(BigInt(item.unitPriceMinor), item.product.currency)}
                      </span>
                      {!item.isPurchasable && (
                        <span className="dz-field__error">{t('cart.unavailable')}</span>
                      )}
                      <div className="cart-line__actions">
                        <div
                          className="qty-stepper qty-stepper--sm"
                          aria-label={t('cart.quantity')}
                        >
                          <button
                            type="button"
                            aria-label="−"
                            disabled={item.quantity <= 1}
                            onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                          >
                            <MinusIcon size={14} />
                          </button>
                          <span aria-live="polite">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="+"
                            disabled={
                              !item.isPurchasable ||
                              item.quantity >= Math.min(99, item.stockQuantity)
                            }
                            onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                          >
                            <PlusIcon size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={t('cart.remove')}
                          onClick={() => void removeItem(item.id)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>
                    <span className="dz-money cart-line__total">
                      {formatMoney(BigInt(item.lineTotalMinor), item.product.currency)}
                    </span>
                  </div>
                );
              })}
            </GlassCard>

            <GlassCard blur="medium" transparency="light" padding="md">
              <div className="cart-summary__row">
                <span>{t('cart.subtotal')}</span>
                <span className="dz-money">
                  {formatMoney(BigInt(cart?.subtotalMinor ?? '0'), cart?.currency ?? 'SYP')}
                </span>
              </div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>{t('cart.total')}</span>
                <span className="dz-money">
                  {formatMoney(BigInt(cart?.subtotalMinor ?? '0'), cart?.currency ?? 'SYP')}
                </span>
              </div>
              <Button
                variant="primary"
                size="lg"
                disabled={!items.some((item) => item.isPurchasable)}
                onClick={checkout}
                className="cart-checkout"
              >
                {t('cart.checkout')}
              </Button>
            </GlassCard>

            {confirmClear ? (
              <div className="zone-card__actions">
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void clear().then(() => setConfirmClear(false));
                  }}
                >
                  {t('common.confirm')}
                </Button>
              </div>
            ) : (
              <div className="load-more">
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
                  {t('cart.clear')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </BentoContainer>
  );
}
