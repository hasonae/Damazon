import { z } from 'zod';
import { isValidCoordinates } from '@damazon/shared-types';

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  locale: z.enum(['ar', 'en']).optional(),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

const coordinatesSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .refine(isValidCoordinates, { message: 'Coordinates are outside the valid range' });

export const createZoneSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    instructions: z.string().trim().max(500).optional(),
    type: z.enum(['personal', 'public', 'official']).default('personal'),
    coordinates: coordinatesSchema,
    radiusMeters: z.number().int().min(20).max(5_000).default(100),
    availability: z.enum(['always', 'scheduled', 'temporarily_closed']).default('always'),
    isDefault: z.boolean().default(false),
    cityId: z.string().uuid().optional(),
  })
  .strict();

export type CreateZoneRequest = z.infer<typeof createZoneSchema>;

export const updateZoneSchema = createZoneSchema
  .omit({ type: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export type UpdateZoneRequest = z.infer<typeof updateZoneSchema>;

export interface ProfileResponse {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly phone: string;
  readonly avatarUrl: string | null;
  readonly locale: 'ar' | 'en';
  readonly phoneVerified: boolean;
  readonly emailVerified: boolean;
  readonly createdAt: string;
}

export interface ZoneResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly instructions: string | null;
  readonly type: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly radiusMeters: number;
  readonly availability: string;
  readonly isDefault: boolean;
  readonly createdAt: string;
}
