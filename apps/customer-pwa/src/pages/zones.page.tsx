/**
 * Damazon Zone management (Part 3: Damazon Zone is a core platform feature).
 *
 * A customer saves anywhere an order may meet them — home, office,
 * university, a coffee shop — and the driver navigates straight there.
 * Zone creation stores exact coordinates; the "use my location" button fills
 * them from the device so manual entry is a last resort.
 */

import type { DeliveryZone, UpsertZoneRequest } from '@damazon/api-client';
import {
  Badge,
  BentoContainer,
  Button,
  EmptyState,
  GlassCard,
  Spinner,
  TextAreaField,
  TextField,
} from '@damazon/design-system';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { PinIcon, TrashIcon } from '../components/icons.js';
import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

const HOME_PRESETS = ['المنزل', 'المكتب', 'الجامعة', 'الدكان'];

interface ZoneForm {
  name: string;
  latitude: string;
  longitude: string;
  instructions: string;
  isDefault: boolean;
}

const INITIAL_FORM: ZoneForm = {
  name: '',
  latitude: '',
  longitude: '',
  instructions: '',
  isDefault: false,
};

function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ZonesPage(): JSX.Element {
  const { t } = useLocale();
  const { client } = useSession();

  const [zones, setZones] = useState<readonly DeliveryZone[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ZoneForm>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setZones(await client.users.zones());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [client, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const locateMe = useCallback((): void => {
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      setFormError(t('common.error'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: String(position.coords.latitude.toFixed(6)),
          longitude: String(position.coords.longitude.toFixed(6)),
        }));
        setFormError(null);
        setLocating(false);
      },
      () => {
        setFormError(t('common.error'));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [t]);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const latitude = toNumber(form.latitude);
      const longitude = toNumber(form.longitude);

      if (form.name.trim().length < 2) {
        setFormError(t('common.required'));
        return;
      }
      if (latitude === null || longitude === null) {
        setFormError(t('zones.coordinatesRequired'));
        return;
      }

      const request: UpsertZoneRequest = {
        name: form.name.trim(),
        instructions: form.instructions.trim().length > 0 ? form.instructions.trim() : undefined,
        type: 'personal',
        coordinates: { latitude, longitude },
        isDefault: form.isDefault || (zones?.length ?? 0) === 0,
      };

      setSaving(true);
      setFormError(null);
      void client.users
        .addZone(request)
        .then((created) => {
          setZones((current) => [...(current ?? []), created]);
          setForm(INITIAL_FORM);
          setNotice(t('zones.created'));
          window.setTimeout(() => setNotice(null), 2400);
        })
        .catch((cause: unknown) => {
          setFormError(cause instanceof Error ? cause.message : t('common.error'));
        })
        .finally(() => setSaving(false));
    },
    [client, form, t, zones],
  );

  const removeZone = useCallback(
    (zoneId: string): void => {
      if (!window.confirm(t('zones.deleteConfirm'))) {
        return;
      }
      void client.users
        .removeZone(zoneId)
        .then(() => {
          setZones((current) => (current ?? []).filter((zone) => zone.id !== zoneId));
          setNotice(t('zones.deleted'));
          window.setTimeout(() => setNotice(null), 2400);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : t('common.error'));
        });
    },
    [client, t],
  );

  const makeDefault = useCallback(
    (zoneId: string): void => {
      void client.users
        .updateZone(zoneId, { isDefault: true })
        .then(() => {
          setZones((current) =>
            (current ?? []).map((zone) => ({ ...zone, isDefault: zone.id === zoneId })),
          );
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : t('common.error'));
        });
    },
    [client, t],
  );

  return (
    <BentoContainer>
      <div className="page">
        <header className="page__header">
          <h1 className="page__title">{t('zone.title')}</h1>
          <p className="page__subtitle">{t('zones.hint')}</p>
        </header>

        {notice !== null && (
          <p className="page__subtitle" role="status">
            ✓ {notice}
          </p>
        )}

        {isLoading && (
          <div className="route-fallback">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        )}

        {!isLoading && error !== null && (
          <GlassCard padding="lg">
            <p className="dz-field__error">{error}</p>
            <Button variant="secondary" onClick={reload}>
              {t('common.retry')}
            </Button>
          </GlassCard>
        )}

        {!isLoading && error === null && (zones === null || zones.length === 0) && (
          <EmptyState title={t('zones.empty')} description={t('zones.hint')} />
        )}

        {!isLoading &&
          zones !== null &&
          zones.map((zone) => (
            <GlassCard key={zone.id} padding="md" className="zone-card">
              <div className="zone-card__head">
                <PinIcon size={20} />
                <strong>{zone.name}</strong>
                {zone.isDefault && <Badge tone="accent">{t('zones.default')}</Badge>}
              </div>
              {zone.instructions !== null && zone.instructions.length > 0 && (
                <p className="page__subtitle">{zone.instructions}</p>
              )}
              <span className="page__subtitle" dir="ltr">
                {zone.latitude}, {zone.longitude}
              </span>
              <div className="zone-card__actions">
                {!zone.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => makeDefault(zone.id)}>
                    {t('zones.setDefaultAction')}
                  </Button>
                )}
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('zone.remove')}
                  title={t('zone.remove')}
                  onClick={() => removeZone(zone.id)}
                >
                  <TrashIcon size={18} />
                </button>
              </div>
            </GlassCard>
          ))}

        <GlassCard padding="lg">
          <h2 className="section-label">{t('zones.add')}</h2>
          <form className="zone-form" onSubmit={submit}>
            <TextField
              label={t('zones.name')}
              name="zone-name"
              value={form.name}
              placeholder={t('zones.namePlaceholder')}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
            <div className="chip-row">
              {HOME_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="chip"
                  onClick={() =>
                    setForm((current) =>
                      current.name.length > 0 ? current : { ...current, name: preset },
                    )
                  }
                >
                  {preset}
                </button>
              ))}
            </div>

            <fieldset className="zone-coords">
              <legend className="section-label">{t('zones.coordinates')}</legend>
              <div className="zone-coords__row">
                <TextField
                  label="Lat"
                  name="zone-lat"
                  inputMode="decimal"
                  dir="ltr"
                  value={form.latitude}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, latitude: event.target.value }))
                  }
                />
                <TextField
                  label="Lng"
                  name="zone-lng"
                  inputMode="decimal"
                  dir="ltr"
                  value={form.longitude}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, longitude: event.target.value }))
                  }
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={locating}
                onClick={locateMe}
              >
                {t('zones.locateMe')}
              </Button>
            </fieldset>

            <TextAreaField
              label={t('zones.instructions')}
              name="zone-instructions"
              value={form.instructions}
              placeholder={t('zones.instructionsPlaceholder')}
              onChange={(event) =>
                setForm((current) => ({ ...current, instructions: event.target.value }))
              }
            />

            <label className="check-row">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isDefault: event.target.checked }))
                }
              />
              {t('zones.setDefault')}
            </label>

            {formError !== null && (
              <p className="dz-field__error" role="alert">
                {formError}
              </p>
            )}

            <Button type="submit" variant="primary" disabled={saving}>
              {t('zones.add')}
            </Button>
          </form>
        </GlassCard>

        <Link to="/" className="page__subtitle">
          {t('nav.home')}
        </Link>
      </div>
    </BentoContainer>
  );
}
