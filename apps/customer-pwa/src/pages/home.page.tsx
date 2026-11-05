/**
 * Customer home.
 *
 * Part 7.1 §4: location selector, search, promotional hero, categories,
 * and product sections. Catalog data comes from the API when it is
 * reachable and degrades to a labelled state when it is not, so a
 * flaky connection never renders a broken screen.
 */

import type { Advertisement, CategoryNode, ProductSummary } from '@damazon/api-client';
import {
  BentoCard,
  BentoContainer,
  BentoHero,
  BentoSection,
  Button,
  Skeleton,
} from '@damazon/design-system';
import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { CategoryIcon, PinIcon, SearchIcon, type CategoryIconKind } from '../components/icons.js';
import { ProductCard } from '../components/product-card.js';
import { useAsync } from '../hooks/index.js';
import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

interface HomeData {
  readonly categories: readonly CategoryNode[] | null;
  readonly products: readonly ProductSummary[] | null;
  readonly advertisements: readonly Advertisement[] | null;
}

/** Static fallback shown only when the catalog API cannot be reached. */
const FALLBACK_CATEGORY_KEYS = [
  'home.categories.restaurants',
  'home.categories.grocery',
  'home.categories.supermarket',
  'home.categories.pharmacy',
  'home.categories.bakery',
  'home.categories.electronics',
  'home.categories.home',
  'home.categories.services',
] as const;

function categoryIconKind(slug: string, nameAr: string, nameEn: string): CategoryIconKind {
  const category = `${slug} ${nameAr} ${nameEn}`.toLocaleLowerCase();
  if (/restaurant|food|مطعم|طعام|وجبات/.test(category)) return 'restaurant';
  if (/pharmacy|medical|health|صيدل|دواء|طبي/.test(category)) return 'pharmacy';
  if (/bakery|bake|مخبز|مخبوز/.test(category)) return 'bakery';
  if (/electronic|phone|laptop|computer|إلكترون|هاتف|حاسوب/.test(category)) {
    return 'electronics';
  }
  if (/fashion|clothing|apparel|أزياء|ملابس/.test(category)) return 'fashion';
  if (/home|kitchen|furniture|منزل|مطبخ|أثاث/.test(category)) return 'home';
  if (/service|repair|خدمات|خدمة/.test(category)) return 'services';
  return 'shopping';
}

