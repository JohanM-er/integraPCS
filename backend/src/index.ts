import 'dotenv/config';
import { randomUUID } from 'crypto';
import http from 'http';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware, type ExpressContextFunctionArgument } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import express from 'express';
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';

import { resolvers, type GraphQLContext } from './graphql/resolvers';
import { typeDefs } from './graphql/typeDefs';
import corsMiddleware from './middleware/cors';
import { graphqlRateLimitMiddleware, closeRateLimiterRedis } from './middleware/rateLimiter';
import { applySecurityHeaders } from './middleware/security';
import { loadEnv } from './shared/env';
import { logger } from './shared/logger';

async function main(): Promise<void> {
  const env = loadEnv();

  // Build schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers
  });

  // Create Express app
  const app = express();

  // Security headers
  applySecurityHeaders(app);

  // CORS
  app.use(corsMiddleware);

  // JSON body parser
  app.use(express.json({ limit: '1mb' }));

  // Health endpoints
  app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/ready', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Rate limiting for GraphQL endpoint
  app.use(env.GRAPHQL_PATH, graphqlRateLimitMiddleware);

  // Apollo Server
  const apollo = new ApolloServer<GraphQLContext>({ schema });
  await apollo.start();

  app.use(
    env.GRAPHQL_PATH,
    expressMiddleware(apollo, {
      context: async (_args: ExpressContextFunctionArgument): Promise<GraphQLContext> => ({
        logger,
        requestId: randomUUID()
      })
    })
  );

  // HTTP server
  const httpServer = http.createServer(app);

  // WebSocket server for graphql-ws protocol
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: env.SUBSCRIPTIONS_PATH
  });

  const wsCleanup = useServer<GraphQLContext>(
    {
      schema,
      context: async (): Promise<GraphQLContext> => ({
        logger,
        requestId: randomUUID()
      })
    },
    wsServer
  );

  // Start listening
  httpServer.listen(env.GRAPHQL_PORT, () => {
    const httpUrl = `http://localhost:${env.GRAPHQL_PORT}${env.GRAPHQL_PATH}`;
    const wsUrl = `ws://localhost:${env.GRAPHQL_PORT}${env.SUBSCRIPTIONS_PATH}`;
    logger.info({ httpUrl, wsUrl }, 'GraphQL server ready');
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down GraphQL server...');
    try {
      await apollo.stop();
    } catch (err) {
      logger.error({ err }, 'Error stopping Apollo Server');
    }
    try {
      await wsCleanup.dispose();
    } catch (err) {
      logger.error({ err }, 'Error disposing WebSocket server');
    }
    try {
      await closeRateLimiterRedis();
    } catch (err) {
      logger.error({ err }, 'Error closing Redis connection for rate limiter');
    }
    httpServer.close((err?: Error) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
        process.exit(1);
      } else {
        process.exit(0);
      }
    });
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();