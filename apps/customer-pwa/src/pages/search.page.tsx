/**
 * Search (Part 5.2): keyword, category and store search with filters,
 * sorting, recent terms, and cursor pagination. The query lives in the URL
 * (`?q=`, `?categoryId=`) so home categories and product links deep-link
 * into a real results list instead of an empty box.
 */

import type { CategoryNode, ProductSort, ProductSummary } from '@damazon/api-client';
import {
  BentoContainer,
  Button,
  EmptyState,
  GlassCard,
  SelectField,
  Skeleton,
  Spinner,
  TextField,
} from '@damazon/design-system';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ProductCard } from '../components/product-card.js';
import { useAsync } from '../hooks/index.js';
import { useLocale } from '../locales/locale-context.js';
import {
  browserOfflineStore,
  clearRecentSearches,
  readRecentSearches,
  recordRecentSearches,
} from '../services/offline-store.js';
import { useSession } from '../store/session.js';

export default function SearchPage(): JSX.Element {
  const { t, locale } = useLocale();
  const { client } = useSession();
  const [params, setParams] = useSearchParams();

  const initialQ = params.get('q') ?? '';
  const initialCategory = params.get('categoryId') ?? '';

  const [term, setTerm] = useState(initialQ);
  const [sort, setSort] = useState<ProductSort>('newest');
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [recent, setRecent] = useState<readonly string[]>(() =>
    readRecentSearches(browserOfflineStore),
  );
  const [results, setResults] = useState<readonly ProductSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounce = useRef<number | undefined>(undefined);

  const loadCategories = useCallback(
    () => client.catalog.categories().catch((): readonly CategoryNode[] => []),
    [client],
  );
  const { data: categories } = useAsync(loadCategories, []);

  const runSearch = useCallback(
    async (q: string, category: string, order: ProductSort, append: boolean): Promise<void> => {
      if (append) {
        setLoadingMore(true);
      } else {
        setSearching(true);
        setSearchError(null);
      }
      try {
        const page = await client.catalog.products({
          q: q.trim().length > 0 ? q.trim() : undefined,
          categoryId: category.length > 0 ? category : undefined,
          sort: order,
          limit: 12,
          cursor: append ? (cursor ?? undefined) : undefined,
        });
        if (q.trim().length > 0) {
          setRecent(recordRecentSearches(browserOfflineStore, q.trim()));
        }
        setResults((current) => (append ? [...(current ?? []), ...page.items] : page.items));
        setCursor(page.meta.nextCursor);
        setHasMore(page.meta.hasMore);
      } catch (cause) {
        if (!append) {
          setResults(null);
          setSearchError(cause instanceof Error ? cause.message : t('common.error'));
        }
      } finally {
        setSearching(false);
        setLoadingMore(false);
      }
    },
    [client, cursor, t],
  );

  // The initial view (deep link from home, or an empty browse) searches once.
  useEffect(() => {
    void runSearch(initialQ, initialCategory, 'newest', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const next = new URLSearchParams();
      if (term.trim().length > 0) next.set('q', term.trim());
      if (categoryId.length > 0) next.set('categoryId', categoryId);
      setParams(next, { replace: true });
      if (debounce.current !== undefined) {
        window.clearTimeout(debounce.current);
      }
      void runSearch(term, categoryId, sort, false);
    },
    [term, categoryId, sort, setParams, runSearch],
  );

  const onTermChange = useCallback(
    (value: string): void => {
      setTerm(value);
      if (debounce.current !== undefined) {
        window.clearTimeout(debounce.current);
      }
      // Instant search: the request fires once typing pauses.
      debounce.current = window.setTimeout(() => {
        void runSearch(value, categoryId, sort, false);
      }, 450);
    },
    [categoryId, runSearch, sort],
  );

  const categoryOptions = [{ value: '', label: t('common.viewAll') }];
  for (const category of categories ?? []) {
    categoryOptions.push({
      value: category.id,
      label: locale === 'ar' ? category.nameAr : category.nameEn,
    });
  }

  return (
    <BentoContainer>
      <div className="page">
        <header className="page__header">
          <h1 className="page__title">{t('nav.search')}</h1>
        </header>

        <GlassCard blur="medium" transparency="light" padding="md">
          <form className="search-form" onSubmit={onSubmit} role="search">
            <TextField
              label={t('search.placeholder')}
              name="q"
              type="search"
              value={term}
              onChange={(event) => onTermChange(event.target.value)}
            />
            <div className="search-form__filters">
              <SelectField
                label={t('home.categories')}
                name="category"
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  void runSearch(term, event.target.value, sort, false);
                }}
                options={categoryOptions}
              />
              <SelectField
                label={t('common.more')}
                name="sort"
                value={sort}
                onChange={(event) => {
                  const next = event.target.value as ProductSort;
                  setSort(next);
                  void runSearch(term, categoryId, next, false);
                }}
                options={[
                  { value: 'newest', label: t('home.newArrivals') },
                  { value: 'price_asc', label: '↑' },
                  { value: 'price_desc', label: '↓' },
                  { value: 'rating', label: t('home.trending') },
                ]}
              />
            </div>
          </form>
        </GlassCard>

        {recent.length > 0 && (
          <div className="search-recent">
            <span className="section-label">{t('search.recent')}</span>
            <div className="chip-row">
              {recent.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setTerm(entry);
                    void runSearch(entry, categoryId, sort, false);
                  }}
                >
                  {entry}
                </button>
              ))}
              <button
                type="button"
                className="chip chip--ghost"
                onClick={() => {
                  clearRecentSearches(browserOfflineStore);
                  setRecent([]);
                }}
              >
                {t('search.clearRecent')}
              </button>
            </div>
          </div>
        )}

        {searching && (
          <div className="route-fallback">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        )}

        {!searching && searchError !== null && (
          <GlassCard padding="lg">
            <p className="dz-field__error">{searchError}</p>
            <Button
              variant="secondary"
              onClick={() => void runSearch(term, categoryId, sort, false)}
            >
              {t('common.retry')}
            </Button>
          </GlassCard>
        )}

        {!searching && searchError === null && results !== null && results.length === 0 && (
          <EmptyState
            title={t('search.noResults')}
            action={
              <Link to="/">
                <Button variant="secondary">{t('nav.home')}</Button>
              </Link>
            }
          />
        )}

        {!searching && results !== null && results.length > 0 && (
          <>
            <p className="page__subtitle">
              {results.length} {t('common.results')}
            </p>
            <div className="grid-products">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {hasMore && (
              <div className="load-more">
                <Button
                  variant="secondary"
                  disabled={loadingMore}
                  onClick={() => void runSearch(term, categoryId, sort, true)}
                >
                  {t('common.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}

        {!searching && results === null && searchError === null && (
          <div className="grid-products">
            {Array.from({ length: 6 }, (_, index) => (
              <GlassCard key={index} padding="sm">
                <Skeleton height="9rem" radius="md" />
                <Skeleton height="1rem" radius="md" />
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </BentoContainer>
  );
}
