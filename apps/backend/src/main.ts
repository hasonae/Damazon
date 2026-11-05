import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { API_ERROR_CODES } from '@damazon/shared-types';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { createClient } from 'redis';
import { AppModule } from './app.module.js';
import { APP_CONFIGURATION, type AppConfiguration } from './config/environment.js';

function isRedisReply(value: unknown): value is RedisReply {
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return true;
  }
  return Array.isArray(value) && value.every(isRedisReply);
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  let redisClient: ReturnType<typeof createClient> | undefined;
  try {
    const configuration = app.get<AppConfiguration>(APP_CONFIGURATION);
    const usesSharedRateLimitStore =
      configuration.environment === 'production' || configuration.environment === 'staging';
    if (usesSharedRateLimitStore && configuration.rateLimit.redisUrl === undefined) {
      throw new Error('REDIS_URL is required for shared rate limiting in staging and production');
    }
    redisClient = usesSharedRateLimitStore
      ? createClient({ url: configuration.rateLimit.redisUrl })
      : undefined;
    if (redisClient !== undefined) {
      redisClient.on('error', () => {
        logger.error('Rate-limit Redis connection failed');
      });
      await redisClient.connect();
    }
    const connectedRedisClient = redisClient;
    const createRateLimitStore = (prefix: string): RedisStore | undefined => {
      if (connectedRedisClient === undefined) {
        return undefined;
      }
      return new RedisStore({
        prefix,
        sendCommand: async (...args: string[]): Promise<RedisReply> => {
          const reply: unknown = await connectedRedisClient.sendCommand(args);
          if (!isRedisReply(reply)) {
            throw new Error('Rate-limit Redis returned an unsupported response');
          }
          return reply;
        },
      });
    };
    const globalRateLimitStore = createRateLimitStore('damazon:rate-limit:global:');
    const authRateLimitStore = createRateLimitStore('damazon:rate-limit:auth:');
    const rateLimitHandler = (_request: Request, response: Response): void => {
      response.status(429).json({
        success: false,
        error: {
          code: API_ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests. Please retry later.',
        },
        meta: {
          requestId: randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
    };

    app.setGlobalPrefix(configuration.http.apiPrefix);
    app.getHttpAdapter().getInstance().set('trust proxy', configuration.http.trustProxyHops);
    app.use(
      helmet({
        contentSecurityPolicy:
          configuration.environment !== 'development' && configuration.environment !== 'test',
      }),
    );
    app.use(compression());
    app.use(cookieParser());
    app.use(
      rateLimit({
        windowMs: configuration.rateLimit.windowMs,
        limit: configuration.rateLimit.maxRequests,
        ...(globalRateLimitStore === undefined ? {} : { store: globalRateLimitStore }),
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        skip: (request) =>
          request.path === `/${configuration.http.apiPrefix}/health` ||
          request.path === `/${configuration.http.apiPrefix}/health/ready`,
        handler: rateLimitHandler,
      }),
    );
    app.use(
      `/${configuration.http.apiPrefix}/auth`,
      rateLimit({
        windowMs: configuration.rateLimit.windowMs,
        limit: configuration.rateLimit.authMaxRequests,
        ...(authRateLimitStore === undefined ? {} : { store: authRateLimitStore }),
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: rateLimitHandler,
      }),
    );
    app.enableCors({
      origin: configuration.http.corsAllowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept-Language'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86_400,
    });
    app.enableShutdownHooks();
    if (connectedRedisClient !== undefined) {
      app.getHttpServer().once('close', () => {
        void connectedRedisClient.quit().catch((error: unknown) => {
          logger.error(
            `Failed to close rate-limit Redis connection: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      });
    }

    await app.listen(configuration.http.port, '0.0.0.0');
    logger.log(
      `Damazon API listening on port ${configuration.http.port} in ${configuration.environment} mode`,
    );
  } catch (error) {
    try {
      await app.close();
    } catch {
      logger.error('Failed to close the application after startup failure');
    }
    if (redisClient?.isOpen) {
      try {
        await redisClient.quit();
      } catch {
        logger.error('Failed to close rate-limit Redis during startup cleanup');
      }
    }
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    `Failed to start the Damazon API: ${error instanceof Error ? error.message : String(error)}`,
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});
