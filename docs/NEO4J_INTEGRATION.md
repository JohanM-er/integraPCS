# Neo4j Integration: Production Patterns

## Overview

Production-grade Neo4j patterns for integraPCS:
- **Shared driver** with connection pooling and authentication
- **Session management** with try/finally for proper cleanup
- **Constraints and indexes** created upfront for performance
- **Query optimization** with EXPLAIN analysis on hot queries
- **Custom resolvers** for CQRS/event sourcing (vs @neo4j/graphql)

---

## 1. Driver Configuration

### Single Shared Driver Instance

**File:** `backend/src/infrastructure/neo4j/driver.ts`

```typescript
import neo4j, { Driver, Session, SessionMode } from 'neo4j-driver';
import { logger } from '../logger';

let driver: Driver | null = null;

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  maxConnectionPoolSize?: number;
  connectionAcquisitionTimeout?: number;
}

export function createDriver(config: Neo4jConfig): Driver {
  if (driver) {
    logger.warn('Neo4j driver already initialized, returning existing instance');
    return driver;
  }

  driver = neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.user, config.password),
    {
      // Connection pool settings
      maxConnectionPoolSize: config.maxConnectionPoolSize || 50,
      connectionAcquisitionTimeout: config.connectionAcquisitionTimeout || 60000, // 60s

      // Connection timeout
      connectionTimeout: 30000, // 30s

      // Keep-alive
      maxTransactionRetryTime: 30000,

      // Logging
      logging: {
        level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
        logger: (level, message) => {
          if (level === 'error') {
            logger.error({ neo4j: true }, message);
          } else if (level === 'warn') {
            logger.warn({ neo4j: true }, message);
          } else {
            logger.debug({ neo4j: true }, message);
          }
        }
      },

      // Resolver
      resolver: undefined, // Use default DNS resolver

      // TLS (if needed)
      encrypted: config.uri.startsWith('neo4j+s://') ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF'
    }
  );

  logger.info(
    {
      uri: config.uri,
      maxPoolSize: config.maxConnectionPoolSize || 50
    },
    'Neo4j driver initialized'
  );

  return driver;
}

export function getDriver(): Driver {
  if (!driver) {
    throw new Error('Neo4j driver not initialized. Call createDriver() first.');
  }
  return driver;
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    logger.info('Neo4j driver closed');
  }
}

// Verify connectivity on startup
export async function verifyConnectivity(): Promise<void> {
  const driver = getDriver();
  await driver.verifyConnectivity();
  logger.info('Neo4j connectivity verified');
}
```

---

## 2. Session Management Pattern

### Always Use try/finally

**❌ Bad: Session not closed on error**
```typescript
async function getWorkPackage(id: string): Promise<WorkPackage> {
  const session = getDriver().session();
  const result = await session.run('MATCH (wp:WorkPackage {id: $id}) RETURN wp', { id });
  await session.close(); // Never reached if query throws
  return result.records[0].get('wp').properties;
}
```

**✅ Good: Session always closed**
```typescript
async function getWorkPackage(id: string): Promise<WorkPackage | null> {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });

  try {
    const result = await session.run(
      'MATCH (wp:WorkPackage {id: $id}) RETURN wp',
      { id }
    );

    if (!result.records.length) {
      return null;
    }

    return result.records[0].get('wp').properties;
  } finally {
    await session.close(); // Always executed
  }
}
```

### Session Helper Functions

**File:** `backend/src/infrastructure/neo4j/session.ts`

```typescript
import neo4j, { Driver, Session, SessionMode } from 'neo4j-driver';
import { getDriver } from './driver';

/**
 * Create a read session
 */
export function createReadSession(): Session {
  return getDriver().session({
    defaultAccessMode: neo4j.session.READ,
    database: 'neo4j' // Or process.env.NEO4J_DATABASE
  });
}

/**
 * Create a write session
 */
export function createWriteSession(): Session {
  return getDriver().session({
    defaultAccessMode: neo4j.session.WRITE,
    database: 'neo4j'
  });
}

/**
 * Execute a read query with automatic session management
 */
export async function executeRead<T>(
  query: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const session = createReadSession();

  try {
    const result = await session.run(query, params);
    return result.records.map((record) => record.toObject() as T);
  } finally {
    await session.close();
  }
}

/**
 * Execute a write query with automatic session management
 */
export async function executeWrite<T>(
  query: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const session = createWriteSession();

  try {
    const result = await session.run(query, params);
    return result.records.map((record) => record.toObject() as T);
  } finally {
    await session.close();
  }
}

/**
 * Execute a write transaction (for multiple queries)
 */
export async function executeWriteTransaction<T>(
  txWork: (tx: any) => Promise<T>
): Promise<T> {
  const session = createWriteSession();

  try {
    return await session.executeWrite(txWork);
  } finally {
    await session.close();
  }
}
```

