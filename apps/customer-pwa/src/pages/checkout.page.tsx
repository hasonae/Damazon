/**
 * Checkout (Part 7.1 §10): destination → payment → review → confirmation.
 *
 * A short stepper keeps the five checkout questions to one decision per
 * screen: where, who (optional recipient), how to pay, then a review that
 * calls the single-request `POST /orders` and lands on a per-store receipt.
 */

import type { CreateOrderResponse, DeliveryDestinationKind } from '@damazon/api-client';
import {
  Badge,
  BentoContainer,
  Button,
  GlassCard,
  SelectField,
  Spinner,
  TextAreaField,
  TextField,
} from '@damazon/design-system';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { CheckIcon } from '../components/icons.js';
import { useLocale } from '../locales/locale-context.js';
import { useCart } from '../store/cart.js';
import { useSession } from '../store/session.js';

type Step = 0 | 1 | 2;

interface DestinationState {
  readonly kind: DeliveryDestinationKind;
  readonly zoneId: string;
  readonly forSomeoneElse: boolean;
  readonly recipientName: string;
  readonly recipientPhone: string;
  readonly instructions: string;
  readonly note: string;
}

const INITIAL_DESTINATION: DestinationState = {
  kind: 'damazon_zone',
  zoneId: '',
  forSomeoneElse: false,
  recipientName: '',
  recipientPhone: '',
  instructions: '',
  note: '',
};

