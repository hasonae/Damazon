import { EmptyState } from '@damazon/design-system';
import { Link } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';

export default function NotFoundPage(): JSX.Element {
  const { t } = useLocale();

  return (
    <div className="page">
      <EmptyState
        title={t('search.noResults')}
        description={t('common.error')}
        action={<Link to="/">{t('nav.home')}</Link>}
      />
    </div>
  );
}
