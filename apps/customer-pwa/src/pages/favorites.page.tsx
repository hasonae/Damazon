/**
 * Saved products (Part 7.1 §15). Server-driven list; removing an item is an
 * optimistic card removal because re-fetching the whole list after every tap
 * would feel broken on a slow connection.
 */

import type { ProductSummary } from '@damazon/api-client';
import { BentoContainer, Button, EmptyState, Spinner } from '@damazon/design-system';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ProductCard } from '../components/product-card.js';
import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

export default function FavoritesPage(): JSX.Element {
  const { t } = useLocale();
  const { client } = useSession();

  const [items, setItems] = useState<readonly ProductSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await client.favorites.products());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [client, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onFavoriteChange = useCallback((productId: string, favorited: boolean): void => {
    if (!favorited) {
      setItems((current) =>
        current === null ? null : current.filter((item) => item.id !== productId),
      );
    }
  }, []);

  if (isLoading) {
    return (
      <BentoContainer>
        <div className="route-fallback">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      </BentoContainer>
    );
  }

  if (error !== null) {
    return (
      <BentoContainer>
        <div className="page">
          <header className="page__header">
            <h1 className="page__title">{t('favorites.title')}</h1>
          </header>
          <p className="dz-field__error">{error}</p>
          <Button variant="secondary" onClick={reload}>
            {t('common.retry')}
          </Button>
        </div>
      </BentoContainer>
    );
  }

  return (
    <BentoContainer>
      <div className="page">
        <header className="page__header">
          <h1 className="page__title">{t('favorites.title')}</h1>
          {items !== null && items.length > 0 && (
            <p className="page__subtitle">
              {items.length} {t('common.results')}
            </p>
          )}
        </header>

        {items === null || items.length === 0 ? (
          <EmptyState
            title={t('favorites.empty')}
            description={t('favorites.hint')}
            action={
              <Link to="/search">
                <Button variant="primary">{t('common.search')}</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid-products">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                initialFavorited
                onFavoriteChange={onFavoriteChange}
              />
            ))}
          </div>
        )}
      </div>
    </BentoContainer>
  );
}
