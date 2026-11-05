/**
 * Endpoint group for the account profile and saved delivery zones.
 */

import type { SupportedLocale } from '@damazon/shared-types';

import type { ApiClient } from '../client.js';

import type { AuthenticatedUser } from './auth.js';

export interface UpdateProfileRequest {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string | null;
  readonly avatarUrl?: string | null;
  readonly locale?: SupportedLocale;
}

/**
 * A saved Damazon Zone. Mirrors `ZoneResponse` in
 * `apps/backend/src/modules/users/dto/users.dto.ts`; coordinates travel as
 * decimal strings to keep exact precision over JSON.
 */
export interface DeliveryZone {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly instructions: string | null;
  readonly type: 'personal' | 'public' | 'official';
  readonly latitude: string;
  readonly longitude: string;
  readonly radiusMeters: number;
  readonly availability: 'always' | 'scheduled' | 'temporarily_closed';
  readonly isDefault: boolean;
  readonly createdAt: string;
}

export interface UpsertZoneRequest {
  readonly name: string;
  readonly description?: string;
  readonly instructions?: string;
  readonly type?: 'personal' | 'public' | 'official';
  readonly coordinates: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly radiusMeters?: number;
  readonly availability?: 'always' | 'scheduled' | 'temporarily_closed';
  readonly isDefault?: boolean;
  readonly cityId?: string;
}

export class UsersApi {
  public constructor(private readonly client: ApiClient) {}

  public async profile(): Promise<AuthenticatedUser> {
    return this.client.get<AuthenticatedUser>('/users/profile', { cacheKey: 'users:profile' });
  }

  public async updateProfile(request: UpdateProfileRequest): Promise<AuthenticatedUser> {
    const updated = await this.client.put<AuthenticatedUser>('/users/profile', request);
    // The profile is cached on read; a write must invalidate it or the next
    // screen shows the previous name.
    this.client.clearCache('users:');
    return updated;
  }

  public async zones(): Promise<readonly DeliveryZone[]> {
    return this.client.get<readonly DeliveryZone[]>('/users/zones', { cacheKey: 'users:zones' });
  }

  public async addZone(request: UpsertZoneRequest): Promise<DeliveryZone> {
    const created = await this.client.post<DeliveryZone>('/users/zones', request);
    this.client.clearCache('users:zones');
    return created;
  }

  public async updateZone(
    zoneId: string,
    request: Partial<UpsertZoneRequest>,
  ): Promise<DeliveryZone> {
    const updated = await this.client.patch<DeliveryZone>(`/users/zones/{zoneId}`, request, {
      pathParams: { zoneId },
    });
    this.client.clearCache('users:zones');
    return updated;
  }

  public async removeZone(zoneId: string): Promise<void> {
    await this.client.delete<null>(`/users/zones/{zoneId}`, { pathParams: { zoneId } });
    this.client.clearCache('users:zones');
  }
}
