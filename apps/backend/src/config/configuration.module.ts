import { Global, Module } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import {
  APP_CONFIGURATION,
  buildConfiguration,
  environmentSchema,
  type Environment,
} from './environment.js';

function loadEnvironmentFiles(): void {
  const roots = [process.cwd(), resolve(process.cwd(), '..'), resolve(process.cwd(), '..', '..')];
  for (const root of roots) {
    for (const file of ['.env.local', '.env']) {
      const path = resolve(root, file);
      if (existsSync(path)) {
        loadDotenv({ path, override: false });
      }
    }
  }
}

let cachedEnvironment: Environment | null = null;

export function readEnvironment(): Environment {
  loadEnvironmentFiles();
  cachedEnvironment = environmentSchema.parse(process.env);
  return cachedEnvironment;
}

export function resetEnvironmentCache(): void {
  cachedEnvironment = null;
}

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIGURATION,
      useFactory: () => {
        if (!cachedEnvironment) {
          readEnvironment();
        }
        return buildConfiguration(cachedEnvironment as Environment);
      },
    },
  ],
  exports: [APP_CONFIGURATION],
})
export class ConfigurationModule {}
