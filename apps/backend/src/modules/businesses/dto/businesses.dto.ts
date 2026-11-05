import { z } from 'zod';
import { isValidSyrianMobile } from '@damazon/utilities';

/**
 * Business tenant transport contracts.
 *
 * A business is the tenancy boundary for merchants, restaurants, and
 * delivery companies. Creation seeds a pending verification record; approval
 * is an administrative action in a later module, because a business that
 * approves itself is not verification.
 */

export const businessTypeSchema = z.enum(['merchant', 'restaurant', 'delivery_company']);

export const registerBusinessSchema = z
  .object({
    type: businessTypeSchema,
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).optional(),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(20)
      .refine(isValidSyrianMobile, 'A valid Syrian mobile number is required'),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    logoUrl: z.string().url().max(500).optional(),
    coverImageUrl: z.string().url().max(500).optional(),
    cityId: z.string().uuid().optional(),
    addressLine: z.string().trim().max(300).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .strict();

export type RegisterBusinessRequest = z.infer<typeof registerBusinessSchema>;

export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(20)
      .refine(isValidSyrianMobile, 'A valid Syrian mobile number is required')
      .optional(),
    email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    coverImageUrl: z.string().url().max(500).nullable().optional(),
    cityId: z.string().uuid().nullable().optional(),
    addressLine: z.string().trim().max(300).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateBusinessRequest = z.infer<typeof updateBusinessSchema>;

export const businessProductStatusSchema = z.enum([
  'draft',
  'active',
  'inactive',
  'out_of_stock',
  'archived',
]);

export const createBusinessProductSchema = z
  .object({
    sku: z.string().trim().min(1).max(64),
    nameAr: z.string().trim().min(2).max(200),
    nameEn: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000).nullable().optional(),
    priceMinor: z.number().int().safe().min(1).max(2_000_000_000),
    categoryId: z.string().uuid().nullable().optional(),
    stockQuantity: z.number().int().min(0).max(2_000_000).default(0),
    isAvailable: z.boolean().default(true),
    status: businessProductStatusSchema.default('draft'),
    imageUrls: z.array(z.string().url().max(500)).min(1).max(8),
  })
  .strict();

export type CreateBusinessProductRequest = z.infer<typeof createBusinessProductSchema>;

export const updateBusinessProductSchema = z
  .object({
    sku: z.string().trim().min(1).max(64).optional(),
    nameAr: z.string().trim().min(2).max(200).optional(),
    nameEn: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    priceMinor: z.number().int().safe().min(1).max(2_000_000_000).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    stockQuantity: z.number().int().min(0).max(2_000_000).optional(),
    isAvailable: z.boolean().optional(),
    status: businessProductStatusSchema.optional(),
    imageUrls: z.array(z.string().url().max(500)).max(8).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateBusinessProductRequest = z.infer<typeof updateBusinessProductSchema>;

export interface BusinessProductView {
  readonly id: string;
  readonly sku: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly description: string | null;
  readonly priceMinor: string;
  readonly currency: string;
  readonly stockQuantity: number;
  readonly isAvailable: boolean;
  readonly status: z.infer<typeof businessProductStatusSchema>;
  readonly categoryId: string | null;
  readonly imageUrls: readonly string[];
  readonly updatedAt: string;
}

export const businessIdParamSchema = z.string().uuid();

export interface BusinessSummary {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly coverImageUrl: string | null;
  readonly status: string;
  readonly verificationStatus: string;
  readonly subscriptionSuspendedAt: string | null;
  readonly ratingAverage: string;
  readonly ratingCount: number;
  readonly subscription: BusinessSubscriptionSummary | null;
  readonly createdAt: string;
}

export interface BusinessSubscriptionSummary {
  readonly status: string;
  readonly amount: number;
  readonly currency: string;
  readonly periodEnd: string;
}

export interface BusinessNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface BusinessDetail extends BusinessSummary {
  readonly description: string | null;
  readonly phone: string;
  readonly email: string | null;
  readonly city: { readonly id: string; readonly nameAr: string; readonly nameEn: string } | null;
  readonly addressLine: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly isOwner: boolean;
}
