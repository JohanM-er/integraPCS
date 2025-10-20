# Infrastructure Setup: Production Patterns

## Overview

Production-ready patterns for integraPCS infrastructure components:
- Redis PubSub with proper connection management
- Neo4j driver with graceful shutdown
- RabbitMQ with auto-reconnect and resilience
- Pino logging with correlation IDs and secret redaction
- Zod-based config validation
- Health/readiness probes
- OpenTelemetry observability

---

## 1. Redis PubSub Configuration

### Issue
`graphql-redis-subscriptions@2.7.0` requires **two separate Redis connections** (publisher and subscriber) for proper PubSub operation.

### Implementation

#### File: `backend/src/infrastructure/redis/pubsub.ts`

```typescript
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../logger';

export interface RedisPubSubConfig {
  host: string;
  port: number;
  password?: string;
  tls?: boolean;
  retryDelayMs?: number;
  maxRetries?: number;
}

export function createPubSub(config: RedisPubSubConfig): RedisPubSub {
  const options: RedisOptions = {
    host: config.host,
    port: config.port,
    password: config.password,
    retryStrategy: (times: number) => {
      const maxRetries = config.maxRetries || 10;
      if (times > maxRetries) {
        logger.error('Redis max retries exceeded, giving up');
        return null; // Stop retrying
      }
      const delay = Math.min(times * (config.retryDelayMs || 50), 2000);
      logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err) => {
      logger.error({ err }, 'Redis connection error, attempting reconnect');
      return true; // Always attempt reconnect
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false
  };

  // Add TLS if enabled
  if (config.tls) {
    options.tls = {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    };
  }

  // Create separate connections for pub and sub
  const publisher = new Redis(options);
  const subscriber = new Redis(options);

  // Log connection events
  publisher.on('connect', () => logger.info('Redis publisher connected'));
  publisher.on('error', (err) => logger.error({ err }, 'Redis publisher error'));

  subscriber.on('connect', () => logger.info('Redis subscriber connected'));
  subscriber.on('error', (err) => logger.error({ err }, 'Redis subscriber error'));

  return new RedisPubSub({
    publisher,
    subscriber
  });
}

// Graceful shutdown
export async function closePubSub(pubSub: RedisPubSub): Promise<void> {
  logger.info('Closing Redis PubSub connections');
  // Access internal connections via type assertion
  const connections = (pubSub as any);
  await connections.publisher?.quit();
  await connections.subscriber?.quit();
}
```

#### Environment Variables

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
REDIS_RETRY_DELAY_MS=50
REDIS_MAX_RETRIES=10
```

---

## 2. Graceful Shutdown Pattern

### Issue
Apollo Server 4 requires external HTTP server management. Proper shutdown must drain connections and close resources (Neo4j driver, Redis, RabbitMQ).

### Implementation

#### File: `backend/src/index.ts`

```typescript
import http from 'http';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

import { logger } from './infrastructure/logger';
import { getDriver, closeDriver } from './infrastructure/neo4j/driver';
import { createPubSub, closePubSub } from './infrastructure/redis/pubsub';
import { closeRabbitMQ } from './infrastructure/rabbitmq/connection';

let httpServer: http.Server;
let wsCleanup: () => Promise<void>;
let pubSub: RedisPubSub;

async function startServer() {
  const app = express();
  httpServer = http.createServer(app);

  // Initialize infrastructure
  const neo4jDriver = getDriver();
  pubSub = createPubSub({
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true'
  });

  // WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql'
  });

  wsCleanup = useServer({ schema, context: createContext }, wsServer).dispose;

  // Apollo Server with drain plugin
  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsCleanup();
            }
          };
        }
      }
    ]
  });

  await server.start();

  app.use('/graphql', expressMiddleware(server, { context: createContext }));

  const PORT = Number(process.env.GRAPHQL_PORT) || 3000;
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  try {
    // 1. Stop accepting new connections
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    // 2. Close WebSocket connections
    if (wsCleanup) {
      await wsCleanup();
      logger.info('WebSocket server closed');
    }

    // 3. Close Redis PubSub
    if (pubSub) {
      await closePubSub(pubSub);
      logger.info('Redis PubSub closed');
    }

    // 4. Close RabbitMQ
    await closeRabbitMQ();
    logger.info('RabbitMQ connection closed');

    // 5. Close Neo4j driver
    await closeDriver();
    logger.info('Neo4j driver closed');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  gracefulShutdown('unhandledRejection');
});

