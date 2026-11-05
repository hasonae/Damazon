import { Injectable, type PipeTransform } from '@nestjs/common';
import { type z, type ZodType } from 'zod';
import { ValidationFailedError } from '../errors/domain.error.js';
import type { ApiFieldViolation } from '@damazon/shared-types';

export interface ZodValidationOptions {
  readonly target: 'body' | 'query' | 'params';
}

@Injectable()
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  public constructor(
    private readonly schema: TSchema,
    private readonly options: ZodValidationOptions,
  ) {}

  public transform(value: unknown): z.infer<TSchema> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) {
      return result.data;
    }
    throw new ValidationFailedError(toFieldViolations(result.error, this.options.target));
  }
}

export function toFieldViolations(
  error: z.ZodError,
  target: 'body' | 'query' | 'params' = 'body',
): ApiFieldViolation[] {
  return error.issues.map((issue) => ({
    field: `${target}.${issue.path.join('.')}`.replace(/\.$/, ''),
    message: issue.message,
    code: issue.code,
  }));
}

export function validateOrThrow<TSchema extends ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new ValidationFailedError(toFieldViolations(result.error));
}
