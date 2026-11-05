import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { APP_CONFIGURATION, type AppConfiguration } from '../config/environment.js';

export type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  public constructor(@Inject(APP_CONFIGURATION) configuration: AppConfiguration) {
    super({
      datasources: { db: { url: configuration.database.url } },
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(
        `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  public async transaction<TValue>(
    operation: (client: PrismaTransactionClient) => Promise<TValue>,
  ): Promise<TValue> {
    return this.$transaction(operation, {
      maxWait: 5_000,
      timeout: 20_000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}
