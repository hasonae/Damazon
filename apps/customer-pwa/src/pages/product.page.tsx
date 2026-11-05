/**
 * Product details (Part 7.1 §8): gallery, price, stock, variants, seller,
 * quantity, add to cart, favorite toggle, and related products. Public route
 * — guests see the page and are sent to sign-in only when they try to buy.
 */

import type { ProductDetail, ProductSummary } from '@damazon/api-client';
import { ApiRequestError } from '@damazon/api-client';
import { Badge, BentoContainer, Button, GlassCard, Spinner } from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  HeartFilledIcon,
  HeartIcon,
  MinusIcon,
  PlusIcon,
  StarFilledIcon,
} from '../components/icons.js';
import { ProductCard } from '../components/product-card.js';
import { useAsync } from '../hooks/index.js';
import { useLocale } from '../locales/locale-context.js';
import { useCart } from '../store/cart.js';
import { useSession } from '../store/session.js';

interface ProductPageData {
  readonly product: ProductDetail | null;
  readonly related: readonly ProductSummary[];
  readonly notFound: boolean;
}

export default function ProductPage(): JSX.Element {
  const { id = '' } = useParams<{ readonly id: string }>();
  const { t, locale, formatMoney } = useLocale();
  const { status, client } = useSession();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const load = useCallback(async (): Promise<ProductPageData> => {
    try {
      const product = await client.catalog.product(id);
      // Related products are best-effort: a failure here must not fail the page.
      const related =
        product.category === null
          ? null
          : await client.catalog
              .products({ categoryId: product.category.id, limit: 5 })
              .catch(() => null);
      return {
        product,
        related: (related?.items ?? []).filter((item) => item.id !== id).slice(0, 4),
        notFound: false,
      };
    } catch (cause) {
      return {
        product: null,
        related: [],
        notFound: cause instanceof ApiRequestError && cause.status === 404,
      };
    }
  }, [client, id]);

  const { data, isLoading, reload } = useAsync<ProductPageData>(load, [id]);

  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [favorited, setFavorited] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Known favorite state: the list is small and cached, one read on mount.
  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    let cancelled = false;
    void client.favorites
      .products()
      .then((items) => {
        if (!cancelled) {
          setFavorited(items.some((item) => item.id === id));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, id, status]);

  useEffect(() => {
    setQuantity(1);
    setVariantId(undefined);
  }, [id]);

  const product = data?.product ?? null;

  const toggleFavorite = useCallback((): void => {
    if (status !== 'authenticated') {
      void navigate('/sign-in');
      return;
    }
    const next = !favorited;
    setFavorited(next);
    void (next ? client.favorites.add(id) : client.favorites.remove(id)).catch(() => {
      setFavorited(!next);
    });
  }, [client, favorited, id, status, navigate]);

  const addToCart = useCallback((): void => {
    if (status !== 'authenticated') {
      void navigate('/sign-in');
      return;
    }
    setAdding(true);
    void addItem(id, quantity, variantId).then((result) => {
      setAdding(false);
      if (result !== null) {
        setAdded(true);
        setBanner(null);
        window.setTimeout(() => setAdded(false), 1800);
      } else {
        setBanner(t('product.unavailable'));
      }
    });
  }, [addItem, id, quantity, status, navigate, variantId, t]);

  if (isLoading) {
    return (
      <BentoContainer>
        <div className="route-fallback">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      </BentoContainer>
    );
  }

  if (product === null) {
    return (
      <BentoContainer>
        <div className="page">
          <GlassCard padding="lg" className="product-missing">
            <h1 className="page__title">
              {data?.notFound === true ? t('product.notFound') : t('common.error')}
            </h1>
            {data?.notFound !== true && (
              <Button variant="secondary" onClick={reload}>
                {t('common.retry')}
              </Button>
            )}
            <Link to="/">
              <Button variant="ghost">{t('nav.home')}</Button>
            </Link>
          </GlassCard>
        </div>
      </BentoContainer>
    );
  }

  const name = locale === 'ar' ? product.nameAr : product.nameEn;
  const sale = BigInt(product.salePriceMinor);
  const list = BigInt(product.priceMinor);
  const discounted = sale < list;
  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const stock =
    selectedVariant === undefined ? product.stockQuantity : selectedVariant.stockQuantity;
  const purchasable =
    product.isAvailable &&
    stock > 0 &&
    (selectedVariant === undefined || selectedVariant.isAvailable);
  const maxQuantity = Math.min(99, Math.max(stock, 1));

  return (
    <BentoContainer>
      <div className="page">
        <article className="product-detail">
          <div className="product-detail__media">
            {product.images.length > 0 ? (
              <img src={product.images[0]} alt={name} decoding="async" />
            ) : (
              <span className="product-detail__placeholder" aria-hidden="true">
                {name.slice(0, 1)}
              </span>
            )}
            {product.images.length > 1 && (
              <div className="product-detail__thumbs">
                {product.images.slice(0, 5).map((image) => (
                  <img key={image} src={image} alt="" loading="lazy" decoding="async" />
                ))}
              </div>
            )}
          </div>

          <div className="product-detail__info">
            <header className="product-detail__head">
              <h1 className="page__title">{name}</h1>
              <button
                type="button"
                className="product-detail__fav"
                aria-pressed={favorited}
                aria-label={favorited ? t('favorites.remove') : t('product.favorite')}
                onClick={toggleFavorite}
              >
                {favorited ? <HeartFilledIcon /> : <HeartIcon />}
              </button>
            </header>

            <div className="product-detail__meta">
              {Number(product.ratingAverage) > 0 && (
                <Badge tone="accent">
                  <StarFilledIcon size={13} /> {Number(product.ratingAverage).toFixed(1)} (
                  {product.ratingCount})
                </Badge>
              )}
              <Badge tone={purchasable ? 'success' : 'danger'}>
                {purchasable ? t('product.inStock') : t('product.outOfStock')}
              </Badge>
              {product.category !== null && (
                <Link
                  to={`/search?categoryId=${product.category.id}`}
                  className="product-detail__category"
                >
                  {locale === 'ar' ? product.category.nameAr : product.category.nameEn}
                </Link>
              )}
            </div>

            <div className="product-detail__price">
              <span className="product-detail__sale">{formatMoney(sale, product.currency)}</span>
              {discounted && (
                <>
                  <s>{formatMoney(list, product.currency)}</s>
                  <Badge tone="danger">−{product.discountPercent.replace(/\.00$/, '')}%</Badge>
                </>
              )}
            </div>

            {/* Seller trust: the customer always knows who sells the product. */}
            <Link to={`/store/${product.business.id}`} className="product-detail__store">
              <span className="page__subtitle">{t('product.soldBy')}</span>
              <strong>{product.business.name}</strong>
            </Link>

            {product.variants.length > 0 && (
              <fieldset className="product-detail__variants">
                <legend className="section-label">{t('product.variants')}</legend>
                <div className="chip-row" role="radiogroup" aria-label={t('product.variants')}>
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={variantId === variant.id}
                      disabled={!variant.isAvailable}
                      className={variantId === variant.id ? 'chip chip--active' : 'chip'}
                      onClick={() => {
                        setVariantId((current) =>
                          current === variant.id ? undefined : variant.id,
                        );
                        setQuantity(1);
                      }}
                    >
                      {locale === 'ar' ? variant.nameAr : variant.nameEn}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {product.description !== null && product.description.length > 0 && (
              <div className="product-detail__description">
                <h2 className="section-label">{t('product.description')}</h2>
                <p className="page__subtitle">{product.description}</p>
              </div>
            )}

            <span className="product-detail__sku">
              {t('product.sku')}: {product.sku}
            </span>

            {banner !== null && (
              <p className="dz-field__error" role="alert">
                {banner}
              </p>
            )}

            <div className="product-detail__actions">
              <div className="qty-stepper" aria-label={t('cart.quantity')}>
                <button
                  type="button"
                  aria-label="−"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                >
                  <MinusIcon size={16} />
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  aria-label="+"
                  disabled={quantity >= maxQuantity || !purchasable}
                  onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                >
                  <PlusIcon size={16} />
                </button>
              </div>
              <Button
                variant="primary"
                size="lg"
                disabled={adding || !purchasable}
                onClick={addToCart}
                className="product-detail__add"
              >
                {added ? t('product.addedToCart') : t('product.addToCart')}
              </Button>
            </div>
          </div>
        </article>

        {data?.related != null && data.related.length > 0 && (
          <section aria-label={t('product.related')}>
            <h2 className="section-label">{t('product.related')}</h2>
            <div className="grid-products">
              {data.related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </BentoContainer>
  );
}