startServer().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
```

#### Neo4j Driver Singleton

#### File: `backend/src/infrastructure/neo4j/driver.ts`

```typescript
import neo4j, { Driver, Session } from 'neo4j-driver';
import { logger } from '../logger';

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 60000,
        logging: {
          level: 'info',
          logger: (level, message) => logger.info({ level }, message)
        }
      }
    );

    logger.info('Neo4j driver initialized');
  }

  return driver;
}

export function getSession(mode: 'READ' | 'WRITE' = 'WRITE'): Session {
  const sessionMode = mode === 'READ' ? neo4j.session.READ : neo4j.session.WRITE;
  return getDriver().session({ defaultAccessMode: sessionMode });
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    logger.info('Neo4j driver closed');
  }
}
```

---

## 3. RabbitMQ Connection Management

### Issue
`amqplib` lacks automatic reconnection. Use `amqp-connection-manager` for resilience, add consumer prefetch, and configure dead-letter queues.

### Dependencies

```json
{
  "dependencies": {
    "amqp-connection-manager": "^4.1.14",
    "amqplib": "^0.10.9"
  }
}
```

### Implementation

#### File: `backend/src/infrastructure/rabbitmq/connection.ts`

```typescript
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { logger } from '../logger';

let connection: AmqpConnectionManager | null = null;
let publisherChannel: ChannelWrapper | null = null;
let consumerChannel: ChannelWrapper | null = null;

export interface RabbitMQConfig {
  url: string;
  heartbeatSeconds?: number;
  reconnectDelayMs?: number;
}

export async function createConnection(config: RabbitMQConfig): Promise<void> {
  connection = amqp.connect([config.url], {
    heartbeatIntervalInSeconds: config.heartbeatSeconds || 30,
    reconnectTimeInSeconds: (config.reconnectDelayMs || 2000) / 1000
  });

  connection.on('connect', () => logger.info('RabbitMQ connected'));
  connection.on('disconnect', ({ err }) =>
    logger.warn({ err }, 'RabbitMQ disconnected')
  );
  connection.on('connectFailed', ({ err }) =>
    logger.error({ err }, 'RabbitMQ connection failed')
  );

  // Publisher channel (with confirms)
  publisherChannel = connection.createChannel({
    json: false,
    setup: async (channel: ConfirmChannel) => {
      await channel.assertExchange('workpackage.events', 'topic', {
        durable: true
      });
      logger.info('Publisher channel setup complete');
    }
  });

  // Consumer channel (with prefetch)
  consumerChannel = connection.createChannel({
    json: false,
    setup: async (channel: ConfirmChannel) => {
      // Prefetch: process 10 messages at a time
      await channel.prefetch(10);

      // Define queue with DLQ
      await channel.assertQueue('workpackage.projection', {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'workpackage.dlx',
          'x-dead-letter-routing-key': 'workpackage.projection.failed',
          'x-message-ttl': 86400000 // 24 hours
        }
      });

      // Bind to exchange
      await channel.bindQueue(
        'workpackage.projection',
        'workpackage.events',
        'WorkPackage.*'
      );

      // Setup DLX
      await channel.assertExchange('workpackage.dlx', 'topic', {
        durable: true
      });

      await channel.assertQueue('workpackage.projection.dlq', {
        durable: true
      });

      await channel.bindQueue(
        'workpackage.projection.dlq',
        'workpackage.dlx',
        'workpackage.projection.failed'
      );

      logger.info('Consumer channel setup complete');
    }
  });

  await publisherChannel.waitForConnect();
  await consumerChannel.waitForConnect();
}

export async function publish(
  routingKey: string,
  message: unknown,
  options?: { persistent?: boolean; correlationId?: string }
): Promise<void> {
  if (!publisherChannel) throw new Error('Publisher channel not initialized');

  await publisherChannel.publish(
    'workpackage.events',
    routingKey,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: options?.persistent ?? true,
      correlationId: options?.correlationId,
      timestamp: Date.now()
    }
  );

  logger.debug({ routingKey }, 'Published message to RabbitMQ');
}

export async function consume(
  queue: string,
  handler: (msg: ConsumeMessage) => Promise<void>
): Promise<void> {
  if (!consumerChannel) throw new Error('Consumer channel not initialized');

  await consumerChannel.addSetup((channel: ConfirmChannel) => {
    return channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;

        try {
          await handler(msg);
          channel.ack(msg);
          logger.debug({ queue }, 'Message processed successfully');
        } catch (error) {
          logger.error({ error, queue }, 'Message processing failed');
          // Reject and send to DLQ (no requeue)
          channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  });
}

export async function closeRabbitMQ(): Promise<void> {
  if (publisherChannel) await publisherChannel.close();
  if (consumerChannel) await consumerChannel.close();
  if (connection) await connection.close();
  logger.info('RabbitMQ connection closed');
}
```

---

## 4. Pino Logging Configuration

### Implementation

#### File: `backend/src/infrastructure/logger.ts`

```typescript
import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// Correlation ID storage
export const correlationContext = new AsyncLocalStorage<{ correlationId: string }>();

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.secret'
    ],
    remove: true
  },

  // Add correlation ID to every log
  mixin() {
    const context = correlationContext.getStore();
    return context ? { correlationId: context.correlationId } : {};
  },

  // Transport: pretty in dev, JSON in prod
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false
        }
      }
    : undefined,

  // Serializers for common objects
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err
  }
});

