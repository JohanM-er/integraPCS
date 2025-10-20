# Integration Testing with Testcontainers

## Overview

Integration tests use **Testcontainers** to spin up ephemeral Docker containers for Neo4j, Redis, and RabbitMQ. This ensures:
- ✅ Tests run against real infrastructure (not mocks)
- ✅ Isolated test environments (no shared state between runs)
- ✅ Reproducible CI/CD pipelines
- ✅ Event-sourced seeding (domain events, not direct DB writes)

---

## Architecture

```
Test Suite
├── @testcontainers/neo4j → Neo4j 5 container
├── @testcontainers/redis → Redis 7 container
├── @testcontainers/rabbitmq → RabbitMQ 3.13 container
└── Test fixtures → Domain events + projections
```

**Key Principles:**
1. **Seed via domain events** (not direct writes to Neo4j)
2. **Wait for projections** to complete before assertions
3. **Clean slate** for each test suite (fresh containers)
4. **GraphQL-first** testing (use Apollo Client test utils)

---

## Dependencies

```json
{
  "devDependencies": {
    "@testcontainers/neo4j": "^10.7.2",
    "@testcontainers/redis": "^10.7.2",
    "@testcontainers/rabbitmq": "^10.7.2",
    "testcontainers": "^10.7.2",
    "jest": "^29.7.0",
    "ts-jest": "^29.3.4",
    "@apollo/client": "^3.11.0"
  }
}
```

---

## Setup

### 1. Test Configuration

#### File: `backend/jest.integration.config.js`

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'integration',
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.ts'],
  testTimeout: 60000, // 60s for container startup
  maxWorkers: 1, // Run serially to avoid port conflicts
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '@integrapcs/shared-types': '<rootDir>/../packages/shared-types/src'
  }
};
```

### 2. Global Setup

#### File: `backend/jest.integration.setup.ts`

```typescript
import { Neo4jContainer } from '@testcontainers/neo4j';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

declare global {
  var neo4jContainer: StartedTestContainer;
  var redisContainer: StartedTestContainer;
  var rabbitmqContainer: StartedTestContainer;
}

beforeAll(async () => {
  console.log('🐳 Starting test containers...');

  // Neo4j container
  global.neo4jContainer = await new Neo4jContainer('neo4j:5-community')
    .withApoc()
    .withReuse()
    .start();

  // Redis container
  global.redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withReuse()
    .start();

  // RabbitMQ container
  global.rabbitmqContainer = await new GenericContainer('rabbitmq:3.13-management-alpine')
    .withExposedPorts(5672, 15672)
    .withEnvironment({
      RABBITMQ_DEFAULT_USER: 'test',
      RABBITMQ_DEFAULT_PASS: 'test'
    })
    .withReuse()
    .start();

  // Set env vars for tests
  process.env.NEO4J_URI = global.neo4jContainer.getBoltUri();
  process.env.NEO4J_USER = 'neo4j';
  process.env.NEO4J_PASSWORD = 'password';

  process.env.REDIS_HOST = global.redisContainer.getHost();
  process.env.REDIS_PORT = String(global.redisContainer.getMappedPort(6379));

  process.env.RABBITMQ_URL = `amqp://test:test@${global.rabbitmqContainer.getHost()}:${global.rabbitmqContainer.getMappedPort(5672)}`;

  console.log('✅ Test containers started');
}, 120000); // 2min timeout for container startup

afterAll(async () => {
  console.log('🛑 Stopping test containers...');

  await global.neo4jContainer?.stop();
  await global.redisContainer?.stop();
  await global.rabbitmqContainer?.stop();

  console.log('✅ Test containers stopped');
});
```

---

## Test Patterns

### 1. Event-Sourced Seeding

**❌ Bad: Direct database writes**
```typescript
// DON'T DO THIS
await neo4jSession.run(
  'CREATE (wp:WorkPackage {id: $id, name: $name})',
  { id: 'wp-1', name: 'Test WP' }
);
```

**✅ Good: Domain events**
```typescript
import { EventStore } from '@/infrastructure/eventStore/EventStoreNeo4j';
import { WorkPackageCreatedEvent } from '@integrapcs/shared-types';

async function seedWorkPackage(id: string, name: string): Promise<void> {
  const eventStore = new EventStore(getDriver());

  const event: WorkPackageCreatedEvent = {
    id: generateId(),
    aggregateId: id,
    type: 'WorkPackageCreated',
    version: 1,
    ts: new Date().toISOString(),
    data: {
      workPackageId: id,
      name,
      projectId: 'proj-1',
      createdBy: 'user-1',
      createdAt: new Date().toISOString()
    }
  };

  await eventStore.append(id, 0, [event]);

  // Wait for projection to process
  await waitForProjection('WorkPackage', id);
}
```

### 2. Projection Waiter

#### File: `backend/__tests__/helpers/projectionWaiter.ts`

```typescript
import { getSession } from '@/infrastructure/neo4j/driver';

export async function waitForProjection(
  nodeLabel: string,
  nodeId: string,
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const session = getSession('READ');
    try {
      const result = await session.run(
        `MATCH (n:${nodeLabel} {id: $id}) RETURN n`,
        { id: nodeId }
      );

      if (result.records.length > 0) {
        return; // Projection found
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      await session.close();
    }
  }

  throw new Error(
    `Projection timeout: ${nodeLabel} with id ${nodeId} not found after ${timeoutMs}ms`
  );
}
```

### 3. GraphQL Test Client

#### File: `backend/__tests__/helpers/testClient.ts`

```typescript
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import fetch from 'cross-fetch';

