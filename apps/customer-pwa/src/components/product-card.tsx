/**
 * Product card used by every grid in the application (home, search, store,
 * favorites). One implementation keeps price rendering, favorite toggling,
 * and the add-to-cart affordance identical everywhere the catalogue appears.
 */

import type { ProductSummary } from '@damazon/api-client';
import { Badge, GlassCard } from '@damazon/design-system';
import { useCallback, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';
import { useCart } from '../store/cart.js';
import { useSession } from '../store/session.js';

import { CartIcon, HeartFilledIcon, HeartIcon, StarFilledIcon } from './icons.js';

export interface ProductCardProps {
  readonly product: ProductSummary;
  /** Known favorite state; cards in grids start optimistic and self-correct. */
  readonly initialFavorited?: boolean;
  readonly onFavoriteChange?: (productId: string, favorited: boolean) => void;
}

export function ProductCard({
  product,
  initialFavorited = false,
  onFavoriteChange,
}: ProductCardProps): JSX.Element {
  const { t, locale, formatMoney } = useLocale();
  const { status, client } = useSession();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const [favorited, setFavorited] = useState(initialFavorited);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const name = locale === 'ar' ? product.nameAr : product.nameEn;
  const sale = BigInt(product.salePriceMinor);
  const list = BigInt(product.priceMinor);
  const discounted = sale < list;
  const outOfStock = !product.isAvailable || product.stockQuantity <= 0;

  const toggleFavorite = useCallback(
    (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (status !== 'authenticated') {
        void navigate('/sign-in');
        return;
      }
      const next = !favorited;
      setFavorited(next);
      void (next ? client.favorites.add(product.id) : client.favorites.remove(product.id)).catch(
        () => {
          // The optimistic flip is reverted when the server disagrees.
          setFavorited(!next);
        },
      );
      onFavoriteChange?.(product.id, next);
    },
    [client, favorited, navigate, onFavoriteChange, product.id, status],
  );

  const quickAdd = useCallback(
    (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (status !== 'authenticated') {
        void navigate('/sign-in');
        return;
      }
      setAdding(true);
      void addItem(product.id, 1).then((result) => {
        setAdding(false);
        if (result !== null) {
          setAdded(true);
          window.setTimeout(() => setAdded(false), 1600);
        }
      });
    },
    [addItem, navigate, product.id, status],
  );

  return (
    <GlassCard as="article" interactive padding="sm" className="product-card">
      <Link to={`/product/${product.id}`} className="product-card__link">
        <div className="product-card__media">
          {product.imageUrl !== null ? (
            <img src={product.imageUrl} alt={name} loading="lazy" decoding="async" />
          ) : (
            <span className="product-card__placeholder" aria-hidden="true">
              {name.slice(0, 1)}
            </span>
          )}
          {discounted && (
            <Badge tone="danger" className="product-card__discount">
              −{product.discountPercent.replace(/\.00$/, '')}%
            </Badge>
          )}
          {outOfStock && (
            <Badge tone="neutral" className="product-card__stock">
              {t('product.outOfStock')}
            </Badge>
          )}
        </div>

        <div className="product-card__body">
          <span className="product-card__name">{name}</span>
          <span className="product-card__store">{product.business.name}</span>
          <div className="product-card__row">
            <span className="product-card__price">
              {formatMoney(sale, product.currency)}
              {discounted && (
                <s className="product-card__list">{formatMoney(list, product.currency)}</s>
              )}
            </span>
            {Number(product.ratingAverage) > 0 && (
              <span className="product-card__rating">
                <StarFilledIcon size={14} />
                {Number(product.ratingAverage).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        className="product-card__fav"
        aria-label={favorited ? t('favorites.remove') : t('product.favorite')}
        aria-pressed={favorited}
        onClick={toggleFavorite}
      >
        {favorited ? <HeartFilledIcon size={18} /> : <HeartIcon size={18} />}
      </button>

      <button
        type="button"
        className="product-card__add"
        aria-label={t('product.addToCart')}
        disabled={adding || outOfStock}
        onClick={quickAdd}
      >
        {added ? '✓' : <CartIcon size={18} />}
      </button>
    </GlassCard>
  );
}