---

## 3. Constraints and Indexes

### Create Upfront for Performance

**File:** `backend/src/infrastructure/neo4j/schema.ts`

```typescript
import { getDriver } from './driver';
import { logger } from '../logger';

/**
 * Initialize Neo4j schema: constraints and indexes
 * Run this on application startup
 */
export async function initializeSchema(): Promise<void> {
  const driver = getDriver();
  const session = driver.session();

  try {
    logger.info('Initializing Neo4j schema...');

    // Constraints (enforce uniqueness and create index)
    await session.run(`
      CREATE CONSTRAINT workpackage_id_unique IF NOT EXISTS
      FOR (wp:WorkPackage) REQUIRE wp.id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT task_id_unique IF NOT EXISTS
      FOR (t:Task) REQUIRE t.id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT project_id_unique IF NOT EXISTS
      FOR (p:Project) REQUIRE p.id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT user_id_unique IF NOT EXISTS
      FOR (u:User) REQUIRE u.id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT event_id_unique IF NOT EXISTS
      FOR (e:Event) REQUIRE e.id IS UNIQUE
    `);

    // Additional indexes for hot query paths
    await session.run(`
      CREATE INDEX workpackage_project_status IF NOT EXISTS
      FOR (wp:WorkPackage) ON (wp.projectId, wp.status)
    `);

    await session.run(`
      CREATE INDEX task_status IF NOT EXISTS
      FOR (t:Task) ON (t.status)
    `);

    await session.run(`
      CREATE INDEX event_aggregate IF NOT EXISTS
      FOR (e:Event) ON (e.aggregateId, e.version)
    `);

    await session.run(`
      CREATE INDEX event_timestamp IF NOT EXISTS
      FOR (e:Event) ON (e.timestamp)
    `);

    logger.info('Neo4j schema initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Neo4j schema');
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * List all constraints and indexes (useful for debugging)
 */
export async function showSchema(): Promise<void> {
  const driver = getDriver();
  const session = driver.session();

  try {
    const constraints = await session.run('SHOW CONSTRAINTS');
    logger.info('Constraints:');
    constraints.records.forEach((record) => {
      logger.info(record.toObject());
    });

    const indexes = await session.run('SHOW INDEXES');
    logger.info('Indexes:');
    indexes.records.forEach((record) => {
      logger.info(record.toObject());
    });
  } finally {
    await session.close();
  }
}
```

### Bootstrap Integration

**File:** `backend/src/index.ts`

```typescript
import { createDriver, verifyConnectivity } from './infrastructure/neo4j/driver';
import { initializeSchema } from './infrastructure/neo4j/schema';

async function startServer() {
  // 1. Initialize Neo4j driver
  createDriver({
    uri: config.NEO4J_URI,
    user: config.NEO4J_USER,
    password: config.NEO4J_PASSWORD,
    maxConnectionPoolSize: 50
  });

  // 2. Verify connectivity
  await verifyConnectivity();

  // 3. Initialize schema (constraints/indexes)
  await initializeSchema();

  // 4. Start GraphQL server
  // ...
}
```

---

## 4. Query Optimization with EXPLAIN

### Analyze Hot Queries

**File:** `backend/src/infrastructure/neo4j/queryAnalyzer.ts`

```typescript
import { getDriver } from './driver';
import { logger } from '../logger';

/**
 * Explain a query to analyze performance
 */
export async function explainQuery(
  query: string,
  params: Record<string, any> = {}
): Promise<void> {
  const session = getDriver().session();

  try {
    const result = await session.run(`EXPLAIN ${query}`, params);

    logger.info({ query, params }, 'Query execution plan:');
    result.records.forEach((record) => {
      logger.info(record.toObject());
    });
  } finally {
    await session.close();
  }
}

/**
 * Profile a query to measure actual performance
 */
export async function profileQuery(
  query: string,
  params: Record<string, any> = {}
): Promise<{
  dbHits: number;
  rows: number;
  time: number;
}> {
  const session = getDriver().session();

  try {
    const result = await session.run(`PROFILE ${query}`, params);

    const profile = result.summary.profile;
    if (!profile) {
      throw new Error('No profile information available');
    }

    const stats = {
      dbHits: profile.dbHits || 0,
      rows: profile.rows || 0,
      time: result.summary.resultAvailableAfter.toNumber() +
             result.summary.resultConsumedAfter.toNumber()
    };

    logger.info({ query, params, stats }, 'Query profile');

    return stats;
  } finally {
    await session.close();
  }
}
```

