import type { AdminAdvertisement, CreateAdvertisementRequest } from '@damazon/api-client';
import {
  Badge,
  Button,
  EmptyState,
  GlassCard,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
} from '@damazon/design-system';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { useConsoleSession } from '../core/console-session.js';
import { ConsoleShell } from '../layouts/console-shell.js';

const STATUS_LABELS: Readonly<Record<AdminAdvertisement['status'], string>> = {
  draft: 'مسودة',
  active: 'نشط',
  paused: 'متوقف',
  archived: 'مؤرشف',
};

export default function AdvertisementsPage(): JSX.Element {
  const { can, client } = useConsoleSession();
  const [advertisements, setAdvertisements] = useState<readonly AdminAdvertisement[]>([]);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [status, setStatus] = useState<AdminAdvertisement['status']>('draft');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [position, setPosition] = useState('0');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!can('advertisements:read')) {
      setError('لا تملك صلاحية عرض الإعلانات.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setAdvertisements(await client.admin.advertisements());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر تحميل الإعلانات.');
    } finally {
      setIsLoading(false);
    }
  }, [can, client]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setIsSaving(true);
      setError(null);
      try {
        const request: CreateAdvertisementRequest = {
          title: title.trim(),
          caption: caption.trim() || null,
          imageUrl: imageUrl.trim(),
          targetUrl: targetUrl.trim() || null,
          status,
          position: Number(position),
          ...(startsAt.length > 0 ? { startsAt: new Date(startsAt).toISOString() } : {}),
          ...(endsAt.length > 0 ? { endsAt: new Date(endsAt).toISOString() } : {}),
        };
        await client.admin.createAdvertisement(request);
        setTitle('');
        setCaption('');
        setImageUrl('');
        setTargetUrl('');
        setStatus('draft');
        setStartsAt('');
        setEndsAt('');
        setPosition('0');
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'تعذّر حفظ الإعلان.');
      } finally {
        setIsSaving(false);
      }
    },
    [caption, client, endsAt, imageUrl, load, position, startsAt, status, targetUrl, title],
  );

  const updateStatus = useCallback(
    async (advertisement: AdminAdvertisement, nextStatus: AdminAdvertisement['status']) => {
      setBusyId(advertisement.id);
      setError(null);
      try {
        await client.admin.updateAdvertisement(advertisement.id, { status: nextStatus });
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'تعذّر تحديث حالة الإعلان.');
      } finally {
        setBusyId(null);
      }
    },
    [client, load],
  );

  return (
    <ConsoleShell title="إدارة الإعلانات">
      {error !== null && (
        <p role="alert" className="dz-field__error">
          {error}
        </p>
      )}

      {can('advertisements:create') && (
        <GlassCard padding="md">
          <form className="auth-card__form" onSubmit={(event) => void submit(event)}>
            <TextField
              label="عنوان الإعلان"
              name="title"
              required
              minLength={2}
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextAreaField
              label="النص التوضيحي"
              name="caption"
              maxLength={500}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
            <TextField
              label="رابط صورة الإعلان (HTTPS)"
              name="imageUrl"
              type="url"
              required
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
            <TextField
              label="رابط الوجهة (اختياري)"
              name="targetUrl"
              type="url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
            />
            <SelectField
              label="الحالة"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminAdvertisement['status'])}
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <TextField
              label="يبدأ في (اختياري)"
              name="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
            <TextField
              label="ينتهي في (اختياري)"
              name="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
            <TextField
              label="ترتيب العرض"
              name="position"
              type="number"
              min="0"
              max="100000"
              step="1"
              required
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
            <Button type="submit" loading={isSaving}>
              إنشاء الإعلان
            </Button>
          </form>
        </GlassCard>
      )}

      {isLoading ? (
        <Spinner size="lg" label="جارٍ التحميل" />
      ) : advertisements.length === 0 ? (
        <EmptyState title="لا توجد إعلانات" />
      ) : (
        advertisements.map((advertisement) => (
          <GlassCard key={advertisement.id} padding="md">
            <div className="order-card__head">
              <div>
                <strong>{advertisement.title}</strong>
                {advertisement.caption !== null && (
                  <span className="page__subtitle">{advertisement.caption}</span>
                )}
              </div>
              <Badge tone={advertisement.status === 'active' ? 'success' : 'warning'}>
                {STATUS_LABELS[advertisement.status]}
              </Badge>
            </div>
            <img
              src={advertisement.imageUrl}
              alt={advertisement.title}
              loading="lazy"
              style={{ width: '100%', maxHeight: '12rem', objectFit: 'cover' }}
            />
            <p className="page__subtitle">
              الموضع {advertisement.position} · يبدأ{' '}
              {new Date(advertisement.startsAt).toLocaleString('ar-SY')}
              {advertisement.endsAt === null
                ? ' · دون تاريخ انتهاء'
                : ` · ينتهي ${new Date(advertisement.endsAt).toLocaleString('ar-SY')}`}
            </p>
            <div className="role-switcher">
              {can('advertisements:update') && advertisement.status !== 'archived' && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyId === advertisement.id}
                  onClick={() =>
                    void updateStatus(
                      advertisement,
                      advertisement.status === 'active' ? 'paused' : 'active',
                    )
                  }
                >
                  {advertisement.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}
                </Button>
              )}
              {can('advertisements:update') && advertisement.status !== 'archived' && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyId === advertisement.id}
                  onClick={() => void updateStatus(advertisement, 'archived')}
                >
                  أرشفة
                </Button>
              )}
            </div>
          </GlassCard>
        ))
      )}
    </ConsoleShell>
  );
}
