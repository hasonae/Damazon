import { z } from 'zod';

/**
 * Cart transport contracts.
 *
 * Every mutation returns the full refreshed cart so a screen performs one
 * round trip per interaction instead of a mutation followed by a re-read.
 */

export const addCartItemSchema = z
  .object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(99).default(1),
  })
  .strict();

export type AddCartItemRequest = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z
  .object({
    quantity: z.number().int().min(1).max(99),
  })
  .strict();

export type UpdateCartItemRequest = z.infer<typeof updateCartItemSchema>;

export const itemIdParamSchema = z.string().uuid();

export interface CartItemProductRef {
  readonly id: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly sku: string;
  readonly imageUrl: string | null;
  readonly currency: string;
  readonly businessId: string;
  readonly businessName: string;
}

export interface CartItemView {
  readonly id: string;
  readonly quantity: number;
  /** Current effective unit price (discount and variant applied), string minor units. */
  readonly unitPriceMinor: string;
  readonly lineTotalMinor: string;
  /** False when the product, variant, business, or stock blocks a purchase right now. */
  readonly isPurchasable: boolean;
  readonly stockQuantity: number;
  readonly variant: {
    readonly id: string;
    readonly nameAr: string;
    readonly nameEn: string;
  } | null;
  readonly product: CartItemProductRef;
}

export interface CartResponse {
  readonly id: string;
  readonly itemCount: number;
  readonly subtotalMinor: string;
  readonly currency: string;
  readonly items: readonly CartItemView[];
}
