/**
 * Cart state for the customer PWA.
 *
 * The API is the source of truth: every mutation returns the refreshed cart,
 * so the context applies that response directly instead of guessing at what
 * the server did. The context exists so the navigation badge, the cart page,
 * and the product page all read one count without three requests.
 */

import type { CartResponse } from '@damazon/api-client';
import { ApiRequestError } from '@damazon/api-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useSession } from './session.js';

export interface CartContextValue {
  readonly cart: CartResponse | null;
  readonly isLoading: boolean;
  /** Sum of item quantities; the navigation badge reads only this. */
  readonly itemCount: number;
  readonly lastError: string | null;
  readonly refresh: () => Promise<void>;
  readonly addItem: (
    productId: string,
    quantity?: number,
    variantId?: string,
  ) => Promise<CartResponse | null>;
  readonly updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  readonly removeItem: (itemId: string) => Promise<void>;
  readonly clear: () => Promise<void>;
  readonly dismissError: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CART: CartResponse = {
  id: '',
  itemCount: 0,
  subtotalMinor: '0',
  currency: 'SYP',
  items: [],
};

function messageOf(cause: unknown): string {
  if (cause instanceof ApiRequestError) {
    return cause.message;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}

export function CartProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const { status, client } = useSession();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (status !== 'authenticated') {
      setCart(null);
      return;
    }
    setIsLoading(true);
    try {
      setCart(await client.cart.get());
    } catch (cause) {
      // A failed read leaves the previous cart on screen rather than blanking
      // it; the error surfaces through `lastError` instead.
      setLastError(messageOf(cause));
    } finally {
      setIsLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId: string, quantity = 1, variantId?: string): Promise<CartResponse | null> => {
      try {
        const next = await client.cart.addItem({ productId, quantity, variantId });
        setCart(next);
        setLastError(null);
        return next;
      } catch (cause) {
        setLastError(messageOf(cause));
        return null;
      }
    },
    [client],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number): Promise<void> => {
      try {
        setCart(await client.cart.updateItem(itemId, quantity));
        setLastError(null);
      } catch (cause) {
        setLastError(messageOf(cause));
      }
    },
    [client],
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<void> => {
      try {
        setCart(await client.cart.removeItem(itemId));
        setLastError(null);
      } catch (cause) {
        setLastError(messageOf(cause));
      }
    },
    [client],
  );

  const clear = useCallback(async (): Promise<void> => {
    try {
      await client.cart.clear();
      setCart((current) => (current === null ? null : { ...EMPTY_CART, id: current.id }));
      setLastError(null);
    } catch (cause) {
      setLastError(messageOf(cause));
    }
  }, [client]);

  const dismissError = useCallback(() => setLastError(null), []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isLoading,
      itemCount: cart?.itemCount ?? 0,
      lastError,
      refresh,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      dismissError,
    }),
    [cart, isLoading, lastError, refresh, addItem, updateQuantity, removeItem, clear, dismissError],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);

  if (value === null) {
    throw new Error('useCart must be used inside a CartProvider');
  }

  return value;
}
