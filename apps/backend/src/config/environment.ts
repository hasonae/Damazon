import { z } from 'zod';

const BOOLEAN_FROM_STRING = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === 'boolean' ? value : value.toLowerCase() === 'true'));

const CSV_LIST = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    Array.isArray(value) ? value : value.split(',').map((entry) => entry.trim()),
  )
  .transform((entries) => entries.filter((entry) => entry.length > 0));

const MIN_SECRET_LENGTH = 32;

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_PREFIX: z.string().default('api/v1'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    LOG_LEVEL: z
      .enum(['error', 'warn', 'log', 'info', 'debug', 'verbose'])
      .default('log')
      .transform((level) => (level === 'info' ? 'log' : level)),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(200).default(20),

    REDIS_URL: z.string().url().optional(),

    JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(300).default(1_209_600),

    PASSWORD_SCRYPT_COST: z.coerce.number().int().min(14).max(20).default(16),
    PASSWORD_SCRYPT_BLOCK_SIZE: z.coerce.number().int().min(8).max(32).default(8),
    PASSWORD_SCRYPT_PARALLELIZATION: z.coerce.number().int().min(1).max(8).default(1),
    PASSWORD_MAX_AGE_DAYS: z.coerce.number().int().min(30).max(1095).default(180),

    LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    LOGIN_LOCK_DURATION_SECONDS: z.coerce.number().int().min(60).default(900),

    STORAGE_ENDPOINT: z.string().default('http://localhost:9000'),
    STORAGE_BUCKET: z.string().default('damazon-media'),
    STORAGE_ACCESS_KEY: z.string().min(1),
    STORAGE_SECRET_KEY: z.string().min(1),
    STORAGE_REGION: z.string().default('syria'),
    STORAGE_FORCE_PATH_STYLE: BOOLEAN_FROM_STRING.default(true),

    SMTP_HOST: z.string().trim().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: BOOLEAN_FROM_STRING.default(false),
    SMTP_USER: z.string().trim().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_FROM: z.string().trim().email().optional(),

    CUSTOMER_APP_ORIGIN: z.string().url(),
    ADMIN_APP_ORIGIN: z.string().url(),
    CORS_ALLOWED_ORIGINS: CSV_LIST.default([]),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(120),
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(10),

    DEFAULT_COUNTRY: z.string().length(2).default('SY'),
    DEFAULT_CURRENCY: z.string().length(3).default('SYP'),
    DEFAULT_LOCALE: z.enum(['ar', 'en']).default('ar'),
  })
  .superRefine((environment, context) => {
    if (environment.JWT_ACCESS_SECRET === environment.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }
    const smtpValues = [
      environment.SMTP_HOST,
      environment.SMTP_USER,
      environment.SMTP_PASSWORD,
      environment.SMTP_FROM,
    ];
    if (
      smtpValues.some((value) => value !== undefined) &&
      smtpValues.some((value) => value === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured together',
      });
    }
    if (environment.NODE_ENV === 'production' || environment.NODE_ENV === 'staging') {
      if (environment.REDIS_URL === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['REDIS_URL'],
          message: 'REDIS_URL is required for shared rate limiting in staging and production',
        });
      }

      const templateValues: Partial<Record<keyof Environment, readonly string[]>> = {
        JWT_ACCESS_SECRET: ['replace-with-at-least-32-characters-of-random-data'],
        JWT_REFRESH_SECRET: ['replace-with-a-different-random-secret-of-32-plus-chars'],
        STORAGE_ACCESS_KEY: ['damazon', 'replace-with-storage-access-key'],
        STORAGE_SECRET_KEY: ['replace-with-storage-secret'],
        SMTP_PASSWORD: ['replace-with-smtp-password'],
      };
      for (const [key, values] of Object.entries(templateValues) as [
        keyof Environment,
        readonly string[],
      ][]) {
        const value = environment[key];
        if (typeof value === 'string' && values.includes(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} still holds a template value and cannot be used in production`,
          });
        }
      }

      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        const distinctCharacters = new Set(environment[key]).size;
        if (distinctCharacters < 12) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} does not contain enough distinct characters for production`,
          });
        }
      }

      if (smtpValues.some((value) => value === undefined)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_HOST'],
          message: 'SMTP settings are required for email verification and password recovery',
        });
      }
      if (environment.SMTP_PORT === 465 && !environment.SMTP_SECURE) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_SECURE'],
          message: 'SMTP_SECURE must be true when SMTP_PORT is 465',
        });
      }
      if (environment.SMTP_SECURE && environment.SMTP_PORT !== 465) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_SECURE'],
          message: 'SMTP_SECURE is supported only with implicit TLS on port 465',
        });
      }

      const secureUrls = ['CUSTOMER_APP_ORIGIN', 'ADMIN_APP_ORIGIN', 'STORAGE_ENDPOINT'];
      for (const key of secureUrls as (keyof Environment)[]) {
        const value = environment[key];
        if (typeof value === 'string' && !value.startsWith('https://')) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} must use HTTPS in production`,
          });
        }
      }

      if (environment.CORS_ALLOWED_ORIGINS.length > 0) {
        for (const origin of environment.CORS_ALLOWED_ORIGINS) {
          if (!origin.startsWith('https://')) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['CORS_ALLOWED_ORIGINS'],
              message: 'Every production CORS origin must use HTTPS',
            });
            break;
          }
        }
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export interface AppConfiguration {
  readonly environment: Environment['NODE_ENV'];
  readonly isProduction: boolean;
  readonly http: {
    readonly port: number;
    readonly apiPrefix: string;
    readonly trustProxyHops: number;
    readonly customerAppOrigin: string;
    readonly corsAllowedOrigins: readonly string[];
  };
  readonly logging: {
    readonly level: Environment['LOG_LEVEL'];
  };
  readonly database: {
    readonly url: string;
    readonly poolSize: number;
  };
  readonly cache: {
    readonly redisUrl: string;
  };
  readonly auth: {
    readonly accessSecret: string;
    readonly refreshSecret: string;
    readonly accessTtlSeconds: number;
    readonly refreshTtlSeconds: number;
    readonly loginMaxFailedAttempts: number;
    readonly loginLockDurationSeconds: number;
  };
  readonly password: {
    readonly scryptCost: number;
    readonly scryptBlockSize: number;
    readonly scryptParallelization: number;
    readonly maxAgeDays: number;
  };
  readonly storage: {
    readonly endpoint: string;
    readonly bucket: string;
    readonly accessKey: string;
    readonly secretKey: string;
    readonly region: string;
    readonly forcePathStyle: boolean;
  };
  readonly email: {
    readonly smtpHost: string | undefined;
    readonly smtpPort: number;
    readonly smtpSecure: boolean;
    readonly smtpUser: string | undefined;
    readonly smtpPassword: string | undefined;
    readonly smtpFrom: string | undefined;
    readonly isConfigured: boolean;
  };
  readonly rateLimit: {
    readonly windowMs: number;
    readonly maxRequests: number;
    readonly authMaxRequests: number;
    readonly redisUrl: string | undefined;
  };
  readonly platform: {
    readonly defaultCountry: string;
    readonly defaultCurrency: string;
    readonly defaultLocale: Environment['DEFAULT_LOCALE'];
  };
}

export function buildConfiguration(environment: Environment): AppConfiguration {
  return {
    environment: environment.NODE_ENV,
    isProduction: environment.NODE_ENV === 'production',
    http: {
      port: environment.PORT,
      apiPrefix: environment.API_PREFIX,
      trustProxyHops: environment.TRUST_PROXY_HOPS,
      customerAppOrigin: environment.CUSTOMER_APP_ORIGIN,
      corsAllowedOrigins:
        environment.CORS_ALLOWED_ORIGINS.length > 0
          ? environment.CORS_ALLOWED_ORIGINS
          : [environment.CUSTOMER_APP_ORIGIN, environment.ADMIN_APP_ORIGIN],
    },
    logging: { level: environment.LOG_LEVEL },
    database: {
      url: environment.DATABASE_URL,
      poolSize: environment.DATABASE_POOL_SIZE,
    },
    cache: { redisUrl: environment.REDIS_URL ?? 'redis://localhost:6379' },
    auth: {
      accessSecret: environment.JWT_ACCESS_SECRET,
      refreshSecret: environment.JWT_REFRESH_SECRET,
      accessTtlSeconds: environment.JWT_ACCESS_TTL_SECONDS,
      refreshTtlSeconds: environment.JWT_REFRESH_TTL_SECONDS,
      loginMaxFailedAttempts: environment.LOGIN_MAX_FAILED_ATTEMPTS,
      loginLockDurationSeconds: environment.LOGIN_LOCK_DURATION_SECONDS,
    },
    password: {
      scryptCost: environment.PASSWORD_SCRYPT_COST,
      scryptBlockSize: environment.PASSWORD_SCRYPT_BLOCK_SIZE,
      scryptParallelization: environment.PASSWORD_SCRYPT_PARALLELIZATION,
      maxAgeDays: environment.PASSWORD_MAX_AGE_DAYS,
    },
    storage: {
      endpoint: environment.STORAGE_ENDPOINT,
      bucket: environment.STORAGE_BUCKET,
      accessKey: environment.STORAGE_ACCESS_KEY,
      secretKey: environment.STORAGE_SECRET_KEY,
      region: environment.STORAGE_REGION,
      forcePathStyle: environment.STORAGE_FORCE_PATH_STYLE,
    },
    email: {
      smtpHost: environment.SMTP_HOST,
      smtpPort: environment.SMTP_PORT,
      smtpSecure: environment.SMTP_SECURE,
      smtpUser: environment.SMTP_USER,
      smtpPassword: environment.SMTP_PASSWORD,
      smtpFrom: environment.SMTP_FROM,
      isConfigured:
        environment.SMTP_HOST !== undefined &&
        environment.SMTP_USER !== undefined &&
        environment.SMTP_PASSWORD !== undefined &&
        environment.SMTP_FROM !== undefined,
    },
    rateLimit: {
      windowMs: environment.RATE_LIMIT_WINDOW_MS,
      maxRequests: environment.RATE_LIMIT_MAX_REQUESTS,
      authMaxRequests: environment.AUTH_RATE_LIMIT_MAX_REQUESTS,
      redisUrl: environment.REDIS_URL,
    },
    platform: {
      defaultCountry: environment.DEFAULT_COUNTRY,
      defaultCurrency: environment.DEFAULT_CURRENCY,
      defaultLocale: environment.DEFAULT_LOCALE,
    },
  };
}

export const APP_CONFIGURATION = 'APP_CONFIGURATION';