export default function CheckoutPage(): JSX.Element {
  const { t, formatMoney } = useLocale();
  const { client } = useSession();
  const { cart, isLoading: cartLoading, refresh } = useCart();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(0);
  const [destination, setDestination] = useState<DestinationState>(INITIAL_DESTINATION);
  const [zoneNames, setZoneNames] = useState<ReadonlyMap<string, string> | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [receipt, setReceipt] = useState<CreateOrderResponse | null>(null);

  const items = useMemo(() => cart?.items.filter((item) => item.isPurchasable) ?? [], [cart]);

  // The destination picker needs zone names; the same cached read as /zones.
  useEffect(() => {
    let cancelled = false;
    void client.users
      .zones()
      .then((zones) => {
        if (cancelled) {
          return;
        }
        setZoneNames(new Map(zones.map((zone) => [zone.id, zone.name])));
        const preferred =
          zones.find((zone) => zone.isDefault) ?? (zones.length > 0 ? zones[0] : undefined);
        if (preferred !== undefined) {
          setDestination((current) =>
            current.zoneId.length > 0 ? current : { ...current, zoneId: preferred.id },
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setZoneNames(new Map());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const canContinueDestination = useMemo(() => {
    if (destination.kind === 'pickup') {
      return true;
    }
    if (destination.zoneId.length === 0) {
      return false;
    }
    if (!destination.forSomeoneElse) {
      return true;
    }
    return (
      destination.recipientName.trim().length > 0 && destination.recipientPhone.trim().length > 0
    );
  }, [destination]);

  const placeOrder = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      if (items.length === 0) {
        return;
      }
      if (destination.forSomeoneElse && !canContinueDestination) {
        setStepError(t('checkout.recipientRequired'));
        return;
      }

      setPlacing(true);
      setStepError(null);
      void client.orders
        .create({
          paymentMethod: 'cash_on_delivery',
          destinationKind: destination.kind,
          deliveryZoneId: destination.kind === 'pickup' ? undefined : destination.zoneId,
          deliveryInstructions:
            destination.instructions.trim().length > 0
              ? destination.instructions.trim()
              : undefined,
          recipientName: destination.forSomeoneElse ? destination.recipientName.trim() : undefined,
          recipientPhone: destination.forSomeoneElse
            ? destination.recipientPhone.trim()
            : undefined,
          customerNote: destination.note.trim().length > 0 ? destination.note.trim() : undefined,
        })
        .then((created) => {
          setReceipt(created);
          void refresh();
        })
        .catch((cause: unknown) => {
          setStepError(cause instanceof Error ? cause.message : t('common.error'));
        })
        .finally(() => setPlacing(false));
    },
    [client, destination, items.length, refresh, t, canContinueDestination],
  );

  if (cartLoading && receipt === null) {
    return (
      <BentoContainer>
        <div className="route-fallback">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      </BentoContainer>
    );
  }

  if (items.length === 0 && receipt === null) {
    return (
      <BentoContainer>
        <div className="page">
          <header className="page__header">
            <h1 className="page__title">{t('checkout.title')}</h1>
          </header>
          <p className="page__subtitle">{t('checkout.emptyCart')}</p>
          <Link to="/cart">
            <Button variant="primary">{t('cart.title')}</Button>
          </Link>
        </div>
      </BentoContainer>
    );
  }

  if (receipt !== null) {
    const businessCount = receipt.orders.length;

    return (
      <BentoContainer>
        <div className="page">
          <header className="page__header">
            <h1 className="page__title">{t('checkout.success')}</h1>
            <p className="page__subtitle">{t('checkout.successCash')}</p>
          </header>

          {businessCount > 1 && (
            <p className="page__subtitle" role="note">
              {t('checkout.perStore', { count: businessCount })}
            </p>
          )}

          {receipt.orders.map((order) => (
            <GlassCard key={order.id} padding="md" className="receipt-card">
              <div className="receipt-card__head">
                <CheckIcon size={22} />
                <div>
                  <strong dir="ltr">{order.orderNumber}</strong>
                  <span className="page__subtitle">{order.business.name}</span>
                </div>
              </div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>{t('cart.total')}</span>
                <span className="dz-money">
                  {formatMoney(BigInt(order.totalMinor), order.currency)}
                </span>
              </div>
              <Link to={`/orders/${order.id}`}>
                <Button variant="secondary" size="sm">
                  {t('order.viewDetail')}
                </Button>
              </Link>
            </GlassCard>
          ))}

          <div className="zone-card__actions">
            <Button variant="primary" onClick={() => void navigate('/orders')}>
              {t('checkout.goToOrders')}
            </Button>
          </div>
        </div>
      </BentoContainer>
    );
  }

  return (
    <BentoContainer>
      <div className="page">
        <header className="page__header">
          <h1 className="page__title">{t('checkout.title')}</h1>
          <ol className="stepper" aria-label={t('checkout.title')}>
            {[
              t('checkout.stepDestination'),
              t('checkout.stepPayment'),
              t('checkout.stepReview'),
            ].map((label, index) => (
              <li
                key={label}
                className={index === step ? 'stepper__step stepper__step--active' : 'stepper__step'}
                aria-current={index === step ? 'step' : undefined}
              >
                <span className="stepper__index">{index + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </header>

        {stepError !== null && (
          <GlassCard padding="sm">
            <p className="dz-field__error" role="alert">
              {stepError}
            </p>
          </GlassCard>
        )}

        {step === 0 && (
          <GlassCard padding="lg">
            <h2 className="section-label">{t('checkout.destination')}</h2>
            <div className="chip-row" role="radiogroup" aria-label={t('checkout.destination')}>
              <button
                type="button"
                role="radio"
                aria-checked={destination.kind === 'damazon_zone'}
                className={destination.kind === 'damazon_zone' ? 'chip chip--active' : 'chip'}
                onClick={() => setDestination((current) => ({ ...current, kind: 'damazon_zone' }))}
              >
                {t('checkout.zoneOption')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={destination.kind === 'pickup'}
                className={destination.kind === 'pickup' ? 'chip chip--active' : 'chip'}
                onClick={() => setDestination((current) => ({ ...current, kind: 'pickup' }))}
              >
                {t('checkout.pickupOption')}
              </button>
            </div>

            {destination.kind === 'damazon_zone' && (
              <>
                {zoneNames === null ? (
                  <Spinner size="md" label={t('common.loading')} />
                ) : zoneNames.size === 0 ? (
                  <div className="zone-card__actions">
                    <span className="page__subtitle">{t('checkout.noZones')}</span>
                    <Link to="/zones">
                      <Button variant="secondary" size="sm">
                        {t('checkout.manageZones')}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <SelectField
                    label={t('checkout.selectZone')}
                    name="checkout-zone"
                    value={destination.zoneId}
                    onChange={(event) =>
                      setDestination((current) => ({ ...current, zoneId: event.target.value }))
                    }
                    options={[...zoneNames.entries()].map(([value, label]) => ({ value, label }))}
                  />
                )}

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={destination.forSomeoneElse}
                    onChange={(event) =>
                      setDestination((current) => ({
                        ...current,
                        forSomeoneElse: event.target.checked,
                      }))
                    }
                  />
                  {t('checkout.recipient')}
                </label>

                {destination.forSomeoneElse && (
                  <>
                    <TextField
                      label={t('checkout.recipientName')}
                      name="recipient-name"
                      value={destination.recipientName}
                      onChange={(event) =>
                        setDestination((current) => ({
                          ...current,
                          recipientName: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label={t('checkout.recipientPhone')}
                      name="recipient-phone"
                      inputMode="tel"
                      dir="ltr"
                      value={destination.recipientPhone}
                      onChange={(event) =>
                        setDestination((current) => ({
                          ...current,
                          recipientPhone: event.target.value,
                        }))
                      }
                    />
                  </>
                )}

                <TextAreaField
                  label={`${t('checkout.deliveryInstructions')} (${t('common.optional')})`}
                  name="delivery-instructions"
                  value={destination.instructions}
                  onChange={(event) =>
                    setDestination((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                />
              </>
            )}

            <div className="zone-card__actions">
              <Button
                variant="primary"
                disabled={!canContinueDestination}
                onClick={() => setStep(1)}
              >
                {t('common.next')}
              </Button>
            </div>
          </GlassCard>
        )}

        {step === 1 && (
          <GlassCard padding="lg">
            <h2 className="section-label">{t('checkout.payment')}</h2>
            <div className="pay-options">
              <div className="pay-option pay-option--active pay-option--static">
                <span>
                  <strong>{t('checkout.cashOnDelivery')}</strong>
                  <small className="page__subtitle">{t('checkout.codHint')}</small>
                </span>
              </div>
            </div>

            <div className="zone-card__actions">
              <Button variant="ghost" onClick={() => setStep(0)}>
                {t('common.back')}
              </Button>
              <Button variant="primary" onClick={() => setStep(2)}>
                {t('common.next')}
              </Button>
            </div>
          </GlassCard>
        )}

        {step === 2 && (
          <form onSubmit={placeOrder}>
            <GlassCard padding="lg">
              <h2 className="section-label">{t('checkout.reviewItems')}</h2>
              <div className="cart-lines">
                {items.map((item) => (
                  <div key={item.id} className="cart-line">
                    <span className="cart-line__name">
                      {item.product.nameAr} × {item.quantity}
                    </span>
                    <span className="dz-money">
                      {formatMoney(BigInt(item.lineTotalMinor), item.product.currency)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>{t('cart.total')}</span>
                <span className="dz-money">
                  {formatMoney(BigInt(cart?.subtotalMinor ?? '0'), cart?.currency ?? 'SYP')}
                </span>
              </div>

              <TextAreaField
                label={`${t('checkout.orderNote')} (${t('common.optional')})`}
                name="order-note"
                value={destination.note}
                onChange={(event) =>
                  setDestination((current) => ({ ...current, note: event.target.value }))
                }
              />

              {stepError !== null && (
                <p className="dz-field__error" role="alert">
                  {stepError}
                </p>
              )}

              <div className="zone-card__actions">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  {t('common.back')}
                </Button>
                {new Set(items.map((line) => line.product.businessId)).size > 1 && (
                  <Badge tone="neutral">
                    {t('checkout.perStore', {
                      count: new Set(items.map((line) => line.product.businessId)).size,
                    })}
                  </Badge>
                )}
                <Button type="submit" variant="primary" disabled={placing}>
                  {placing ? t('checkout.placing') : t('checkout.placeOrder')}
                </Button>
              </div>
            </GlassCard>
          </form>
        )}
      </div>
    </BentoContainer>
  );
}
