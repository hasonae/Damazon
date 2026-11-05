import { EmptyState, SelectField } from '@damazon/design-system';
import { useState } from 'react';

import { ConsoleShell } from '../layouts/console-shell.js';

const CITY_OPTIONS = [
  { value: 'SY-DM', label: 'دمشق' },
  { value: 'SY-AL', label: 'حلب' },
  { value: 'SY-HM', label: 'حمص' },
  { value: 'SY-LA', label: 'اللاذقية' },
] as const;

const RANGE_OPTIONS = [
  { value: '7', label: 'آخر 7 أيام' },
  { value: '30', label: 'آخر 30 يوماً' },
  { value: '90', label: 'آخر 90 يوماً' },
] as const;

/**
 * Reporting screen.
 *
 * Filters come first and results follow them; no figure is shown before a range
 * is chosen, because an unfiltered total on a marketplace is not a meaningful
 * number and is easy to misquote.
 */
export default function AnalyticsPage(): JSX.Element {
  const [city, setCity] = useState('SY-DM');
  const [range, setRange] = useState('30');
  const [applied, setApplied] = useState<{ city: string; range: string } | null>(null);

  return (
    <ConsoleShell title="التقارير">
      <form
        className="console-signin__form"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ city, range });
        }}
      >
        <SelectField
          label="المدينة"
          name="city"
          options={CITY_OPTIONS}
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
        <SelectField
          label="المدى الزمني"
          name="range"
          options={RANGE_OPTIONS}
          value={range}
          onChange={(event) => setRange(event.target.value)}
        />
        <button type="submit" className="console-button">
          عرض
        </button>
      </form>

      {applied === null ? (
        <EmptyState title="اختر المدى الزمني" description="لا تُعرض أرقام قبل تحديد المدى." />
      ) : (
        <EmptyState
          title="التقارير قيد التجهيز"
          description="نفس طبقة التحليلات التي تغذّي الصفحة."
        />
      )}
    </ConsoleShell>
  );
}