### Example: Optimize Hot Query

```typescript
// Hot query: Get work packages by project and status
const query = `
  MATCH (wp:WorkPackage)
  WHERE wp.projectId = $projectId
    AND wp.status = $status
  RETURN wp
  ORDER BY wp.createdAt DESC
  LIMIT 50
`;

// 1. Analyze execution plan
await explainQuery(query, { projectId: 'proj-1', status: 'IN_PROGRESS' });

// 2. Profile actual performance
const stats = await profileQuery(query, { projectId: 'proj-1', status: 'IN_PROGRESS' });

// 3. If slow, check if index exists:
// CREATE INDEX workpackage_project_status IF NOT EXISTS
// FOR (wp:WorkPackage) ON (wp.projectId, wp.status)

// 4. Re-profile to verify improvement
```

---

## 5. Custom Resolvers vs @neo4j/graphql

### When to Use Custom Resolvers (Current Approach)

✅ **Use custom resolvers when:**
- Implementing CQRS/Event Sourcing (write models emit events)
- Complex business logic in resolvers
- Need DataLoader for N+1 optimization
- Custom authorization logic per field
- Aggregations and computed fields
- Integration with other data sources (Redis, RabbitMQ)

**Example: Custom Resolver with Event Sourcing**

```typescript
export const resolvers = {
  Mutation: {
    createWorkPackage: async (_parent, { input }, context) => {
      // 1. Validate input
      const validated = validateInput(input);

      // 2. Command → Aggregate (emits events)
      const aggregate = WorkPackageAggregate.create(
        validated.name,
        validated.projectId,
        context.userId
      );

      // 3. Append events to event store
      await context.eventStore.append(
        aggregate.id,
        0,
        aggregate.getUncommittedEvents()
      );

      // 4. Publish to RabbitMQ (outbox)
      await publishOutbox('WorkPackage.Created', ...);

      // 5. Return optimistic response
      return { workPackageId: aggregate.id };
    }
  },

  Query: {
    workPackage: async (_parent, { id }, context) => {
      // Read from projection (optimized for queries)
      const session = createReadSession();
      try {
        const result = await session.run(
          'MATCH (wp:WorkPackage {id: $id}) RETURN wp',
          { id }
        );
        return result.records[0]?.get('wp').properties || null;
      } finally {
        await session.close();
      }
    }
  }
};
```

### When to Consider @neo4j/graphql

✅ **Consider @neo4j/graphql when:**
- Building a simple CRUD API (no complex business logic)
- Want autogenerated resolvers based on schema directives
- Need built-in pagination, sorting, filtering
- Don't need event sourcing or CQRS
- Want rapid prototyping with minimal code

**Example: @neo4j/graphql (reference only)**

```typescript
import { Neo4jGraphQL } from '@neo4j/graphql';
import { OGM } from '@neo4j/graphql-ogm';

const typeDefs = `
  type WorkPackage @node {
    id: ID! @id
    name: String!
    project: Project! @relationship(type: "BELONGS_TO", direction: OUT)
    tasks: [Task!]! @relationship(type: "HAS_TASK", direction: OUT)
    createdAt: DateTime! @timestamp(operations: [CREATE])
  }

  type Task @node {
    id: ID! @id
    name: String!
    plannedHours: Float!
    remainingHours: Float!
    workPackage: WorkPackage! @relationship(type: "HAS_TASK", direction: IN)
  }

  type Project @node {
    id: ID! @id
    name: String!
    workPackages: [WorkPackage!]! @relationship(type: "BELONGS_TO", direction: IN)
  }
`;

const neoSchema = new Neo4jGraphQL({
  typeDefs,
  driver: getDriver(),
  features: {
    authorization: {
      key: process.env.JWT_SECRET
    }
  }
});

// Autogenerated resolvers for:
// - queries: workPackage, workPackages, workPackagesAggregate
// - mutations: createWorkPackages, updateWorkPackages, deleteWorkPackages
// - filtering: where, sort, limit, offset
```

