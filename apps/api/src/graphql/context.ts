import { randomUUID } from 'crypto';

import type { Logger } from 'pino';

import { SimpleAuthService, type User } from '@platform/auth';
import { logger } from '@platform/observability';

export type GraphQLContext = {
  logger: Logger;
  requestId: string;
  user: User | null;
};

const auth = new SimpleAuthService();

function extractBearerToken(authorizationHeader?: string | null): string | null {
  if (!authorizationHeader) return null;
  const m = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : authorizationHeader;
}

export function createContext(args: { req: { headers?: Record<string, string | undefined> } }): GraphQLContext {
  const headers = args.req.headers || {};
  const authHeader = (headers.authorization ?? (headers as any).Authorization) as string | undefined;
  const token = extractBearerToken(authHeader);
  const user = auth.verify(token);

  return {
    logger,
    requestId: randomUUID(),
    user
  };
}