export function createTestClient(serverUrl: string): ApolloClient<any> {
  return new ApolloClient({
    link: new HttpLink({
      uri: serverUrl,
      fetch
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { fetchPolicy: 'no-cache' },
      mutate: { fetchPolicy: 'no-cache' }
    }
  });
}
```

---

## Example Integration Test

#### File: `backend/__tests__/integration/workPackage.test.ts`

```typescript
import { gql } from '@apollo/client';
import { createTestClient } from '../helpers/testClient';
import { seedWorkPackage } from '../fixtures/workPackage';
import { startTestServer, stopTestServer } from '../helpers/testServer';

describe('WorkPackage Integration', () => {
  let serverUrl: string;
  let client: ApolloClient<any>;

  beforeAll(async () => {
    // Start Apollo Server against test containers
    serverUrl = await startTestServer();
    client = createTestClient(serverUrl);
  });

  afterAll(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    // Clean Neo4j between tests
    const session = getSession();
    await session.run('MATCH (n) DETACH DELETE n');
    await session.close();
  });

  test('should create work package via mutation', async () => {
    const CREATE_WP = gql`
      mutation CreateWorkPackage($name: String!, $projectId: ID!) {
        createWorkPackage(name: $name, projectId: $projectId)
      }
    `;

    const result = await client.mutate({
      mutation: CREATE_WP,
      variables: {
        name: 'Integration Test WP',
        projectId: 'proj-1'
      }
    });

    expect(result.data.createWorkPackage).toBeDefined();

    const workPackageId = result.data.createWorkPackage;

    // Wait for projection
    await waitForProjection('WorkPackage', workPackageId);

    // Query to verify
    const GET_WP = gql`
      query GetWorkPackage($id: ID!) {
        workPackage(id: $id) {
          id
          name
          projectId
        }
      }
    `;

    const queryResult = await client.query({
      query: GET_WP,
      variables: { id: workPackageId }
    });

    expect(queryResult.data.workPackage).toEqual({
      id: workPackageId,
      name: 'Integration Test WP',
      projectId: 'proj-1'
    });
  });

  test('should subscribe to task progress updates', async (done) => {
    // Seed work package with task
    const workPackageId = await seedWorkPackage('wp-1', 'Test WP');
    await seedTask(workPackageId, 'task-1', 'Test Task', 10);

    const TASK_PROGRESS_SUB = gql`
      subscription TaskProgressUpdated($workPackageId: ID!) {
        taskProgressUpdated(workPackageId: $workPackageId) {
          taskId
          remainingHours
        }
      }
    `;

    // Subscribe
    const subscription = client.subscribe({
      query: TASK_PROGRESS_SUB,
      variables: { workPackageId }
    });

    subscription.subscribe({
      next: (result) => {
        expect(result.data.taskProgressUpdated).toEqual({
          taskId: 'task-1',
          remainingHours: 7.5
        });
        done();
      },
      error: done
    });

    // Trigger update after subscription is active
    await new Promise((resolve) => setTimeout(resolve, 500));

    const UPDATE_TASK = gql`
      mutation UpdateTaskProgress(
        $workPackageId: ID!
        $taskId: ID!
        $remainingHours: Float!
      ) {
        updateTaskProgress(
          workPackageId: $workPackageId
          taskId: $taskId
          remainingHours: $remainingHours
        )
      }
    `;

    await client.mutate({
      mutation: UPDATE_TASK,
      variables: {
        workPackageId,
        taskId: 'task-1',
        remainingHours: 7.5
      }
    });
  }, 10000);
});
```

---

## Test Server Helper

#### File: `backend/__tests__/helpers/testServer.ts`

```typescript
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

import { schema } from '@/graphql/schema';
import { createContext } from '@/graphql/context';

let server: http.Server;
let cleanup: () => Promise<void>;

export async function startTestServer(): Promise<string> {
  const app = express();
  server = http.createServer(app);

  const wsServer = new WebSocketServer({
    server,
    path: '/graphql'
  });

  cleanup = useServer({ schema, context: createContext }, wsServer).dispose;

  const apolloServer = new ApolloServer({ schema });
  await apolloServer.start();

  app.use('/graphql', express.json(), expressMiddleware(apolloServer, { context: createContext }));

  await new Promise<void>((resolve) => {
    server.listen(0, resolve); // Random port
  });

  const port = (server.address() as AddressInfo).port;
  return `http://localhost:${port}/graphql`;
}

export async function stopTestServer(): Promise<void> {
  await cleanup();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
```

---

## Running Integration Tests

```bash
# Run integration tests
npm run test:integration

# With coverage
npm run test:integration -- --coverage

# Specific test file
npm run test:integration -- workPackage.test.ts

# Watch mode (requires manual container management)
npm run test:integration -- --watch
```

#### Add to `package.json`

```json
{
  "scripts": {
    "test": "jest",
    "test:integration": "jest --config jest.integration.config.js",
    "test:all": "npm test && npm run test:integration"
  }
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build shared types
        run: npm run build:packages

      - name: Run integration tests
        run: npm run test:integration
        env:
          CI: true

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
```

---

## Best Practices

1. **Isolation**: Each test suite gets fresh containers
2. **Event-first**: Seed via domain events, not direct writes
3. **Wait for projections**: Always await projection completion
4. **GraphQL-centric**: Test through GraphQL API (not internal functions)
5. **Cleanup**: Clear Neo4j between tests (`MATCH (n) DETACH DELETE n`)
6. **Realistic data**: Use factories for realistic test fixtures
7. **Subscription testing**: Test real-time updates with actual WebSocket subscriptions

---

## Summary

✅ **Testcontainers** for ephemeral infrastructure
✅ **Event-sourced seeding** (domain events, not direct DB writes)
✅ **Projection waiters** to ensure eventual consistency
✅ **GraphQL test clients** for end-to-end API testing
✅ **WebSocket subscriptions** tested with real connections
✅ **CI/CD ready** (GitHub Actions example)