export default function HomePage(): JSX.Element {
  const { t, locale } = useLocale();
  const { status, user, client } = useSession();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  const load = useCallback(async (): Promise<HomeData> => {
    const [categories, products, advertisements] = await Promise.all([
      client.catalog.categories().catch(() => null),
      client.catalog.products({ sort: 'newest', limit: 8 }).catch(() => null),
      client.catalog.advertisements().catch(() => null),
    ]);
    return {
      categories,
      products: products === null ? null : products.items,
      advertisements,
    };
  }, [client]);

  const { data, isLoading, error, reload } = useAsync(load, []);

  const submitSearch = useCallback(
    (event: FormEvent): void => {
      event.preventDefault();
      const query = term.trim();
      void navigate(query.length > 0 ? `/search?q=${encodeURIComponent(query)}` : '/search');
    },
    [navigate, term],
  );

  const topCategories = data?.categories?.slice(0, 8) ?? null;

  return (
    <BentoContainer>
      <div className="page">
        {/* Location + search header: the two actions a shopping session
            always starts with (Part 5.2, home screen components). */}
        <div className="home-header">
          <Link to="/zones" className="home-header__zone">
            <PinIcon size={18} />
            <span>
              <small>{t('home.deliverTo')}</small>
              {status === 'authenticated' && user !== null ? user.firstName : t('zone.choose')}
            </span>
          </Link>
          <form role="search" className="home-header__search" onSubmit={submitSearch}>
            <SearchIcon size={18} />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
            />
          </form>
        </div>

        <BentoHero minHeight="sm" overlayStrength="light" align="start" className="home-hero">
          <div className="home-hero__layout">
            <div className="home-hero__copy">
              <h1 className="page__title">{t('home.greeting')}</h1>
              <p className="page__subtitle">
                {status === 'authenticated' && user !== null
                  ? `${user.firstName} ${user.lastName}`
                  : t('app.tagline')}
              </p>
              <Link to="/search">
                <Button variant="primary" size="sm">
                  {t('common.search')}
                </Button>
              </Link>
            </div>
            <img className="home-hero__logo" src="/pwa-512.png" alt="" width="144" height="144" />
          </div>
        </BentoHero>

        {/* Damazon Point is a headline feature, not a settings page. */}
        <BentoCard columns={4} surface="gradient" padding="md" className="home-zone">
          <div>
            <strong>{t('home.zoneShortcut')}</strong>
            <span className="page__subtitle">{t('zones.hint')}</span>
          </div>
          <Link to="/zones">
            <Button variant="secondary" size="sm">
              {t('home.manageZones')}
            </Button>
          </Link>
        </BentoCard>

        {data?.advertisements !== null &&
          data?.advertisements !== undefined &&
          data.advertisements.length > 0 && (
            <BentoSection title={t('home.advertisements')} columns={2}>
              {data.advertisements.map((advertisement) => (
                <BentoCard
                  key={advertisement.id}
                  columns={1}
                  surface="glass"
                  padding="sm"
                  className="home-advertisement-card"
                >
                  {advertisement.targetUrl === null ? (
                    <div className="home-advertisement">
                      <img src={advertisement.imageUrl} alt={advertisement.title} loading="lazy" />
                      <strong>{advertisement.title}</strong>
                      {advertisement.caption !== null && (
                        <span className="page__subtitle">{advertisement.caption}</span>
                      )}
                    </div>
                  ) : (
                    <a
                      className="home-advertisement"
                      href={advertisement.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img src={advertisement.imageUrl} alt={advertisement.title} loading="lazy" />
                      <strong>{advertisement.title}</strong>
                      {advertisement.caption !== null && (
                        <span className="page__subtitle">{advertisement.caption}</span>
                      )}
                    </a>
                  )}
                </BentoCard>
              ))}
            </BentoSection>
          )}

        <BentoSection title={t('home.categories')} columns={4} className="home-categories">
          {isLoading &&
            Array.from({ length: 8 }, (_, index) => (
              <BentoCard
                key={index}
                columns={1}
                surface="glass"
                interactive
                padding="sm"
                className="home-category-card"
              >
                <Skeleton height="2.75rem" radius="full" />
                <Skeleton height="1rem" radius="md" />
              </BentoCard>
            ))}

          {topCategories !== null &&
            topCategories.map((category) => (
              <BentoCard
                key={category.id}
                columns={1}
                surface="glass"
                interactive
                padding="sm"
                className="home-category-card"
              >
                <Link to={`/search?categoryId=${category.id}`} className="home-category">
                  <span className="home-category__icon" aria-hidden="true">
                    <CategoryIcon
                      kind={categoryIconKind(category.slug, category.nameAr, category.nameEn)}
                      size={23}
                    />
                  </span>
                  <span>{locale === 'ar' ? category.nameAr : category.nameEn}</span>
                </Link>
              </BentoCard>
            ))}

          {topCategories === null &&
            !isLoading &&
            FALLBACK_CATEGORY_KEYS.map((key) => {
              const label = t(key);
              const slug = key.split('.').at(-1) ?? '';
              return (
                <BentoCard
                  key={key}
                  columns={1}
                  surface="glass"
                  interactive
                  padding="sm"
                  className="home-category-card"
                >
                  <span className="home-category">
                    <span className="home-category__icon" aria-hidden="true">
                      <CategoryIcon kind={categoryIconKind(slug, label, label)} size={23} />
                    </span>
                    <span>{label}</span>
                  </span>
                </BentoCard>
              );
            })}
        </BentoSection>

        <BentoSection
          title={t('home.newArrivals')}
          columns={4}
          action={
            <Link className="page__subtitle" to="/search">
              {t('common.viewAll')}
            </Link>
          }
        >
          {isLoading &&
            Array.from({ length: 4 }, (_, index) => (
              <BentoCard key={index} columns={1} surface="solid" padding="sm">
                <Skeleton height="9rem" radius="md" />
                <Skeleton height="1rem" radius="md" />
              </BentoCard>
            ))}

          {data?.products != null &&
            data.products.length > 0 &&
            data.products.map((product) => <ProductCard key={product.id} product={product} />)}

          {data?.products != null && data.products.length === 0 && (
            <BentoCard columns={2} surface="solid" padding="lg">
              <span className="page__subtitle">{t('search.noResults')}</span>
            </BentoCard>
          )}
        </BentoSection>

        {(error !== null || data?.products === null) && (
          <div className="home-error" role="status">
            <span>{t('home.catalogError')}</span>
            <Button variant="secondary" size="sm" onClick={reload}>
              {t('common.retry')}
            </Button>
          </div>
        )}
      </div>
    </BentoContainer>
  );
}
