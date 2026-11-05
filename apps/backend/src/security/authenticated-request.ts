import type { Request } from 'express';
import type { AuthPrincipal } from './token.service.js';

export interface RequestMetadata {
  readonly requestId: string;
  readonly ipAddress: string;
  readonly userAgent: string | undefined;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthPrincipal;
  requestId?: string;
  metadata?: RequestMetadata;
}
