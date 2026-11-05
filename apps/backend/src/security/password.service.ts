import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIGURATION, type AppConfiguration } from '../config/environment.js';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const ALGORITHM = 'scrypt';
const KEY_LENGTH_BYTES = 64;
const SALT_LENGTH_BYTES = 32;

export class PasswordPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'PasswordPolicyError';
  }
}

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

export interface PasswordPolicyResult {
  readonly valid: boolean;
  readonly failures: readonly string[];
}

export function evaluatePasswordPolicy(password: string): PasswordPolicyResult {
  const failures: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    failures.push(`must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    failures.push(`must be at most ${PASSWORD_MAX_LENGTH} characters long`);
  }
  if (!/[a-z]/.test(password)) {
    failures.push('must contain a lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    failures.push('must contain an uppercase letter');
  }
  if (!/\d/.test(password)) {
    failures.push('must contain a digit');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    failures.push('must contain a symbol');
  }
  return { valid: failures.length === 0, failures };
}

export function assertPasswordPolicy(password: string): void {
  const result = evaluatePasswordPolicy(password);
  if (!result.valid) {
    throw new PasswordPolicyError(`Password ${result.failures.join(', ')}`);
  }
}

@Injectable()
export class PasswordService {
  private readonly cost: number;

  private readonly blockSize: number;

  private readonly parallelization: number;

  private readonly maxAgeDays: number;

  public constructor(@Inject(APP_CONFIGURATION) configuration: AppConfiguration) {
    this.cost = configuration.password.scryptCost;
    this.blockSize = configuration.password.scryptBlockSize;
    this.parallelization = configuration.password.scryptParallelization;
    this.maxAgeDays = configuration.password.maxAgeDays;
  }

  private get maxMemory(): number {
    return 256 * this.cost * this.blockSize * 4;
  }

  public async hash(password: string): Promise<string> {
    assertPasswordPolicy(password);
    const salt = randomBytes(SALT_LENGTH_BYTES);
    const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH_BYTES, {
      N: this.cost,
      r: this.blockSize,
      p: this.parallelization,
      maxmem: this.maxMemory,
    });
    return [
      ALGORITHM,
      this.cost,
      this.blockSize,
      this.parallelization,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  }

  public async verify(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== ALGORITHM) {
      return false;
    }
    const [, costValue, blockSizeValue, parallelizationValue, saltValue, hashValue] = parts;
    const cost = Number(costValue);
    const blockSize = Number(blockSizeValue);
    const parallelization = Number(parallelizationValue);
    if (
      !Number.isInteger(cost) ||
      !Number.isInteger(blockSize) ||
      !Number.isInteger(parallelization) ||
      saltValue === undefined ||
      hashValue === undefined
    ) {
      return false;
    }
    const salt = Buffer.from(saltValue, 'base64');
    const expected = Buffer.from(hashValue, 'base64');
    if (salt.length === 0 || expected.length === 0) {
      return false;
    }
    try {
      const actual = await scrypt(password.normalize('NFKC'), salt, expected.length, {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: 256 * cost * blockSize * 4,
      });
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  public needsRehash(storedHash: string): boolean {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== ALGORITHM) {
      return true;
    }
    const cost = Number(parts[1]);
    const blockSize = Number(parts[2]);
    const parallelization = Number(parts[3]);
    return cost < this.cost || blockSize < this.blockSize || parallelization < this.parallelization;
  }

  public isExpired(createdAt: Date, now: Date = new Date()): boolean {
    const ageInDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
    return ageInDays > this.maxAgeDays;
  }

  public async randomToken(byteLength = 48): Promise<string> {
    return randomBytes(byteLength).toString('base64url');
  }
}
