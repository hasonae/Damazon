import { describe, expect, it, beforeEach } from 'vitest';
import {
  PasswordPolicyError,
  PasswordService,
  evaluatePasswordPolicy,
} from '../src/security/password.service.js';
import { buildConfiguration, environmentSchema } from '../src/config/environment.js';

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

function buildService(): PasswordService {
  const environment = environmentSchema.parse(RAW_ENVIRONMENT);
  return new PasswordService(buildConfiguration(environment));
}

const STRONG_PASSWORD = 'Damaz0n!Commerce2026';

describe('password policy', () => {
  it('accepts a strong password', () => {
    expect(evaluatePasswordPolicy(STRONG_PASSWORD).valid).toBe(true);
  });

  it('reports every unmet requirement', () => {
    const result = evaluatePasswordPolicy('short');
    expect(result.valid).toBe(false);
    expect(result.failures.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects passwords that only satisfy length', () => {
    expect(evaluatePasswordPolicy('aaaaaaaaaaaaaa').valid).toBe(false);
  });
});

describe('password hashing', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = buildService();
  });

  it('produces a scrypt hash with parameters and never stores the password', async () => {
    const hash = await service.hash(STRONG_PASSWORD);
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain(STRONG_PASSWORD);
    expect(hash.split('$')).toHaveLength(6);
  });

  it('produces a different hash each time for the same password', async () => {
    const first = await service.hash(STRONG_PASSWORD);
    const second = await service.hash(STRONG_PASSWORD);
    expect(first).not.toBe(second);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await service.hash(STRONG_PASSWORD);
    await expect(service.verify(STRONG_PASSWORD, hash)).resolves.toBe(true);
    await expect(service.verify(`${STRONG_PASSWORD}x`, hash)).resolves.toBe(false);
  });

  it('rejects malformed or foreign hash formats without throwing', async () => {
    for (const hash of ['', 'plaintext', 'bcrypt$1$2$3$4$5', 'scrypt$1$2$3']) {
      await expect(service.verify(STRONG_PASSWORD, hash)).resolves.toBe(false);
    }
  });

  it('refuses to hash a password that violates the policy', async () => {
    await expect(service.hash('weak')).rejects.toThrow(PasswordPolicyError);
  });

  it('detects hashes that need rehashing and hashes past the maximum age', async () => {
    const hash = await service.hash(STRONG_PASSWORD);
    expect(service.needsRehash(hash)).toBe(false);
    expect(service.needsRehash('bcrypt$legacy$hash')).toBe(true);
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    expect(service.isExpired(createdAt, new Date('2026-01-10T00:00:00.000Z'))).toBe(false);
    expect(service.isExpired(createdAt, new Date('2026-12-01T00:00:00.000Z'))).toBe(true);
  });

  it('generates high entropy random tokens', async () => {
    const first = await service.randomToken();
    const second = await service.randomToken();
    expect(first).toHaveLength(64);
    expect(first).not.toBe(second);
  });
});
