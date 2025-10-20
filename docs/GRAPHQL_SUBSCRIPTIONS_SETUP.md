# GraphQL Subscriptions Setup (Apollo Server 4 + graphql-ws)

## Overview

Apollo Server 4 **removed built-in WebSocket transport**. You must manually wire `graphql-ws` on both server and client.

This guide covers:
- Server: Apollo Server 4 + `ws` WebSocket server + `graphql-ws` protocol
- Client: Apollo Client with HTTP/WS split links
- PubSub: Redis-backed subscriptions for horizontal scaling

---

## Architecture

```
Frontend (Apollo Client)
├── HTTP Link → Queries/Mutations → http://localhost:3000/graphql
└── WS Link → Subscriptions → ws://localhost:3000/graphql
                                        ↓
Backend (Apollo Server 4)
├── Express + Apollo HTTP → Handles queries/mutations
├── ws WebSocketServer → Handles WebSocket connections
├── graphql-ws useServer → Implements GraphQL-over-WebSocket protocol
└── Redis PubSub → Scales subscriptions across instances
```

---

## Server Setup (Backend)

### 1. Dependencies

Already installed:
```json
{
  "dependencies": {
    "@apollo/server": "^4.12.2",
    "express": "^4.18.3",
    "graphql": "^16.8.1",
    "graphql-ws": "^5.14.2",
    "graphql-subscriptions": "^2.0.0",
    "graphql-redis-subscriptions": "^2.7.0",
    "ioredis": "^5.6.1",
    "ws": "^8.18.1"
  }
}
```

### 2. Server Bootstrap (`backend/src/index.ts`)

```typescript
import express from 'express';
import http from 'http';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { createPubSub } from './infrastructure/pubsub';
import { createContext } from './graphql/context';

async function startServer() {
  // 1. Create Express app and HTTP server
  const app = express();
  const httpServer = http.createServer(app);

  // 2. Create executable schema
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // 3. Create WebSocket server on same HTTP server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql'
  });

  // 4. Create PubSub instance (Redis-backed)
  const pubSub = createPubSub(process.env.REDIS_URL!);

  // 5. Wire graphql-ws protocol handler
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        // WebSocket context - can extract auth from connectionParams
        const token = ctx.connectionParams?.token as string | undefined;
        return createContext({ token, pubSub });
      },
      onConnect: async (ctx) => {
        console.log('WebSocket client connected');
      },
      onDisconnect: async (ctx) => {
        console.log('WebSocket client disconnected');
      }
    },
    wsServer
  );

  // 6. Create Apollo Server with drain plugin
  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            }
          };
        }
      }
    ]
  });

  await server.start();

  // 7. Apply Express middleware for HTTP transport
  app.use(
    '/graphql',
    cors({
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      credentials: true
    }),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        // HTTP context - extract auth from headers
        const token = req.headers.authorization?.replace('Bearer ', '');
        return createContext({ token, pubSub });
      }
    })
  );

  // 8. Start HTTP server
  const PORT = Number(process.env.GRAPHQL_PORT) || 3000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 GraphQL HTTP endpoint: http://localhost:${PORT}/graphql`);
    console.log(`🔌 GraphQL WebSocket endpoint: ws://localhost:${PORT}/graphql`);
  });
}

startServer().catch(console.error);
```

### 3. PubSub Setup (`backend/src/infrastructure/pubsub.ts`)

```typescript
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

export function createPubSub(redisUrl: string): RedisPubSub {
  const options = {
    host: new URL(redisUrl).hostname,
    port: Number(new URL(redisUrl).port) || 6379,
    retryStrategy: (times: number) => Math.min(times * 50, 2000)
  };

  return new RedisPubSub({
    publisher: new Redis(options),
    subscriber: new Redis(options)
  });
}
```

### 4. Context Factory (`backend/src/graphql/context.ts`)

```typescript
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { getDriver } from '../infrastructure/neo4j/session';

export interface GraphQLContext {
  userId?: string;
  pubSub: RedisPubSub;
  neo4jDriver: Driver;
  // ... other context properties
}

export async function createContext({ token, pubSub }: {
  token?: string;
  pubSub: RedisPubSub;
}): Promise<GraphQLContext> {
  // Verify JWT token if present
  const userId = token ? verifyToken(token) : undefined;

  return {
    userId,
    pubSub,
    neo4jDriver: getDriver()
  };
}
```

### 5. Subscription Resolver Example

```typescript
// backend/src/graphql/resolvers/subscriptions.ts
import { withFilter } from 'graphql-subscriptions';

export const subscriptionResolvers = {
  Subscription: {
    taskProgressUpdated: {
      subscribe: withFilter(
        (_: unknown, __: unknown, context: GraphQLContext) => {
          return context.pubSub.asyncIterator(['TASK_PROGRESS_UPDATED']);
        },
        (payload, variables) => {
          // Filter: only send updates for requested workPackageId
          return payload.taskProgressUpdated.workPackageId === variables.workPackageId;
        }
      ),
      resolve: (payload: any) => payload.taskProgressUpdated
    }
  }
};

