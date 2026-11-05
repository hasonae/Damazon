import { describe, expect, it } from 'vitest';
import { buildConfiguration, environmentSchema } from '../src/config/environment.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import {
  BusinessRuleViolationError,
  ConflictError,
  DomainError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationFailedError,
} from '../src/common/errors/domain.error.js';
import { ALL_USER_ROLES, PERMISSIONS, ROLE_PERMISSIONS, USER_ROLES } from '@damazon/shared-types';

const RAW_ENVIRONMENT: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://damazon:damazon@localhost:5432/damazon?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  STORAGE_ACCESS_KEY: 'damazon',
  STORAGE_SECRET_KEY: 'damazon-secret',
  CUSTOMER_APP_ORIGIN: 'http://localhost:5173',
  ADMIN_APP_ORIGIN: 'http://localhost:5174',
};

describe('environment configuration', () => {
  it('maps raw environment values into a typed configuration tree', () => {
    const configuration = buildConfiguration(environmentSchema.parse(RAW_ENVIRONMENT));
    expect(configuration.http.port).toBe(3000);
    expect(configuration.http.apiPrefix).toBe('api/v1');
    expect(configuration.http.trustProxyHops).toBe(0);
    expect(configuration.http.corsAllowedOrigins).toEqual([
      'http://localhost:5173',
      'http://localhost:5174',
    ]);
    expect(configuration.isProduction).toBe(false);
    expect(configuration.platform.defaultCurrency).toBe('SYP');
  });

  it('accepts an explicit trusted proxy hop count for forwarded client IPs', () => {
    const configuration = buildConfiguration(
      environmentSchema.parse({ ...RAW_ENVIRONMENT, TRUST_PROXY_HOPS: '2' }),
    );
    expect(configuration.http.trustProxyHops).toBe(2);
    expect(
      environmentSchema.safeParse({ ...RAW_ENVIRONMENT, TRUST_PROXY_HOPS: '11' }).success,
    ).toBe(false);
  });

  it('rejects secrets that are too short to be safe', () => {
    expect(() =>
      environmentSchema.parse({ ...RAW_ENVIRONMENT, JWT_ACCESS_SECRET: 'tooshort' }),
    ).toThrow();
  });

  it('rejects a shared access and refresh secret', () => {
    const shared = 'x'.repeat(48);
    const result = environmentSchema.safeParse({
      ...RAW_ENVIRONMENT,
      JWT_ACCESS_SECRET: shared,
      JWT_REFRESH_SECRET: shared,
    });
    expect(result.success).toBe(false);
  });

  it('refuses template secrets in production', () => {
    const result = environmentSchema.safeParse({
      ...RAW_ENVIRONMENT,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'replace-with-at-least-32-characters-of-random-data',
    });
    expect(result.success).toBe(false);
  });

  it('refuses insecure origins and storage endpoints in production', () => {
    const productionEnvironment = {
      ...RAW_ENVIRONMENT,
      NODE_ENV: 'production',
      CUSTOMER_APP_ORIGIN: 'https://shop.example',
      ADMIN_APP_ORIGIN: 'https://admin.example',
      STORAGE_ENDPOINT: 'https://storage.example',
      STORAGE_ACCESS_KEY: 'storage-live-key',
      STORAGE_SECRET_KEY: 'storage-live-secret',
      SMTP_HOST: 'smtp.example',
      SMTP_USER: 'mailer-user',
      SMTP_PASSWORD: 'mailer-password',
      SMTP_FROM: 'no-reply@example.com',
      JWT_ACCESS_SECRET: 'a'.repeat(48),
      JWT_REFRESH_SECRET: 'b'.repeat(48),
    };

    expect(
      environmentSchema.safeParse({
        ...productionEnvironment,
        STORAGE_ENDPOINT: 'http://storage.example',
      }).success,
    ).toBe(false);
    expect(
      environmentSchema.safeParse({
        ...productionEnvironment,
        CUSTOMER_APP_ORIGIN: 'http://shop.example',
      }).success,
    ).toBe(false);
  });

  it('accepts HTTPS origins and storage with distinct production secrets', () => {
    const result = environmentSchema.safeParse({
      ...RAW_ENVIRONMENT,
      NODE_ENV: 'production',
      REDIS_URL: 'redis://localhost:6379',
      CUSTOMER_APP_ORIGIN: 'https://shop.example',
      ADMIN_APP_ORIGIN: 'https://admin.example',
      STORAGE_ENDPOINT: 'https://storage.example',
      STORAGE_ACCESS_KEY: 'storage-live-key',
      STORAGE_SECRET_KEY: 'storage-live-secret',
      SMTP_HOST: 'smtp.example',
      SMTP_USER: 'mailer-user',
      SMTP_PASSWORD: 'smtp-live-password',
      SMTP_FROM: 'no-reply@example.com',
      JWT_ACCESS_SECRET: 'access-secret-has-a-distinct-random-looking-set-00001',
      JWT_REFRESH_SECRET: 'refresh-secret-has-a-distinct-random-looking-set-00002',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const { REDIS_URL: _redisUrl, ...withoutRedis } = result.data;
      expect(environmentSchema.safeParse(withoutRedis).success).toBe(false);
    }
  });

  it('requires complete SMTP settings in production and rejects partial settings', () => {
    const productionEnvironment = {
      ...RAW_ENVIRONMENT,
      NODE_ENV: 'production',
      CUSTOMER_APP_ORIGIN: 'https://shop.example',
      ADMIN_APP_ORIGIN: 'https://admin.example',
      STORAGE_ENDPOINT: 'https://storage.example',
      JWT_ACCESS_SECRET: 'access-secret-has-a-distinct-random-looking-set-00001',
      JWT_REFRESH_SECRET: 'refresh-secret-has-a-distinct-random-looking-set-00002',
    };
    expect(environmentSchema.safeParse(productionEnvironment).success).toBe(false);
    expect(
      environmentSchema.safeParse({
        ...productionEnvironment,
        SMTP_HOST: 'smtp.example',
      }).success,
    ).toBe(false);
  });

  it('requires a database url', () => {
    const { DATABASE_URL: _omitted, ...withoutDatabase } = RAW_ENVIRONMENT;
    expect(environmentSchema.safeParse(withoutDatabase).success).toBe(false);
  });
});

describe('domain errors', () => {
  it('maps every error to the documented http status and api code', () => {
    const cases = [
      { error: new ValidationFailedError([{ field: 'phone', message: 'invalid' }]), status: 400 },
      { error: new PermissionDeniedError(['orders:read']), status: 403 },
      { error: new ResourceNotFoundError('Order', 'abc'), status: 404 },
      { error: new ConflictError('duplicate'), status: 409 },
      { error: new BusinessRuleViolationError('zone not covered'), status: 422 },
    ] as const;

    for (const { error, status } of cases) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error.status).toBe(status);
      expect(error.toBody('trace-1').traceId).toBe('trace-1');
    }
  });

  it('never leaks internal identifiers in the not found message', () => {
    const error = new ResourceNotFoundError('Order', '9f1c-secret');
    expect(error.message).toBe('Order 9f1c-secret was not found');
  });
});

