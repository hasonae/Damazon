/**
 * Endpoint group for service health, used by both applications' status screens
 * and by deployment probes.
 */

import type { ApiClient } from '../client.js';

export interface HealthReport {
  readonly status: 'ok' | 'degraded' | 'down';
  readonly uptimeSeconds: number;
  readonly environment: string;
  readonly apiVersion: string;
  readonly checks: ReadonlyArray<{ readonly name: string; readonly healthy: boolean }>;
}

export class HealthApi {
  public constructor(private readonly client: ApiClient) {}

  public async check(): Promise<HealthReport> {
    return this.client.get<HealthReport>('/health', {
      anonymous: true,
      cacheKey: 'health',
      cacheTtlMs: 5_000,
    });
  }

  public async ready(): Promise<HealthReport> {
    return this.client.get<HealthReport>('/health/ready', { anonymous: true, cacheTtlMs: 0 });
  }
}
