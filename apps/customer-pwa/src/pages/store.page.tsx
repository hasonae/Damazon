/**
 * Public store profile (Part 7.1 §7): cover, logo, rating, description,
 * contact, and the store's product grid with load-more.
 */

import type { ProductSummary, StoreProfile } from '@damazon/api-client';
import { ApiRequestError } from '@damazon/api-client';
import { Badge, BentoContainer, Button, GlassCard, Spinner } from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { StarFilledIcon } from '../components/icons.js';
import { ProductCard } from '../components/product-card.js';
import { useAsync } from '../hooks/index.js';
import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

interface StorePageData {
  readonly profile: StoreProfile | null;
  readonly products: readonly ProductSummary[];
  readonly hasMore: boolean;
  readonly cursor: string | null;
  readonly notFound: boolean;
}

const PAGE_SIZE = 12;

export default function StorePage(): JSX.Element {
  const { id = '' } = useParams<{ readonly id: string }>();
  const { t, formatDateTime } = useLocale();
  const { client } = useSession();

  const load = useCallback(async (): Promise<StorePageData> => {
    try {
      const [profile, products] = await Promise.all([
        client.catalog.store(id),
        client.catalog.products({ businessId: id, limit: PAGE_SIZE }),
      ]);
      return {
        profile,
        products: products.items,
        hasMore: products.meta.hasMore,
        cursor: products.meta.nextCursor,
        notFound: false,
      };
    } catch (cause) {
      return {
        profile: null,
        products: [],
        hasMore: false,
        cursor: null,
        notFound: cause instanceof ApiRequestError && cause.status === 404,
      };
    }
  }, [client, id]);

  const { data, isLoading, reload } = useAsync<StorePageData>(load, [id]);
  const [extra, setExtra] = useState<readonly ProductSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reset continuation state whenever the store (or its load) changes.
  useEffect(() => {
    setExtra([]);
    setCursor(data?.cursor ?? null);
    setHasMore(data?.hasMore ?? false);
  }, [data, id]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (cursor === null) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await client.catalog.products({ businessId: id, limit: PAGE_SIZE, cursor });
      setExtra((current) => [...current, ...page.items]);
      setCursor(page.meta.nextCursor);
      setHasMore(page.meta.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [client, cursor, id]);

  if (isLoading) {
    return (
      <BentoContainer>
        <div className="route-fallback">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      </BentoContainer>
    );
  }

  const profile = data?.profile ?? null;

  if (profile === null) {
    return (
      <BentoContainer>
        <div className="page">
          <GlassCard padding="lg" className="product-missing">
            <h1 className="page__title">
              {data?.notFound === true ? t('store.notFound') : t('common.error')}
            </h1>
            {data?.notFound !== true && (
              <Button variant="secondary" onClick={reload}>
                {t('common.retry')}
              </Button>
            )}
          </GlassCard>
        </div>
      </BentoContainer>
    );
  }

  const products = [...(data?.products ?? []), ...extra];

  return (
    <BentoContainer>
      <div className="page">
        <section className="store-hero" aria-label={profile.name}>
          <GlassCard padding="lg" className="store-hero__card">
            <div className="store-hero__row">
              <span className="store-hero__logo" aria-hidden="true">
                {profile.logoUrl !== null ? (
                  <img src={profile.logoUrl} alt="" />
                ) : (
                  profile.name.slice(0, 1)
                )}
              </span>
              <div>
                <h1 className="page__title">{profile.name}</h1>
                <div className="product-detail__meta">
                  {Number(profile.ratingAverage) > 0 && (
                    <Badge tone="accent">
                      <StarFilledIcon size={13} /> {Number(profile.ratingAverage).toFixed(1)} (
                      {profile.ratingCount})
                    </Badge>
                  )}
                  {profile.city !== null && <Badge tone="neutral">{profile.city}</Badge>}
                </div>
              </div>
            </div>
            {profile.description !== null && profile.description.length > 0 && (
              <p className="page__subtitle">{profile.description}</p>
            )}
            <span className="page__subtitle">
              {t('store.joined')} {formatDateTime(profile.createdAt)}
            </span>
            <div className="store-hero__actions">
              <a href={`tel:${profile.phone}`}>
                <Button variant="secondary" size="sm">
                  {t('store.contact')}: <span dir="ltr">{profile.phone}</span>
                </Button>
              </a>
            </div>
          </GlassCard>
        </section>

        <section aria-label={t('store.products')}>
          <h2 className="section-label">
            {t('store.products')} · {profile.productCount}
          </h2>
          {products.length === 0 ? (
            <GlassCard padding="lg">
              <span className="page__subtitle">{t('store.noProducts')}</span>
            </GlassCard>
          ) : (
            <div className="grid-products">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          {hasMore && (
            <div className="load-more">
              <Button variant="secondary" disabled={loadingMore} onClick={loadMore}>
                {t('common.loadMore')}
              </Button>
            </div>
          )}
        </section>
      </div>
    </BentoContainer>
  );
}