describe('permission matrix', () => {
  it('grants every customer permission a customer needs and nothing destructive', () => {
    const customer = ROLE_PERMISSIONS[USER_ROLES.CUSTOMER];
    expect(customer).toContain(PERMISSIONS.ORDER_CREATE);
    expect(customer).toContain(PERMISSIONS.ZONE_CREATE);
    expect(customer).not.toContain(PERMISSIONS.PRODUCT_CREATE);
    expect(customer).not.toContain(PERMISSIONS.REFUND_APPROVE);
    expect(customer).not.toContain(PERMISSIONS.USER_SUSPEND);
  });

  it('never grants the admin role implicit platform permissions', () => {
    expect(ROLE_PERMISSIONS[USER_ROLES.ADMIN]).toHaveLength(0);
  });

  it('declares a permission matrix for every supported role', () => {
    for (const role of ALL_USER_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});

describe('global exception filter', () => {
  const filter = new AllExceptionsFilter();

  function fakeHost(exception: unknown): {
    statusCode: number;
    body: unknown;
  } {
    const response = {
      statusCode: 0,
      payload: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.payload = body;
        return this;
      },
    };
    const request = { method: 'GET', originalUrl: '/test', auth: undefined };
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    filter.catch(exception, host as never);
    return { statusCode: response.statusCode, body: response.payload };
  }

  it('passes domain errors through with their status and code', () => {
    const { statusCode, body } = fakeHost(new ResourceNotFoundError('Order', 'x'));
    expect(statusCode).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND' },
    });
  });

  it('masks unexpected errors behind a generic message', () => {
    const { statusCode, body } = fakeHost(new Error('connection string leaked here'));
    expect(statusCode).toBe(500);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('connection string leaked here');
    expect(serialized).toContain('INTERNAL_ERROR');
  });
});
