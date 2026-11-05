import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationError,
  ConflictError,
  ResourceNotFoundError,
} from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '@prisma/client';
import type {
  CreateZoneRequest,
  ProfileResponse,
  UpdateProfileRequest,
  UpdateZoneRequest,
  ZoneResponse,
} from './dto/users.dto.js';

@Injectable()
export class UsersService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ResourceNotFoundError('User', userId);
    }
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      phoneVerified: user.phoneVerifiedAt !== null,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  public async updateProfile(
    userId: string,
    payload: UpdateProfileRequest,
  ): Promise<ProfileResponse> {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) {
      throw new ResourceNotFoundError('User', userId);
    }
    if (payload.email !== undefined && payload.email !== current.email) {
      throw new BusinessRuleViolationError(
        'Changing an email address requires a separate verification flow',
      );
    }
    if (payload.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { email: payload.email, NOT: { id: userId } },
        select: { id: true },
      });
      if (emailTaken) {
        throw new ConflictError('Email address is already in use', [
          { field: 'email', message: 'Email address is already in use' },
        ]);
      }
    }
    const data: Prisma.UserUpdateInput = {};
    if (payload.firstName !== undefined) {
      data.firstName = payload.firstName;
    }
    if (payload.lastName !== undefined) {
      data.lastName = payload.lastName;
    }
    if (payload.email !== undefined) {
      data.email = payload.email;
    }
    if (payload.avatarUrl !== undefined) {
      data.avatarUrl = payload.avatarUrl;
    }
    if (payload.locale !== undefined) {
      data.locale = payload.locale;
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    return {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
      avatarUrl: updated.avatarUrl,
      locale: updated.locale,
      phoneVerified: updated.phoneVerifiedAt !== null,
      emailVerified: updated.emailVerifiedAt !== null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  public async listZones(userId: string): Promise<readonly ZoneResponse[]> {
    const zones = await this.prisma.damazonZone.findMany({
      where: { ownerId: userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return zones.map(toZoneResponse);
  }

  public async createZone(userId: string, payload: CreateZoneRequest): Promise<ZoneResponse> {
    return this.prisma.transaction(async (client) => {
      if (payload.isDefault) {
        await client.damazonZone.updateMany({
          where: { ownerId: userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const zone = await client.damazonZone.create({
        data: {
          ownerId: userId,
          name: payload.name,
          description: payload.description ?? null,
          instructions: payload.instructions ?? null,
          type: payload.type,
          latitude: payload.coordinates.latitude,
          longitude: payload.coordinates.longitude,
          radiusMeters: payload.radiusMeters,
          availability: payload.availability,
          isDefault: payload.isDefault,
          cityId: payload.cityId ?? null,
        },
      });
      return toZoneResponse(zone);
    });
  }

  public async updateZone(
    userId: string,
    zoneId: string,
    payload: UpdateZoneRequest,
  ): Promise<ZoneResponse> {
    const existing = await this.prisma.damazonZone.findFirst({
      where: { id: zoneId, ownerId: userId },
    });
    if (!existing) {
      throw new ResourceNotFoundError('Damazon Zone', zoneId);
    }
    const data: Prisma.DamazonZoneUpdateInput = {};
    if (payload.name !== undefined) {
      data.name = payload.name;
    }
    if (payload.description !== undefined) {
      data.description = payload.description;
    }
    if (payload.instructions !== undefined) {
      data.instructions = payload.instructions;
    }
    if (payload.coordinates !== undefined) {
      data.latitude = payload.coordinates.latitude;
      data.longitude = payload.coordinates.longitude;
    }
    if (payload.radiusMeters !== undefined) {
      data.radiusMeters = payload.radiusMeters;
    }
    if (payload.availability !== undefined) {
      data.availability = payload.availability;
    }
    if (payload.cityId !== undefined) {
      data.city = payload.cityId ? { connect: { id: payload.cityId } } : { disconnect: true };
    }
    if (payload.isDefault !== undefined) {
      data.isDefault = payload.isDefault;
    }
    const updated = await this.prisma.damazonZone.update({ where: { id: zoneId }, data });
    return toZoneResponse(updated);
  }

  public async deleteZone(userId: string, zoneId: string): Promise<void> {
    const result = await this.prisma.damazonZone.deleteMany({
      where: { id: zoneId, ownerId: userId },
    });
    if (result.count === 0) {
      throw new ResourceNotFoundError('Damazon Zone', zoneId);
    }
  }
}

type ZoneRecord = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  type: string;
  latitude: unknown;
  longitude: unknown;
  radiusMeters: number;
  availability: string;
  isDefault: boolean;
  createdAt: Date;
};

function toZoneResponse(zone: ZoneRecord): ZoneResponse {
  return {
    id: zone.id,
    name: zone.name,
    description: zone.description,
    instructions: zone.instructions,
    type: zone.type,
    latitude: String(zone.latitude),
    longitude: String(zone.longitude),
    radiusMeters: zone.radiusMeters,
    availability: zone.availability,
    isDefault: zone.isDefault,
    createdAt: zone.createdAt.toISOString(),
  };
}
