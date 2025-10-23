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

export async function createContext({ req }: { req: any }): Promise<GraphQLContext> {
  const headers = req.headers || {};
  const authHeader = headers.authorization || headers.Authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;
  const user = auth.verify(token);

  return {
    logger,
    requestId: randomUUID(),
    user
  };
}