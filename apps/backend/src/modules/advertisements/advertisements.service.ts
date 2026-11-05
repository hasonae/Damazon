import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  BusinessRuleViolationError,
  ResourceNotFoundError,
} from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthPrincipal } from '../../security/token.service.js';
import type {
  AdvertisementView,
  CreateAdvertisementRequest,
  UpdateAdvertisementRequest,
} from './dto/advertisements.dto.js';

@Injectable()
export class AdvertisementsService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async listActive(): Promise<readonly AdvertisementView[]> {
    const now = new Date();
    const rows = await this.prisma.advertisement.findMany({
      where: {
        status: 'active',
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: [{ position: 'asc' }, { startsAt: 'desc' }, { id: 'asc' }],
      take: 20,
    });
    return rows.map(toAdvertisementView);
  }

  public async listAll(): Promise<readonly AdvertisementView[]> {
    const rows = await this.prisma.advertisement.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    return rows.map(toAdvertisementView);
  }

  public async create(
    principal: AuthPrincipal,
    payload: CreateAdvertisementRequest,
  ): Promise<AdvertisementView> {
    assertValidPeriod(payload.startsAt, payload.endsAt);
    const row = await this.prisma.$transaction(async (client) => {
      const advertisement = await client.advertisement.create({
        data: {
          ...payload,
          createdById: principal.userId,
        },
      });
      await client.auditLog.create({
        data: {
          actorId: principal.userId,
          actorRole: principal.activeRole,
          action: 'create',
          entityType: 'advertisement',
          entityId: advertisement.id,
          newValue: toAuditValue(advertisement),
        },
      });
      return advertisement;
    });
    return toAdvertisementView(row);
  }

  public async update(
    principal: AuthPrincipal,
    advertisementId: string,
    payload: UpdateAdvertisementRequest,
  ): Promise<AdvertisementView> {
    const existing = await this.prisma.advertisement.findUnique({
      where: { id: advertisementId },
    });
    if (existing === null) {
      throw new ResourceNotFoundError('Advertisement', advertisementId);
    }

    const startsAt = payload.startsAt ?? existing.startsAt;
    const endsAt = payload.endsAt === undefined ? existing.endsAt : payload.endsAt;
    assertValidPeriod(startsAt, endsAt);

    const row = await this.prisma.$transaction(async (client) => {
      const advertisement = await client.advertisement.update({
        where: { id: advertisementId },
        data: payload,
      });
      await client.auditLog.create({
        data: {
          actorId: principal.userId,
          actorRole: principal.activeRole,
          action: 'update',
          entityType: 'advertisement',
          entityId: advertisement.id,
          oldValue: toAuditValue(existing),
          newValue: toAuditValue(advertisement),
        },
      });
      return advertisement;
    });
    return toAdvertisementView(row);
  }
}

function assertValidPeriod(startsAt: Date, endsAt: Date | null | undefined): void {
  if (endsAt !== undefined && endsAt !== null && endsAt <= startsAt) {
    throw new BusinessRuleViolationError('The end date must be later than the start date');
  }
}

function toAuditValue(value: {
  readonly title: string;
  readonly status: string;
  readonly imageUrl: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}): Prisma.InputJsonObject {
  return {
    title: value.title,
    status: value.status,
    imageUrl: value.imageUrl,
    startsAt: value.startsAt.toISOString(),
    endsAt: value.endsAt?.toISOString() ?? null,
  };
}

function toAdvertisementView(row: {
  readonly id: string;
  readonly title: string;
  readonly caption: string | null;
  readonly imageUrl: string;
  readonly targetUrl: string | null;
  readonly status: 'draft' | 'active' | 'paused' | 'archived';
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): AdvertisementView {
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    imageUrl: row.imageUrl,
    targetUrl: row.targetUrl,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