// Helper to generate correlation ID
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Middleware to add correlation ID to Express requests
export function correlationMiddleware(
  req: any,
  res: any,
  next: () => void
): void {
  const correlationId =
    req.headers['x-correlation-id'] || generateCorrelationId();

  res.setHeader('x-correlation-id', correlationId);

  correlationContext.run({ correlationId }, () => {
    logger.info(
      { method: req.method, url: req.url, correlationId },
      'Incoming request'
    );
    next();
  });
}
```

#### Integration with Express

```typescript
import { correlationMiddleware } from './infrastructure/logger';

app.use(correlationMiddleware);
app.use('/graphql', expressMiddleware(server, { context }));
```

---

## 5. Config Validation with Zod

### Dependencies

```json
{
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

### Implementation

#### File: `backend/src/config.ts`

```typescript
import { z } from 'zod';
import { logger } from './infrastructure/logger';

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GRAPHQL_PORT: z.coerce.number().int().positive().default(3000),
  GRAPHQL_PATH: z.string().default('/graphql'),
  FRONTEND_ORIGIN: z.string().url(),

  // Neo4j
  NEO4J_URI: z.string().startsWith('bolt://').or(z.string().startsWith('neo4j://')),
  NEO4J_USER: z.string().min(1),
  NEO4J_PASSWORD: z.string().min(1),

  // Redis
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.coerce.boolean().default(false),

  // RabbitMQ
  RABBITMQ_URL: z.string().startsWith('amqp://').or(z.string().startsWith('amqps://')),

  // Auth
  JWT_SECRET: z.string().min(36),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info')
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  try {
    const config = configSchema.parse(process.env);
    logger.info('Configuration validated successfully');
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.fatal({ errors: error.errors }, 'Configuration validation failed');
      console.error('\nConfiguration errors:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\nPlease check your .env file\n');
    }
    process.exit(1);
  }
}

// Load config at startup
export const config = loadConfig();
```

#### Usage in Bootstrap

```typescript
import { config } from './config';

async function startServer() {
  // All environment variables are now validated and typed
  const port = config.GRAPHQL_PORT;
  const neo4jDriver = getDriver(config.NEO4J_URI, config.NEO4J_USER, config.NEO4J_PASSWORD);
  // ...
}
```

---

## 6. Health and Readiness Probes

### Implementation

#### File: `backend/src/health.ts`

```typescript
import { Request, Response } from 'express';
import { getDriver } from './infrastructure/neo4j/driver';
import { logger } from './infrastructure/logger';

export async function healthCheck(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}

export async function readinessCheck(req: Request, res: Response): Promise<void> {
  const checks: Record<string, boolean> = {
    neo4j: false,
    redis: false,
    rabbitmq: false
  };

  try {
    // Check Neo4j
    const driver = getDriver();
    await driver.verifyConnectivity();
    checks.neo4j = true;

    // Check Redis (implement in pubsub module)
    // checks.redis = await pubSub.isConnected();

    // Check RabbitMQ (implement in connection module)
    // checks.rabbitmq = connection.isConnected();

    const allHealthy = Object.values(checks).every((status) => status);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'not ready',
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Readiness check failed');
    res.status(503).json({
      status: 'not ready',
      checks,
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}
```

#### Register Routes

```typescript
app.get('/health', healthCheck);
app.get('/ready', readinessCheck);
```

---

## Summary

**Infrastructure Components:**
- ✅ Redis PubSub with dual connections, retry strategy, TLS support
- ✅ Graceful shutdown with resource cleanup (Neo4j, Redis, RabbitMQ)
- ✅ RabbitMQ connection manager with auto-reconnect, prefetch, DLQ
- ✅ Pino logging with transports, correlation IDs, secret redaction
- ✅ Zod config validation on boot
- ✅ Health/readiness probes for Kubernetes

**Next Documentation:**
- Testcontainers integration testing strategy
- OpenTelemetry observability setup
- Performance monitoring (p99 resolver latencies)