// Publishing from mutation:
export const mutationResolvers = {
  Mutation: {
    updateTaskProgress: async (
      _: unknown,
      args: { workPackageId: string; taskId: string; remainingHours: number },
      context: GraphQLContext
    ) => {
      // ... update logic ...

      // Publish to subscribers
      await context.pubSub.publish('TASK_PROGRESS_UPDATED', {
        taskProgressUpdated: {
          workPackageId: args.workPackageId,
          taskId: args.taskId,
          remainingHours: args.remainingHours
        }
      });

      return true;
    }
  }
};
```

---

## Client Setup (Frontend)

### 1. Dependencies

Already installed:
```json
{
  "dependencies": {
    "@apollo/client": "^3.11.0",
    "graphql": "^16.8.1"
  }
}
```

### 2. Apollo Client Setup (`frontend/src/lib/apolloClient.ts`)

```typescript
import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

// HTTP link for queries and mutations
const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_HTTP_URL || 'http://localhost:3000/graphql',
  credentials: 'include' // Send cookies if using cookie-based auth
});

// WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: import.meta.env.VITE_GRAPHQL_WS_URL || 'ws://localhost:3000/graphql',
    connectionParams: () => {
      // Send auth token via connectionParams (optional)
      const token = localStorage.getItem('token');
      return token ? { token } : {};
    },
    retryAttempts: 5,
    shouldRetry: () => true
  })
);

// Split based on operation type
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,   // Use WS for subscriptions
  httpLink  // Use HTTP for queries/mutations
);

// Create Apollo Client
export const apollo = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network'
    }
  }
});
```

### 3. App Integration (`frontend/src/main.tsx`)

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { apollo } from './lib/apolloClient';
import './styles/globals.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={apollo}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
```

### 4. Using Subscriptions in Components

```typescript
import { useSubscription, gql } from '@apollo/client';

const TASK_PROGRESS_SUBSCRIPTION = gql`
  subscription TaskProgressUpdated($workPackageId: ID!) {
    taskProgressUpdated(workPackageId: $workPackageId) {
      taskId
      remainingHours
      reportedBy
      reportedAt
    }
  }
`;

function TaskProgressMonitor({ workPackageId }: { workPackageId: string }) {
  const { data, loading, error } = useSubscription(TASK_PROGRESS_SUBSCRIPTION, {
    variables: { workPackageId }
  });

  if (loading) return <p>Connecting to updates...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h3>Latest Task Progress</h3>
      <pre>{JSON.stringify(data?.taskProgressUpdated, null, 2)}</pre>
    </div>
  );
}
```

---

## Environment Variables

### Backend (`.env`)
```bash
GRAPHQL_PORT=3000
GRAPHQL_PATH=/graphql
SUBSCRIPTIONS_PATH=/graphql
FRONTEND_ORIGIN=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

### Frontend (`.env`)
```bash
VITE_GRAPHQL_HTTP_URL=http://localhost:3000/graphql
VITE_GRAPHQL_WS_URL=ws://localhost:3000/graphql
```

---

## Testing Subscriptions

### 1. Using GraphQL Playground / Apollo Sandbox

```graphql
subscription {
  taskProgressUpdated(workPackageId: "wp-123") {
    taskId
    remainingHours
    reportedBy
    reportedAt
  }
}
```

### 2. Using Browser DevTools

Open Network tab → WS filter → Should see WebSocket connection to `ws://localhost:3000/graphql`

### 3. Trigger from Mutation

```graphql
mutation {
  updateTaskProgress(
    workPackageId: "wp-123"
    taskId: "task-456"
    remainingHours: 5.5
  )
}
```

---

## Troubleshooting

### WebSocket connection refused
- ✅ Ensure backend is running on port 3000
- ✅ Check CORS settings allow frontend origin
- ✅ Verify WebSocketServer path matches client URL

### Subscription not triggering
- ✅ Verify `pubSub.publish()` is called after mutation
- ✅ Check topic string matches between `publish()` and `asyncIterator()`
- ✅ Ensure Redis is running (`docker-compose up -d`)

### Multiple backend instances
- ✅ Redis PubSub enables scaling (messages routed via Redis)
- ✅ Ensure all instances connect to same Redis server

---

## React 19 + Suspense Notes

Apollo Client 3.14 supports React 19, but **Suspense APIs are experimental**:

```typescript
// Opt-in to Suspense (experimental)
import { ApolloProvider } from '@apollo/client/react/suspense';

// Keep Suspense off until verified in production
// Default hooks (useQuery, useSubscription) work fine without Suspense
```

---

## References

- [Apollo Server 4 Subscriptions](https://www.apollographql.com/docs/apollo-server/data/subscriptions)
- [graphql-ws Protocol](https://github.com/enisdenjo/graphql-ws)
- [Apollo Client Split Links](https://www.apollographql.com/docs/react/data/subscriptions#3-split-communication-by-operation-recommended)
- [Redis PubSub Scaling](https://github.com/davidyaha/graphql-redis-subscriptions)
