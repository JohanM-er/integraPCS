import type { Logger } from 'pino';

export interface GraphQLContext extends Record<string, unknown> {
  logger: Logger;
  requestId: string;
}

async function* serverTimeGenerator(): AsyncGenerator<{ serverTime: string }> {
  // Emit current ISO time every second
   
  while (true) {
    yield { serverTime: new Date().toISOString() };
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export const resolvers = {
  Query: {
    health: (_: unknown, __: unknown, _ctx: GraphQLContext): string => {
      return 'ok';
    }
  },
  Subscription: {
    serverTime: {
      subscribe: serverTimeGenerator
    }
  }
};