import { z } from 'zod';

const httpUrlSchema = (max: number) =>
  z
    .string()
    .url()
    .max(max)
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
      message: 'Only HTTP and HTTPS URLs are allowed',
    });

export const advertisementStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);

export const createAdvertisementSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    caption: z.string().trim().max(500).nullable().optional(),
    imageUrl: httpUrlSchema(500),
    targetUrl: httpUrlSchema(1000).nullable().optional(),
    status: advertisementStatusSchema.default('draft'),
    startsAt: z.coerce.date().default(() => new Date()),
    endsAt: z.coerce.date().nullable().optional(),
    position: z.number().int().min(0).max(100_000).default(0),
  })
  .strict()
  .refine(
    (value) => value.endsAt === undefined || value.endsAt === null || value.endsAt > value.startsAt,
    {
      message: 'The end date must be later than the start date',
      path: ['endsAt'],
    },
  );

export type CreateAdvertisementRequest = z.infer<typeof createAdvertisementSchema>;

export const updateAdvertisementSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    caption: z.string().trim().max(500).nullable().optional(),
    imageUrl: httpUrlSchema(500).optional(),
    targetUrl: httpUrlSchema(1000).nullable().optional(),
    status: advertisementStatusSchema.optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    position: z.number().int().min(0).max(100_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateAdvertisementRequest = z.infer<typeof updateAdvertisementSchema>;

export const advertisementIdSchema = z.string().uuid();

export interface AdvertisementView {
  readonly id: string;
  readonly title: string;
  readonly caption: string | null;
  readonly imageUrl: string;
  readonly targetUrl: string | null;
  readonly status: z.infer<typeof advertisementStatusSchema>;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly position: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
