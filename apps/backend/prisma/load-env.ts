import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const backendDirectory = resolve(process.cwd());
const rootEnv = resolve(backendDirectory, '..', '..', '.env');
const localEnv = resolve(backendDirectory, '.env');

if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv });
}

if (existsSync(localEnv)) {
  loadEnv({ path: localEnv, override: true });
}
