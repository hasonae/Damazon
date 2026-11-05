import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { APP_CONFIGURATION, type AppConfiguration } from '../../config/environment.js';

export interface DependencyCheck {
  readonly name: string;
  readonly healthy: boolean;
}

export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly uptimeSeconds: number;
  readonly environment: string;
  readonly apiVersion: string;
  readonly checks: readonly DependencyCheck[];
}

@Injectable()
export class HealthService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIGURATION) private readonly configuration: AppConfiguration,
  ) {}

  public async check(): Promise<HealthReport> {
    const databaseHealthy = await this.prisma.isHealthy();
    return {
      status: databaseHealthy ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      environment: this.configuration.environment,
      apiVersion: this.configuration.http.apiPrefix,
      checks: [{ name: 'database', healthy: databaseHealthy }],
    };
  }
}
