import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

const REMINDER_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class SubscriptionLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);
  private timer: NodeJS.Timeout | undefined;

  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public onModuleInit(): void {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  public onModuleDestroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
    }
  }

  public async runOnce(): Promise<void> {
    const results = await Promise.allSettled([
      this.createExpiryReminders(),
      this.expireSubscriptions(),
    ]);
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
        this.logger.error(
          index === 0 ? 'Subscription reminders failed' : 'Subscription expiry processing failed',
          result.reason instanceof Error ? result.reason.stack : String(result.reason),
        );
      }
    }
  }

  private async createExpiryReminders(): Promise<void> {
    const now = new Date();
    const remindBy = new Date(now.getTime() + REMINDER_WINDOW_MS);
    const subscriptions = await this.prisma.businessSubscription.findMany({
      where: {
        status: 'active',
        periodStart: { lte: now },
        periodEnd: { gt: now, lte: remindBy },
        business: {
          subscriptions: {
            none: { status: 'pending', periodEnd: { gt: now } },
          },
        },
      },
      include: {
        business: {
          select: { id: true, ownerId: true },
        },
      },
    });

    if (subscriptions.length === 0) {
      return;
    }
    await this.prisma.notification.createMany({
      skipDuplicates: true,
      data: subscriptions.map((subscription) => {
        const expiresAt = subscription.periodEnd.toISOString();
        return {
          userId: subscription.business.ownerId,
          type: 'subscription' as const,
          titleEn: 'Business subscription expires soon',
          titleAr: 'اشتراك نشاطك التجاري على وشك الانتهاء',
          bodyEn: `Your 500 SYP subscription expires on ${expiresAt}. Pay cash to Damazon before expiry to avoid account suspension.`,
          bodyAr: `ينتهي اشتراكك البالغ 500 ليرة سورية جديدة بتاريخ ${expiresAt}. يرجى دفع التجديد نقداً لدامازون قبل الانتهاء لتجنب إيقاف النشاط.`,
          data: {
            businessId: subscription.business.id,
            subscriptionId: subscription.id,
            periodEnd: expiresAt,
            daysUntilExpiry: Math.ceil(
              (subscription.periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
            ),
          },
          dedupeKey: `subscription-reminder:${subscription.id}`,
        };
      }),
    });
  }

  private async expireSubscriptions(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.businessSubscription.findMany({
      where: { status: 'active', periodEnd: { lte: now } },
      select: { businessId: true },
      distinct: ['businessId'],
    });

    for (const { businessId } of expired) {
      await this.prisma.$transaction(async (client) => {
        await client.businessSubscription.updateMany({
          where: { businessId, status: 'active', periodEnd: { lte: now } },
          data: { status: 'expired' },
        });
        await client.businessSubscription.updateMany({
          where: {
            businessId,
            status: 'pending',
            periodStart: { lte: now },
            periodEnd: { gt: now },
          },
          data: { status: 'active' },
        });

        const active = await client.businessSubscription.findFirst({
          where: {
            businessId,
            status: 'active',
            periodStart: { lte: now },
            periodEnd: { gt: now },
          },
          select: { id: true },
        });
        const business = await client.business.findUnique({
          where: { id: businessId },
          select: {
            id: true,
            name: true,
            status: true,
            verificationStatus: true,
            subscriptionSuspendedAt: true,
            ownerId: true,
            owner: { select: { locale: true } },
          },
        });
        if (business === null || business.verificationStatus !== 'APPROVED') {
          return;
        }

        if (active !== null) {
          if (business.subscriptionSuspendedAt !== null) {
            await client.business.updateMany({
              where: { id: business.id, subscriptionSuspendedAt: { not: null } },
              data: { status: 'ACTIVE', subscriptionSuspendedAt: null },
            });
          }
          return;
        }

        const suspended = await client.business.updateMany({
          where: {
            id: business.id,
            status: 'ACTIVE',
            subscriptionSuspendedAt: null,
          },
          data: { status: 'SUSPENDED', subscriptionSuspendedAt: now },
        });
        if (suspended.count !== 1) {
          return;
        }

        await client.notification.create({
          data: {
            userId: business.ownerId,
            type: 'subscription',
            titleEn: 'Business suspended: subscription expired',
            titleAr: 'تم إيقاف النشاط لانتهاء الاشتراك',
            bodyEn: `The subscription for ${business.name} expired. Visit the Damazon administration office and pay cash to restore service.`,
            bodyAr: `انتهى اشتراك ${business.name} وتم إيقافه تلقائياً. راجع إدارة دامازون وادفع نقداً لإعادة تفعيله.`,
            data: { businessId: business.id, reason: 'subscription_expired' },
            dedupeKey: `subscription-expired:${business.id}:${now.toISOString().slice(0, 10)}`,
          },
        });
        await client.auditLog.create({
          data: {
            action: 'suspend',
            entityType: 'Business',
            entityId: business.id,
            oldValue: { status: business.status },
            newValue: {
              status: 'SUSPENDED',
              reason: 'subscription_expired',
              suspendedAt: now.toISOString(),
            },
          },
        });
      });
    }
  }
}
