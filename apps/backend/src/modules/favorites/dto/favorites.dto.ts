import { z } from 'zod';

import type { ProductSummary } from '../../catalog/dto/catalog.dto.js';

export const favoriteProductIdParamSchema = z.string().uuid();

export interface FavoritesResponse {
  readonly items: readonly ProductSummary[];
}
