import 'dotenv/config';

import http from 'http';

import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';

import { corsMiddleware, graphqlRateLimitMiddleware, applySecurityHeaders, closeRateLimiterRedis } from '@platform/security';
import { loadEnv } from '@platform/config';
import { logger } from '@platform/observability';

import { buildSchema, createApolloServer, attachWsServer } from './graphql/server';
import { createContext, type GraphQLContext } from './graphql/context';

async function main(): Promise<void> {
  const env = loadEnv();

  // Build GraphQL schema (compose platform base + contexts)
  const schema = buildSchema();

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
  app.use(env.GRAPHQL_PATH, graphqlRateLimitMiddleware as any);

  // Apollo Server
  const apollo = createApolloServer(schema);
  await apollo.start();

  app.use(env.GRAPHQL_PATH, expressMiddleware<GraphQLContext>(apollo, { context: createContext as any }));

  // HTTP server
  const httpServer = http.createServer(app);

  // WebSocket server for graphql-ws protocol
  const wsCleanup = attachWsServer({
    httpServer,
    path: env.SUBSCRIPTIONS_PATH,
    schema
  });

  // Start listening
  httpServer.listen(env.GRAPHQL_PORT, () => {
    const httpUrl = `http://localhost:${env.GRAPHQL_PORT}${env.GRAPHQL_PATH}`;
    const wsUrl = `ws://localhost:${env.GRAPHQL_PORT}${env.SUBSCRIPTIONS_PATH}`;
    logger.info({ httpUrl, wsUrl }, 'GraphQL API gateway ready');
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down API gateway...');
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