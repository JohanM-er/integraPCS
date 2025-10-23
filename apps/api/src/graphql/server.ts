import http from 'http';
import { randomUUID } from 'crypto';

import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';

import { baseTypeDefs, baseResolvers, mergeTypeDefs, mergeResolvers } from '@platform/graphql';
import { logger } from '@platform/observability';
import { SimpleAuthService } from '@platform/auth';
import { typeDefs as workPackageTypeDefs, resolvers as workPackageResolvers } from '@contexts/work-package/interfaces/graphql';

import type { GraphQLContext } from './context';

export function buildSchema(): GraphQLSchema {
  const typeDefs = mergeTypeDefs([baseTypeDefs, workPackageTypeDefs]);
  const resolvers = mergeResolvers([baseResolvers, workPackageResolvers]);

  return makeExecutableSchema({
    typeDefs,
    resolvers
  });
}

export function createApolloServer(schema: GraphQLSchema): ApolloServer<GraphQLContext> {
  return new ApolloServer<GraphQLContext>({ schema });
}

export function attachWsServer(params: {
  httpServer: http.Server;
  path: string;
  schema: GraphQLSchema;
}): { dispose: () => Promise<void> } {
  const { httpServer, path, schema } = params;

  const wsServer = new WebSocketServer({
    server: httpServer,
    path
  });

  const auth = new SimpleAuthService();

  const cleanup = useServer<GraphQLContext>(
    {
      schema,
      context: async (ctx): Promise<GraphQLContext> => {
        const cp = ctx.connectionParams as Record<string, unknown> | undefined;
        let token: string | null = null;

        if (cp) {
          const authHeader =
            (typeof cp.authorization === 'string' && (cp.authorization as string)) ||
            (typeof cp.Authorization === 'string' && (cp.Authorization as string)) ||
            null;
          token = authHeader
            ? (authHeader as string).replace(/^Bearer\s+/i, '')
            : typeof cp.token === 'string'
              ? (cp.token as string)
              : null;
        }

        const user = auth.verify(token);
        return {
          logger,
          requestId: randomUUID(),
          user
        };
      }
    },
    wsServer
  );

  return {
    dispose: async () => {
      await cleanup.dispose();
      wsServer.close();
    }
  };
}