import {
  ApiRequestError,
  type DriverApplication,
  type DriverVehicleType,
} from '@damazon/api-client';
import { Badge, Button, GlassCard, SelectField, Spinner, TextField } from '@damazon/design-system';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useLocale } from '../locales/locale-context.js';
import { useSession } from '../store/session.js';

export default function DriverRegistrationPage(): JSX.Element {
  const { t } = useLocale();
  const { client, switchRole } = useSession();
  const navigate = useNavigate();
  const [application, setApplication] = useState<DriverApplication | null>(null);
  const [vehicleType, setVehicleType] = useState<DriverVehicleType>('motorcycle');
  const [plateNumber, setPlateNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const current = await client.delivery.driverApplication();
      setApplication(current);
      switch (current.vehicleType) {
        case 'motorcycle':
        case 'bicycle':
        case 'car':
        case 'van':
        case 'truck':
        case 'walking':
          setVehicleType(current.vehicleType);
          break;
        default:
          break;
      }
      setPlateNumber(current.vehiclePlateNumber ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('driver.applicationLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [client, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setIsSaving(true);
      setError(null);
      try {
        setApplication(
          await client.delivery.applyAsDriver({
            vehicleType,
            ...(plateNumber.trim().length > 0 ? { vehiclePlateNumber: plateNumber.trim() } : {}),
          }),
        );
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError ? cause.message : t('driver.applicationSubmitFailed'),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [client, plateNumber, t, vehicleType],
  );

  const enterDriverMode = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    setError(null);
    try {
      await switchRole('driver');
      void navigate('/driver');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('driver.applicationSubmitFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [navigate, switchRole, t]);

  if (isLoading) {
    return (
      <div className="route-fallback">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{t('driver.applicationTitle')}</h1>
      </header>
      <GlassCard padding="lg">
        {application?.status === 'PENDING' || application?.status === 'UNDER_REVIEW' ? (
          <>
            <Badge tone="warning">{t('driver.applicationPending')}</Badge>
            <p className="page__subtitle">{t('driver.applicationPendingHint')}</p>
          </>
        ) : application?.status === 'APPROVED' ? (
          <>
            <Badge tone="success">{t('driver.applicationApproved')}</Badge>
            <p className="page__subtitle">{t('driver.applicationApprovedHint')}</p>
            <Button loading={isSaving} onClick={() => void enterDriverMode()}>
              {t('driver.enterMode')}
            </Button>
          </>
        ) : (
          <form className="auth-card__form" onSubmit={(event) => void submit(event)}>
            {application?.status === 'REJECTED' && (
              <Badge tone="danger">{t('driver.applicationRejected')}</Badge>
            )}
            <SelectField
              label={t('driver.vehicleType')}
              name="vehicleType"
              value={vehicleType}
              onChange={(event) => {
                const next = event.target.value;
                if (
                  next === 'motorcycle' ||
                  next === 'bicycle' ||
                  next === 'car' ||
                  next === 'van' ||
                  next === 'truck' ||
                  next === 'walking'
                ) {
                  setVehicleType(next);
                }
              }}
              options={[
                { value: 'motorcycle', label: t('driver.vehicle.motorcycle') },
                { value: 'bicycle', label: t('driver.vehicle.bicycle') },
                { value: 'car', label: t('driver.vehicle.car') },
                { value: 'van', label: t('driver.vehicle.van') },
                { value: 'truck', label: t('driver.vehicle.truck') },
                { value: 'walking', label: t('driver.vehicle.walking') },
              ]}
            />
            <TextField
              label={t('driver.vehiclePlate')}
              name="vehiclePlateNumber"
              maxLength={24}
              value={plateNumber}
              onChange={(event) => setPlateNumber(event.target.value)}
            />
            <p className="page__subtitle">{t('driver.applicationReviewNotice')}</p>
            <Button type="submit" loading={isSaving}>
              {t('driver.apply')}
            </Button>
          </form>
        )}
        {error !== null && (
          <p className="dz-field__error" role="alert">
            {error}
          </p>
        )}
      </GlassCard>
    </div>
  );
}