**Current Decision:** **Custom resolvers** for integraPCS due to:
- Event sourcing architecture (write models emit events)
- CQRS pattern (separate read/write models)
- Complex projection logic
- DataLoader optimization
- Full control over resolver behavior

---

## 6. Connection Pool Monitoring

### Monitor Pool Health

**File:** `backend/src/infrastructure/neo4j/monitoring.ts`

```typescript
import { getDriver } from './driver';
import { logger } from '../logger';

export interface PoolMetrics {
  inUse: number;
  idle: number;
  total: number;
}

/**
 * Get connection pool metrics
 * Note: Requires driver internal access (use with caution)
 */
export function getPoolMetrics(): PoolMetrics | null {
  try {
    const driver = getDriver();
    // Access internal pool (this is not officially supported API)
    const pool = (driver as any)._connectionProvider?._pool;

    if (!pool) {
      logger.warn('Unable to access connection pool metrics');
      return null;
    }

    return {
      inUse: pool._activeResourceCount || 0,
      idle: pool._availableResourceCount || 0,
      total: pool._activeResourceCount + pool._availableResourceCount || 0
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get pool metrics');
    return null;
  }
}

/**
 * Log pool metrics periodically
 */
export function startPoolMonitoring(intervalMs = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const metrics = getPoolMetrics();
    if (metrics) {
      logger.info({ neo4j: true, poolMetrics: metrics }, 'Connection pool status');
    }
  }, intervalMs);
}
```

---

## 7. Best Practices Summary

### Driver Management
✅ Single shared driver instance per application
✅ Configure connection pool size based on load (default: 50)
✅ Use connection timeout and retry settings
✅ Verify connectivity on startup
✅ Close driver on graceful shutdown

### Session Management
✅ Always use try/finally for session cleanup
✅ Use read sessions for read-only queries
✅ Use write sessions for mutations
✅ Never share sessions across requests
✅ Close sessions immediately after use

### Schema Management
✅ Create constraints upfront (uniqueness + performance)
✅ Add indexes on hot query paths
✅ Use composite indexes for multi-field queries
✅ Run schema initialization on startup

### Query Optimization
✅ Use EXPLAIN for execution plan analysis
✅ Use PROFILE for actual performance measurement
✅ Optimize hot queries (< 100ms p99)
✅ Add parameters to prevent query plan cache pollution
✅ Use LIMIT for large result sets

### Monitoring
✅ Log slow queries (> 1s)
✅ Monitor connection pool usage
✅ Track query execution times
✅ Alert on connection pool exhaustion

---

## Example Integration

**File:** `backend/src/repositories/WorkPackageRepository.ts`

```typescript
import { createReadSession, createWriteSession } from '@/infrastructure/neo4j/session';
import { WorkPackage } from '@/domain/models/WorkPackage';
import { NotFoundError } from '@/domain/errors';
import { logger } from '@/infrastructure/logger';

export class WorkPackageRepository {
  async findById(id: string): Promise<WorkPackage | null> {
    const session = createReadSession();
    const startTime = Date.now();

    try {
      const result = await session.run(
        `
        MATCH (wp:WorkPackage {id: $id})
        OPTIONAL MATCH (wp)-[:HAS_TASK]->(t:Task)
        RETURN wp, collect(t) as tasks
        `,
        { id }
      );

      const queryTime = Date.now() - startTime;
      if (queryTime > 100) {
        logger.warn({ queryTime, query: 'findById' }, 'Slow Neo4j query detected');
      }

      if (!result.records.length) {
        return null;
      }

      const record = result.records[0];
      const wpNode = record.get('wp');
      const tasks = record.get('tasks').map((t: any) => t.properties);

      return {
        ...wpNode.properties,
        tasks
      };
    } finally {
      await session.close();
    }
  }

  async create(workPackage: WorkPackage): Promise<void> {
    const session = createWriteSession();

    try {
      await session.run(
        `
        CREATE (wp:WorkPackage {
          id: $id,
          name: $name,
          projectId: $projectId,
          status: $status,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
        `,
        workPackage
      );
    } finally {
      await session.close();
    }
  }
}
```

---

## Summary

✅ **Single driver** with connection pooling and auth
✅ **try/finally** for all session management
✅ **Constraints upfront** for uniqueness and performance
✅ **EXPLAIN/PROFILE** for query optimization
✅ **Custom resolvers** for CQRS/event sourcing control
✅ **Pool monitoring** for production observability
✅ **Read/write separation** for optimal session management

**Alternative:** Consider `@neo4j/graphql` for simple CRUD APIs without event sourcing.
