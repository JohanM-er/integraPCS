# Performance Optimization Guide

This guide covers production-grade performance optimizations for integraPCS, including compression, HTTP/2, CDN caching, persisted queries, Apollo response cache, and Redis clustering for subscription fan-out.

---

## Table of Contents

1. [Compression (gzip/brotli)](#compression-gzipbrotli)
2. [HTTP/2 Configuration](#http2-configuration)
3. [CDN Caching with Persisted Queries](#cdn-caching-with-persisted-queries)
4. [Apollo Response Cache](#apollo-response-cache)
5. [Redis Cluster for Subscription Fan-out](#redis-cluster-for-subscription-fan-out)
6. [Performance Monitoring](#performance-monitoring)
7. [Best Practices](#best-practices)

---

## Compression (gzip/brotli)

Compress HTTP responses to reduce bandwidth and improve load times.

### Backend Implementation

**Install dependencies:**

```bash
npm install --save compression
npm install --save-dev @types/compression
```

**Compression middleware:**

```typescript
// backend/src/middleware/compression.ts
import compression from 'compression';
import { Request, Response } from 'express';

export const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,

  // Compression level (0-9, higher = better compression but slower)
  level: 6,

  // Filter function to determine what to compress
  filter: (req: Request, res: Response) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression's default filter
    return compression.filter(req, res);
  },

  // Use brotli if client supports it (better compression than gzip)
  brotli: {
    enabled: true,
    zlib: {
      // Brotli compression level (0-11)
      [require('zlib').constants.BROTLI_PARAM_QUALITY]: 4,
    },
  },
});
```

**Apply to Express app:**

```typescript
// backend/src/index.ts
import express from 'express';
import { compressionMiddleware } from './middleware/compression';

const app = express();

// Apply compression early in the middleware chain
app.use(compressionMiddleware);

// ... rest of middleware and routes
```

### CDN/Edge Compression

For production, enable compression at the CDN/edge level for better performance:

**Cloudflare:**
- Auto-enabled for most file types
- Supports gzip and brotli
- Configure in Dashboard → Speed → Optimization → Auto Minify

**CloudFront:**
```yaml
# CloudFormation/Terraform example
CacheBehavior:
  Compress: true  # Enable automatic compression
```

**NGINX (if self-hosting):**
```nginx
# /etc/nginx/nginx.conf
http {
  # Gzip compression
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_comp_level 6;
  gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    application/atom+xml
    image/svg+xml;

  # Brotli compression (requires ngx_brotli module)
  brotli on;
  brotli_comp_level 4;
  brotli_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    application/atom+xml
    image/svg+xml;
}
```

---

## HTTP/2 Configuration

HTTP/2 provides multiplexing, header compression, and server push for improved performance.

### Node.js HTTP/2 Server

**Production setup with HTTP/2:**

```typescript
// backend/src/server-http2.ts
import http2 from 'http2';
import express from 'express';
import fs from 'fs';

const app = express();

// HTTP/2 server with TLS (required for browser support)
const server = http2.createSecureServer(
  {
    key: fs.readFileSync(process.env.TLS_KEY_PATH || '/path/to/server.key'),
    cert: fs.readFileSync(process.env.TLS_CERT_PATH || '/path/to/server.crt'),
    allowHTTP1: true, // Fallback to HTTP/1.1 for older clients
  },
  app
);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`HTTP/2 server running on https://localhost:${PORT}`);
});
```

### CDN/Reverse Proxy HTTP/2

**NGINX:**
```nginx
server {
  listen 443 ssl http2;  # Enable HTTP/2
  server_name api.integrapcs.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  # HTTP/2 push for critical resources (optional)
  location / {
    http2_push /static/critical.css;
    proxy_pass http://backend:3000;
  }
}
```

**Cloudflare:**
- HTTP/2 enabled by default (automatic)
- HTTP/3 (QUIC) available in Dashboard → Network

**CloudFront:**
```yaml
ViewerProtocolPolicy: redirect-to-https
HttpVersion: http2  # or http2and3
```

---

## CDN Caching with Persisted Queries

Cache public GraphQL queries at the CDN edge using Apollo persisted queries.

### Persisted Queries Overview

Persisted queries map query hashes to full query strings, enabling:
- **CDN caching** via GET requests with stable URLs
- **Security** via allowlist (only approved queries execute)
- **Performance** via reduced request size and edge caching

### Backend: Automatic Persisted Queries (APQ)

Apollo Server supports automatic persisted queries (clients send hash, server caches query).

**Install dependencies:**

```bash
npm install --save @apollo/server-plugin-response-cache
```

**Apollo Server configuration:**

```typescript
// backend/src/graphql/server.ts
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { KeyValueCache } from '@apollo/utils.keyvaluecache';
import { RedisCache } from './cache/redis-cache';

const server = new ApolloServer({
  typeDefs,
  resolvers,

  // Enable automatic persisted queries
  persistedQueries: {
    // Use Redis for persisted query storage
    cache: new RedisCache({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      keyPrefix: 'apq:',
      ttl: 86400, // 24 hours
    }),
  },

  plugins: [
    // Cache control headers
    ApolloServerPluginCacheControl({ defaultMaxAge: 0 }),

    // Response caching (see Apollo Response Cache section)
    responseCachePlugin(),
  ],
});
```

**Redis cache implementation:**

```typescript
// backend/src/cache/redis-cache.ts
import { KeyValueCache } from '@apollo/utils.keyvaluecache';
import Redis from 'ioredis';

export class RedisCache implements KeyValueCache {
  private client: Redis;
  private keyPrefix: string;
  private defaultTTL: number;

  constructor(options: { host: string; port: number; keyPrefix?: string; ttl?: number }) {
    this.client = new Redis({
      host: options.host,
      port: options.port,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
    this.keyPrefix = options.keyPrefix || 'cache:';
    this.defaultTTL = options.ttl || 300;
  }

  async get(key: string): Promise<string | undefined> {
    const value = await this.client.get(this.keyPrefix + key);
    return value ?? undefined;
  }

  async set(key: string, value: string, options?: { ttl?: number }): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTTL;
    await this.client.setex(this.keyPrefix + key, ttl, value);
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(this.keyPrefix + key);
    return result > 0;
  }
}
```

### Production: Persisted Query Allowlist

For production, use an allowlist to prevent arbitrary queries.

**Generate persisted query manifest:**

```bash
# Frontend: Extract queries from code
npx apollo client:push \
  --graph=integrapcs \
  --key=$APOLLO_KEY \
  --variant=production
```

**Load allowlist in Apollo Server:**

```typescript
// backend/src/graphql/persisted-queries.ts
import fs from 'fs';
import path from 'path';

// Load persisted query allowlist
const persistedQueriesPath = path.join(__dirname, '../../persisted-queries.json');
const persistedQueries = JSON.parse(fs.readFileSync(persistedQueriesPath, 'utf8'));

export const persistedQueryAllowlist = new Map<string, string>(
  Object.entries(persistedQueries)
);

// Apollo Server configuration with allowlist
const server = new ApolloServer({
  typeDefs,
  resolvers,

  persistedQueries: {
    cache: new RedisCache({ /* ... */ }),

    // Enforce allowlist (reject queries not in the manifest)
    async validateQuery(hash: string): Promise<string | null> {
      const query = persistedQueryAllowlist.get(hash);

      if (!query) {
        throw new Error(`Persisted query not found: ${hash}`);
      }

      return query;
    },
  },
});
```

### Frontend: Enable Persisted Queries

**Install dependencies:**

```bash
npm install --save @apollo/client
```

**Apollo Client configuration:**

```typescript
// frontend/src/lib/apollo.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries';
import { sha256 } from 'crypto-hash';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_HTTP_ENDPOINT || 'http://localhost:3000/graphql',
  credentials: 'include',
});

// Enable automatic persisted queries
const persistedQueriesLink = createPersistedQueryLink({
  sha256,
  useGETForHashedQueries: true, // Use GET for persisted queries (enables CDN caching)
});

export const apolloClient = new ApolloClient({
  link: persistedQueriesLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

### CDN Caching Configuration

**Cloudflare Worker:**

```javascript
// Cache GET requests (persisted queries)
addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname === '/graphql' && event.request.method === 'GET') {
    // Cache persisted query requests
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(response => {
          const cache = caches.open('graphql-cache');
          cache.put(event.request, response.clone());
          return response;
        });
      })
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});
```

**CloudFront Cache Policy:**

```yaml
CacheBehavior:
  PathPattern: /graphql*
  CachePolicyId: !Ref GraphQLCachePolicy

GraphQLCachePolicy:
  Type: AWS::CloudFront::CachePolicy
  Properties:
    CachePolicyConfig:
      Name: GraphQLCachePolicy
      MinTTL: 0
      MaxTTL: 31536000
      DefaultTTL: 86400
      ParametersInCacheKeyAndForwardedToOrigin:
        EnableAcceptEncodingGzip: true
        EnableAcceptEncodingBrotli: true
        QueryStringsConfig:
          QueryStringBehavior: all  # Include query hash in cache key
        HeadersConfig:
          HeaderBehavior: whitelist
          Headers:
            - Authorization  # Vary cache by auth for user-specific queries
```

**NGINX Caching:**

```nginx
proxy_cache_path /var/cache/nginx/graphql levels=1:2 keys_zone=graphql_cache:10m max_size=1g inactive=60m;

server {
  location /graphql {
    # Cache GET requests only (persisted queries)
    proxy_cache graphql_cache;
    proxy_cache_methods GET;
    proxy_cache_key "$request_uri|$http_authorization";
    proxy_cache_valid 200 10m;
    proxy_cache_valid 404 1m;

    # Add cache status header
    add_header X-Cache-Status $upstream_cache_status;

    proxy_pass http://backend:3000;
  }
}
```

---

## Apollo Response Cache

Cache GraphQL query responses in Redis to avoid redundant resolver execution.

### Install Dependencies

```bash
npm install --save @apollo/server-plugin-response-cache keyv @keyv/redis
```

### Response Cache Plugin

```typescript
// backend/src/graphql/cache.ts
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

// Redis-backed cache store
const redisStore = new KeyvRedis(process.env.REDIS_URL || 'redis://localhost:6379');
const cache = new Keyv({ store: redisStore, namespace: 'apollo-response-cache' });

// Apollo Server configuration
const server = new ApolloServer({
  typeDefs,
  resolvers,

  plugins: [
    responseCachePlugin({
      // Use external Redis cache
      cache: {
        async get(key: string) {
          return cache.get(key);
        },
        async set(key: string, value: string, options?: { ttl?: number }) {
          return cache.set(key, value, options?.ttl);
        },
        async delete(key: string) {
          return cache.delete(key);
        },
      },

      // Session-aware caching (vary cache by user)
      sessionId: async (requestContext) => {
        return requestContext.request.http?.headers.get('authorization') || null;
      },

      // Don't cache mutations or subscriptions
      shouldCacheResult: ({ request, response }) => {
        return (
          request.http?.method === 'GET' &&
          response.errors === undefined &&
          response.data !== undefined
        );
      },
    }),
  ],
});
```

### Cache Control Directives

**Schema with cache hints:**

```graphql
# backend/src/graphql/schema.graphql
type Query {
  # Public data - cache for 1 hour
  publicWorkPackages: [WorkPackage!]! @cacheControl(maxAge: 3600, scope: PUBLIC)

  # User-specific data - cache for 5 minutes
  myWorkPackages: [WorkPackage!]! @cacheControl(maxAge: 300, scope: PRIVATE)

  # Real-time data - don't cache
  liveMetrics: Metrics! @cacheControl(maxAge: 0)
}

type WorkPackage {
  id: ID!
  title: String!

  # Expensive nested field - cache separately
  tasks: [Task!]! @cacheControl(maxAge: 600)
}
```

**Resolver-level cache control:**

```typescript
// backend/src/graphql/resolvers.ts
export const resolvers = {
  Query: {
    publicWorkPackages: async (_parent, _args, context, info) => {
      // Set cache control at runtime
      info.cacheControl.setCacheHint({ maxAge: 3600, scope: 'PUBLIC' });

      return context.dataSources.workPackages.findPublic();
    },

    myWorkPackages: async (_parent, _args, context, info) => {
      // User-specific cache (1 cache entry per user)
      info.cacheControl.setCacheHint({ maxAge: 300, scope: 'PRIVATE' });

      return context.dataSources.workPackages.findByUser(context.user.id);
    },
  },
};
```

### Cache Invalidation

**Invalidate on mutation:**

```typescript
// backend/src/graphql/resolvers.ts
export const resolvers = {
  Mutation: {
    createWorkPackage: async (_parent, args, context) => {
      const workPackage = await context.dataSources.workPackages.create(args.input);

      // Invalidate cached queries
      await context.cache.delete('Query.publicWorkPackages');
      await context.cache.delete(`Query.myWorkPackages:${context.user.id}`);

      return { workPackage };
    },
  },
};
```

**Event-driven invalidation:**

```typescript
// backend/src/cache/invalidation.ts
import { RabbitMQConsumer } from '../infrastructure/rabbitmq';
import { cache } from './cache';

const consumer = new RabbitMQConsumer('cache-invalidation');

consumer.on('WorkPackageCreated', async (event) => {
  // Invalidate all relevant cache entries
  await cache.delete('Query.publicWorkPackages');
  await cache.delete(`Query.myWorkPackages:${event.userId}`);
});

consumer.on('WorkPackageUpdated', async (event) => {
  // Invalidate specific work package cache
  await cache.delete(`WorkPackage:${event.workPackageId}`);
  await cache.delete('Query.publicWorkPackages');
});
```

---

## Redis Cluster for Subscription Fan-out

For high-scale subscription fan-out, use Redis Cluster instead of a single Redis instance.

### Why Redis Cluster?

- **Horizontal scaling**: Distribute subscriptions across multiple nodes
- **High availability**: Automatic failover with replicas
- **Sharding**: Partition subscription channels across nodes
- **Performance**: Handle millions of concurrent subscriptions

### Redis Cluster Setup

**Docker Compose (3-node cluster with replicas):**

```yaml
# docker-compose.yml
version: '3.9'

services:
  # Redis Cluster nodes (6 nodes: 3 masters + 3 replicas)
  redis-cluster-1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7001:6379"
    volumes:
      - redis-cluster-1-data:/data
    networks:
      - integrapcs-network

  redis-cluster-2:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7002:6379"
    volumes:
      - redis-cluster-2-data:/data
    networks:
      - integrapcs-network

  redis-cluster-3:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7003:6379"
    volumes:
      - redis-cluster-3-data:/data
    networks:
      - integrapcs-network

  redis-cluster-4:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7004:6379"
    volumes:
      - redis-cluster-4-data:/data
    networks:
      - integrapcs-network

  redis-cluster-5:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7005:6379"
    volumes:
      - redis-cluster-5-data:/data
    networks:
      - integrapcs-network

  redis-cluster-6:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7006:6379"
    volumes:
      - redis-cluster-6-data:/data
    networks:
      - integrapcs-network

  # Cluster initialization
  redis-cluster-init:
    image: redis:7-alpine
    depends_on:
      - redis-cluster-1
      - redis-cluster-2
      - redis-cluster-3
      - redis-cluster-4
      - redis-cluster-5
      - redis-cluster-6
    command: >
      sh -c "sleep 5 && redis-cli --cluster create
      redis-cluster-1:6379
      redis-cluster-2:6379
      redis-cluster-3:6379
      redis-cluster-4:6379
      redis-cluster-5:6379
      redis-cluster-6:6379
      --cluster-replicas 1 --cluster-yes"
    networks:
      - integrapcs-network

volumes:
  redis-cluster-1-data:
  redis-cluster-2-data:
  redis-cluster-3-data:
  redis-cluster-4-data:
  redis-cluster-5-data:
  redis-cluster-6-data:

networks:
  integrapcs-network:
    driver: bridge
```

### Backend: Redis Cluster Client

**Install dependencies:**

```bash
npm install --save ioredis
```

**Redis Cluster configuration:**

```typescript
// backend/src/infrastructure/redis-cluster.ts
import Redis from 'ioredis';

export const createRedisCluster = () => {
  const cluster = new Redis.Cluster(
    [
      { host: 'redis-cluster-1', port: 6379 },
      { host: 'redis-cluster-2', port: 6379 },
      { host: 'redis-cluster-3', port: 6379 },
    ],
    {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
      },

      // Cluster options
      clusterRetryStrategy: (times) => {
        const delay = Math.min(100 + times * 2, 2000);
        return delay;
      },
      enableReadyCheck: true,
      maxRedirections: 16,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,

      // Scale reads across replicas
      scaleReads: 'slave',
    }
  );

  cluster.on('connect', () => {
    console.log('✅ Connected to Redis Cluster');
  });

  cluster.on('error', (err) => {
    console.error('❌ Redis Cluster error:', err);
  });

  cluster.on('node error', (err, node) => {
    console.error(`❌ Redis Cluster node error (${node}):`, err);
  });

  return cluster;
};

// Singleton instance
export const redisCluster = createRedisCluster();
```

### GraphQL Subscriptions with Redis Cluster

**RedisPubSub with Cluster:**

```typescript
// backend/src/graphql/pubsub.ts
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { redisCluster } from '../infrastructure/redis-cluster';

export const pubsub = new RedisPubSub({
  publisher: redisCluster,
  subscriber: redisCluster,

  // Use different connection for pub/sub
  connectionListener: (err) => {
    if (err) {
      console.error('❌ RedisPubSub connection error:', err);
    }
  },

  // Serialize/deserialize for complex data types
  serializer: (value) => JSON.stringify(value),
  deserializer: (value) => JSON.parse(value),
});
```

**Subscription resolvers:**

```typescript
// backend/src/graphql/resolvers.ts
import { pubsub } from './pubsub';
import { withFilter } from 'graphql-subscriptions';

export const resolvers = {
  Subscription: {
    workPackageUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator('WORK_PACKAGE_UPDATED'),
        (payload, variables) => {
          // Filter subscriptions by work package ID
          return payload.workPackageUpdated.id === variables.workPackageId;
        }
      ),
    },

    taskStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator('TASK_STATUS_CHANGED'),
        (payload, variables, context) => {
          // User-specific subscriptions
          return context.user.id === payload.taskStatusChanged.assignedUserId;
        }
      ),
    },
  },

  Mutation: {
    updateWorkPackage: async (_parent, args, context) => {
      const workPackage = await context.dataSources.workPackages.update(args.id, args.input);

      // Publish to Redis Cluster (fans out to all subscribers)
      await pubsub.publish('WORK_PACKAGE_UPDATED', {
        workPackageUpdated: workPackage,
      });

      return { workPackage };
    },
  },
};
```

### Production: AWS ElastiCache / Redis Cloud

**AWS ElastiCache for Redis (Cluster Mode Enabled):**

```typescript
// backend/src/infrastructure/redis-cluster.ts
import Redis from 'ioredis';

export const createRedisCluster = () => {
  const cluster = new Redis.Cluster(
    [
      {
        host: process.env.REDIS_CLUSTER_ENDPOINT, // e.g., my-cluster.abcdef.clustercfg.use1.cache.amazonaws.com
        port: 6379,
      },
    ],
    {
      dnsLookup: (address, callback) => callback(null, address),
      redisOptions: {
        tls: { servername: process.env.REDIS_CLUSTER_ENDPOINT },
        password: process.env.REDIS_AUTH_TOKEN,
      },
      clusterRetryStrategy: (times) => {
        return Math.min(100 + times * 2, 2000);
      },
    }
  );

  return cluster;
};
```

**Redis Cloud configuration:**

```typescript
const cluster = new Redis.Cluster(
  [
    { host: 'redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com', port: 12345 },
  ],
  {
    redisOptions: {
      tls: {},
      password: process.env.REDIS_CLOUD_PASSWORD,
    },
  }
);
```

### Monitoring Redis Cluster

**Health check:**

```typescript
// backend/src/health/redis-cluster.ts
export const checkRedisCluster = async (): Promise<boolean> => {
  try {
    const nodes = redisCluster.nodes('master');

    for (const node of nodes) {
      const ping = await node.ping();
      if (ping !== 'PONG') {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Redis Cluster health check failed:', error);
    return false;
  }
};
```

**Metrics:**

```typescript
// backend/src/metrics/redis-cluster.ts
import { redisCluster } from '../infrastructure/redis-cluster';

export const collectRedisClusterMetrics = async () => {
  const nodes = redisCluster.nodes();

  for (const node of nodes) {
    const info = await node.info();
    const stats = parseRedisInfo(info);

    // Export metrics
    redisConnectedClients.set({ node: node.options.host }, stats.connectedClients);
    redisMemoryUsed.set({ node: node.options.host }, stats.usedMemory);
    redisOpsPerSec.set({ node: node.options.host }, stats.instantaneousOpsPerSec);
  }
};

const parseRedisInfo = (info: string) => {
  const lines = info.split('\r\n');
  const stats: Record<string, number> = {};

  for (const line of lines) {
    const [key, value] = line.split(':');
    if (value && !isNaN(Number(value))) {
      stats[key] = Number(value);
    }
  }

  return {
    connectedClients: stats.connected_clients || 0,
    usedMemory: stats.used_memory || 0,
    instantaneousOpsPerSec: stats.instantaneous_ops_per_sec || 0,
  };
};
```

---

## Performance Monitoring

Track performance metrics to identify bottlenecks and optimize further.

### GraphQL Resolver Timing

```typescript
// backend/src/graphql/plugins/timing.ts
import { ApolloServerPlugin } from '@apollo/server';

export const timingPlugin: ApolloServerPlugin = {
  async requestDidStart() {
    const startTime = Date.now();

    return {
      async willSendResponse({ response }) {
        const duration = Date.now() - startTime;

        // Add timing header
        response.http?.headers.set('X-Response-Time', `${duration}ms`);

        // Log slow queries
        if (duration > 1000) {
          console.warn(`⚠️ Slow query: ${duration}ms`);
        }
      },

      async executionDidStart() {
        return {
          willResolveField({ info }) {
            const start = Date.now();

            return () => {
              const duration = Date.now() - start;

              // Track resolver timing
              resolverDuration.observe(
                { field: `${info.parentType.name}.${info.fieldName}` },
                duration / 1000
              );
            };
          },
        };
      },
    };
  },
};
```

### Cache Hit Ratio

```typescript
// backend/src/metrics/cache.ts
import { Counter, Gauge } from 'prom-client';

export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
});

export const cacheHitRatio = new Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio (0-1)',
  labelNames: ['cache_type'],
});

// Update cache hit ratio periodically
setInterval(() => {
  const hits = cacheHits.get().values.reduce((sum, v) => sum + v.value, 0);
  const misses = cacheMisses.get().values.reduce((sum, v) => sum + v.value, 0);
  const total = hits + misses;

  if (total > 0) {
    cacheHitRatio.set(hits / total);
  }
}, 10000);
```

### Frontend Performance Metrics

**Web Vitals tracking:**

```typescript
// frontend/src/lib/performance.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

export const initPerformanceMonitoring = () => {
  onCLS(console.log);  // Cumulative Layout Shift
  onFID(console.log);  // First Input Delay
  onLCP(console.log);  // Largest Contentful Paint
  onFCP(console.log);  // First Contentful Paint
  onTTFB(console.log); // Time to First Byte

  // Send to analytics
  const sendToAnalytics = (metric: Metric) => {
    fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify(metric),
    });
  };

  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
};
```

---

## Best Practices

### 1. Compression

✅ Enable brotli at CDN/edge (better compression than gzip)
✅ Set compression threshold to 1KB (avoid compressing tiny responses)
✅ Use compression level 4-6 (balance speed vs size)
✅ Don't compress images/video (already compressed)

### 2. HTTP/2

✅ Terminate TLS at CDN/reverse proxy (offload from app servers)
✅ Enable HTTP/2 push for critical resources (CSS, JS)
✅ Use HTTP/2 server push sparingly (can waste bandwidth)
✅ Consider HTTP/3 (QUIC) for mobile clients

### 3. CDN Caching

✅ Use persisted queries for public data (stable cache keys)
✅ Vary cache by Authorization header for user-specific data
✅ Set appropriate TTLs (1 hour for public, 5 min for user data)
✅ Use allowlist in production (prevent arbitrary queries)
✅ Monitor cache hit ratio (aim for >80%)

### 4. Apollo Response Cache

✅ Cache public queries aggressively (1 hour+)
✅ Use PRIVATE scope for user-specific data
✅ Set maxAge: 0 for real-time data
✅ Invalidate cache on mutations (event-driven)
✅ Use Redis for shared cache across instances

### 5. Redis Cluster

✅ Use cluster for >10k concurrent subscriptions
✅ Scale reads across replicas (scaleReads: 'slave')
✅ Monitor cluster health (ping all nodes)
✅ Use AWS ElastiCache or Redis Cloud for production
✅ Set up automatic failover (3 masters + 3 replicas)

### 6. General Performance

✅ Use DataLoader to prevent N+1 queries
✅ Add indexes to hot query paths (Neo4j/Postgres)
✅ Monitor resolver timing (alert on >1s)
✅ Use connection pooling (Neo4j, Redis, Postgres)
✅ Enable query complexity limits (prevent DoS)
✅ Use lazy loading for large lists (pagination)
✅ Prefetch data on server side (SSR/SSG)
✅ Split code by route (lazy load React components)

---

## Performance Checklist

Before deploying to production, verify:

- [ ] Compression enabled (gzip/brotli)
- [ ] HTTP/2 enabled at CDN/edge
- [ ] Persisted queries configured
- [ ] Persisted query allowlist enabled (production)
- [ ] Apollo response cache enabled
- [ ] Cache invalidation on mutations
- [ ] Redis Cluster configured (if >10k subscriptions)
- [ ] CDN caching configured (CloudFront/Cloudflare)
- [ ] Cache hit ratio monitoring
- [ ] Slow query logging (>1s)
- [ ] DataLoader for N+1 prevention
- [ ] Database indexes on hot paths
- [ ] Rate limiting enabled
- [ ] Query complexity limits
- [ ] Web Vitals monitoring

---

## Resources

- [Apollo Server Caching](https://www.apollographql.com/docs/apollo-server/performance/caching/)
- [Persisted Queries](https://www.apollographql.com/docs/apollo-server/performance/apq/)
- [Redis Cluster Tutorial](https://redis.io/docs/management/scaling/)
- [HTTP/2 in Node.js](https://nodejs.org/api/http2.html)
- [Web Vitals](https://web.dev/vitals/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

---

**Next Steps:**

When ready to implement these optimizations:

1. Start with compression and HTTP/2 (easy wins)
2. Enable persisted queries + CDN caching
3. Add Apollo response cache
4. Migrate to Redis Cluster (if subscription load requires it)
5. Monitor cache hit ratios and resolver timing
6. Iterate based on production metrics
