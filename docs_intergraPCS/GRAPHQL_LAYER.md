# GraphQL Layer: Production Patterns

## Overview

Production-grade GraphQL patterns for integraPCS:
- **Schema-first development** with graphql-codegen for type safety
- **Domain error mapping** to GraphQLError with structured extensions
- **DataLoader** for N+1 query prevention (Neo4j read optimization)
- **CQRS pattern** (write models emit events → projections build read models)

---

## 1. GraphQL Code Generation

### Issue
Manually maintaining TypeScript types for resolvers and client operations leads to drift and runtime errors.

### Solution
Use **graphql-codegen** to generate types from schema (single source of truth).

### Dependencies

```json
{
  "devDependencies": {
    "@graphql-codegen/cli": "^5.0.2",
    "@graphql-codegen/typescript": "^4.0.9",
    "@graphql-codegen/typescript-resolvers": "^4.3.0",
    "@graphql-codegen/typescript-operations": "^4.3.0",
    "@graphql-codegen/typescript-react-apollo": "^4.3.2"
  }
}
```

---

### Backend Setup

#### 1. Schema Definition

**File:** `backend/src/graphql/schema/typeDefs.ts`

```typescript
export const typeDefs = `#graphql
  scalar DateTime
  scalar UUID

  type WorkPackage {
    id: ID!
    name: String!
    projectId: ID!
    status: WorkPackageStatus!
    tasks: [Task!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Task {
    id: ID!
    name: String!
    plannedHours: Float!
    remainingHours: Float!
    status: TaskStatus!
  }

  enum WorkPackageStatus {
    PLANNING
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }

  enum TaskStatus {
    TODO
    IN_PROGRESS
    COMPLETED
  }

  type Query {
    workPackage(id: ID!): WorkPackage
    workPackages(projectId: ID!, status: WorkPackageStatus): [WorkPackage!]!
  }

  type Mutation {
    createWorkPackage(input: CreateWorkPackageInput!): CreateWorkPackagePayload!
    addTask(input: AddTaskInput!): AddTaskPayload!
    updateTaskProgress(input: UpdateTaskProgressInput!): UpdateTaskProgressPayload!
  }

  type Subscription {
    taskProgressUpdated(workPackageId: ID!): Task!
    workPackageStatusChanged(projectId: ID!): WorkPackage!
  }

  input CreateWorkPackageInput {
    name: String!
    projectId: ID!
  }

  type CreateWorkPackagePayload {
    workPackage: WorkPackage!
    userErrors: [UserError!]!
  }

  input AddTaskInput {
    workPackageId: ID!
    name: String!
    plannedHours: Float!
  }

  type AddTaskPayload {
    task: Task!
    userErrors: [UserError!]!
  }

  input UpdateTaskProgressInput {
    workPackageId: ID!
    taskId: ID!
    remainingHours: Float!
  }

  type UpdateTaskProgressPayload {
    task: Task!
    userErrors: [UserError!]!
  }

  type UserError {
    message: String!
    field: String
    code: ErrorCode!
  }

  enum ErrorCode {
    NOT_FOUND
    INVALID_INPUT
    UNAUTHORIZED
    FORBIDDEN
    CONFLICT
    INTERNAL_ERROR
  }
`;
```

#### 2. Codegen Configuration

**File:** `backend/codegen.yml`

```yaml
schema: './src/graphql/schema/typeDefs.ts'
generates:
  ./src/generated/graphql.ts:
    plugins:
      - typescript
      - typescript-resolvers
    config:
      useIndexSignature: true
      contextType: '@/graphql/context#GraphQLContext'
      mappers:
        WorkPackage: '@/domain/models/WorkPackage#WorkPackage'
        Task: '@/domain/models/Task#Task'
      scalars:
        DateTime: string
        UUID: string
      enumsAsTypes: true
      avoidOptionals:
        field: true
        inputValue: false
        object: true
      maybeValue: T | null | undefined
      inputMaybeValue: T | null | undefined
```

#### 3. Generate Types

**Add to `package.json`:**

```json
{
  "scripts": {
    "codegen": "graphql-codegen --config codegen.yml",
    "codegen:watch": "graphql-codegen --config codegen.yml --watch"
  }
}
```

**Run:**
```bash
npm run codegen
```

#### 4. Use Generated Types in Resolvers

**File:** `backend/src/graphql/resolvers/workPackage.ts`

```typescript
import {
  QueryResolvers,
  MutationResolvers,
  WorkPackage,
  CreateWorkPackageInput
} from '@/generated/graphql';
import { GraphQLContext } from '../context';
import { DomainError } from '@/domain/errors';
import { toGraphQLError } from '../errorMapper';

export const workPackageResolvers: QueryResolvers & MutationResolvers = {
  Query: {
    workPackage: async (
      _parent,
      { id },
      context: GraphQLContext
    ): Promise<WorkPackage | null> => {
      try {
        return await context.workPackageService.getById(id);
      } catch (error) {
        if (error instanceof DomainError) {
          throw toGraphQLError(error);
        }
        throw error;
      }
    },

    workPackages: async (
      _parent,
      { projectId, status },
      context: GraphQLContext
    ): Promise<WorkPackage[]> => {
      return await context.workPackageService.findByProject(projectId, status);
    }
  },

  Mutation: {
    createWorkPackage: async (
      _parent,
      { input },
      context: GraphQLContext
    ) => {
      try {
        const workPackage = await context.commandBus.execute({
          type: 'CreateWorkPackage',
          payload: input
        });

        return {
          workPackage,
          userErrors: []
        };
      } catch (error) {
        if (error instanceof DomainError) {
          return {
            workPackage: null as any, // Will be filtered by GraphQL
            userErrors: [{
              message: error.message,
              field: error.field,
              code: error.code
            }]
          };
        }
        throw error;
      }
    }
  }
};
```

---

### Frontend Setup

#### 1. Codegen Configuration

**File:** `frontend/codegen.yml`

```yaml
schema: '../backend/src/graphql/schema/typeDefs.ts'
documents: './src/**/*.{ts,tsx}'
generates:
  ./src/generated/graphql.ts:
    plugins:
      - typescript
      - typescript-operations
      - typescript-react-apollo
    config:
      withHooks: true
      withComponent: false
      withHOC: false
      scalars:
        DateTime: string
        UUID: string
      avoidOptionals:
        field: true
        inputValue: false
      maybeValue: T | null | undefined
```

#### 2. Generate Client Types

**Add to `package.json`:**

```json
{
  "scripts": {
    "codegen": "graphql-codegen --config codegen.yml",
    "codegen:watch": "graphql-codegen --config codegen.yml --watch"
  }
}
```

#### 3. Use Generated Hooks

**File:** `frontend/src/features/workPackages/WorkPackageList.tsx`

```typescript
import {
  useWorkPackagesQuery,
  WorkPackageStatus,
  useTaskProgressUpdatedSubscription
} from '@/generated/graphql';

export function WorkPackageList({ projectId }: { projectId: string }) {
  // Type-safe query hook
  const { data, loading, error } = useWorkPackagesQuery({
    variables: {
      projectId,
      status: WorkPackageStatus.InProgress
    }
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.workPackages.map((wp) => (
        <li key={wp.id}>
          {wp.name} - {wp.tasks.length} tasks
        </li>
      ))}
    </ul>
  );
}
```

---

## 2. Domain Error Mapping

### Issue
Domain errors (validation, business rules, not found) need structured representation in GraphQL responses.

### Pattern
Map domain errors to `GraphQLError` with typed `extensions.code` for client-side handling.

---

### Implementation

#### File: `backend/src/domain/errors.ts`

```typescript
export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class DomainError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public field?: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

// Specific domain error classes
export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(ErrorCode.NOT_FOUND, `${entity} with id ${id} not found`);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, field?: string) {
    super(ErrorCode.INVALID_INPUT, message, field);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(ErrorCode.CONFLICT, message);
  }
}
```

#### File: `backend/src/graphql/errorMapper.ts`

```typescript
import { GraphQLError } from 'graphql';
import { DomainError, ErrorCode } from '@/domain/errors';
import { logger } from '@/infrastructure/logger';

export function toGraphQLError(error: DomainError): GraphQLError {
  // Log internal errors only
  if (error.code === ErrorCode.INTERNAL_ERROR) {
    logger.error({ error }, 'Internal error in resolver');
  }

  return new GraphQLError(error.message, {
    extensions: {
      code: error.code,
      field: error.field,
      metadata: error.metadata,
      // Include stack trace only in development
      ...(process.env.NODE_ENV === 'development' && {
        stacktrace: error.stack?.split('\n')
      })
    }
  });
}
```

#### Resolver Usage

```typescript
export const resolvers = {
  Mutation: {
    createWorkPackage: async (_parent, { input }, context) => {
      try {
        // Domain layer throws DomainError subclasses
        const result = await context.workPackageService.create(input);
        return { workPackage: result, userErrors: [] };
      } catch (error) {
        if (error instanceof DomainError) {
          // Convert to user-facing error in payload
          return {
            workPackage: null,
            userErrors: [{
              message: error.message,
              field: error.field,
              code: error.code
            }]
          };
        }
        // Unknown errors bubble up as 500
        throw toGraphQLError(
          new DomainError(ErrorCode.INTERNAL_ERROR, 'Internal server error')
        );
      }
    }
  }
};
```

#### Client-Side Error Handling

```typescript
import { useCreateWorkPackageMutation } from '@/generated/graphql';

export function CreateWorkPackageForm() {
  const [createWP, { loading, error }] = useCreateWorkPackageMutation();

  const handleSubmit = async (input: CreateWorkPackageInput) => {
    const result = await createWP({ variables: { input } });

    if (result.data?.createWorkPackage.userErrors.length) {
      const errors = result.data.createWorkPackage.userErrors;
      errors.forEach((err) => {
        if (err.code === 'INVALID_INPUT') {
          showFieldError(err.field, err.message);
        } else if (err.code === 'CONFLICT') {
          showAlert(err.message);
        }
      });
    } else {
      showSuccess('Work package created!');
    }
  };

  // Handle network/GraphQL errors
  if (error) {
    return <ErrorBoundary error={error} />;
  }

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## 3. DataLoader for N+1 Prevention

### Issue
Fetching related entities (e.g., `WorkPackage.tasks`) in resolvers causes N+1 queries to Neo4j.

### Solution
Use **DataLoader** to batch and cache requests per GraphQL operation.

### Dependencies

```json
{
  "dependencies": {
    "dataloader": "^2.2.2"
  }
}
```

---

### Implementation

#### File: `backend/src/infrastructure/dataloaders/taskLoader.ts`

```typescript
import DataLoader from 'dataloader';
import { Driver } from 'neo4j-driver';
import { Task } from '@/domain/models/Task';

export function createTaskLoader(driver: Driver): DataLoader<string, Task[]> {
  return new DataLoader(async (workPackageIds: readonly string[]) => {
    const session = driver.session({ defaultAccessMode: 'READ' });

    try {
      const result = await session.run(
        `
        MATCH (wp:WorkPackage)-[:HAS_TASK]->(t:Task)
        WHERE wp.id IN $workPackageIds
        RETURN wp.id AS workPackageId, collect(t) AS tasks
        ORDER BY t.createdAt
        `,
        { workPackageIds: Array.from(workPackageIds) }
      );

      // Map results to match input order
      const tasksByWpId = new Map<string, Task[]>();
      result.records.forEach((record) => {
        const wpId = record.get('workPackageId');
        const tasks = record.get('tasks').map((node: any) => ({
          id: node.properties.id,
          name: node.properties.name,
          plannedHours: node.properties.plannedHours,
          remainingHours: node.properties.remainingHours,
          status: node.properties.status
        }));
        tasksByWpId.set(wpId, tasks);
      });

      // Return in same order as input
      return workPackageIds.map((id) => tasksByWpId.get(id) || []);
    } finally {
      await session.close();
    }
  });
}
```

#### File: `backend/src/graphql/context.ts`

```typescript
import { Request } from 'express';
import DataLoader from 'dataloader';
import { Driver } from 'neo4j-driver';
import { createTaskLoader } from '@/infrastructure/dataloaders/taskLoader';

export interface GraphQLContext {
  userId?: string;
  driver: Driver;
  loaders: {
    tasks: DataLoader<string, Task[]>;
    // Add more loaders as needed
  };
}

export async function createContext({ req }: { req: Request }): Promise<GraphQLContext> {
  const driver = getDriver();

  return {
    userId: extractUserId(req),
    driver,
    loaders: {
      tasks: createTaskLoader(driver)
    }
  };
}
```

#### Resolver Usage

```typescript
import { WorkPackageResolvers } from '@/generated/graphql';

export const workPackageFieldResolvers: WorkPackageResolvers = {
  // Field resolver for WorkPackage.tasks
  tasks: async (parent, _args, context) => {
    // DataLoader batches multiple calls into single Neo4j query
    return context.loaders.tasks.load(parent.id);
  }
};
```

**Before (N+1):**
```
Query: workPackages { tasks { name } }
→ SELECT * FROM WorkPackage (1 query)
→ SELECT * FROM Task WHERE wpId = 1 (N queries)
→ SELECT * FROM Task WHERE wpId = 2
→ ...
```

**After (batched):**
```
Query: workPackages { tasks { name } }
→ SELECT * FROM WorkPackage (1 query)
→ SELECT * FROM Task WHERE wpId IN (1,2,3,...) (1 batched query)
```

---

## 4. CQRS Pattern (Event Sourcing)

### Principle
**Write models** (aggregates) emit domain events → **Read models** (projections) built asynchronously.

### Architecture

```
Mutation: createWorkPackage
├── 1. Validate input at resolver boundary
├── 2. Command → Aggregate (domain logic)
├── 3. Aggregate emits events (WorkPackageCreated)
├── 4. Event Store appends events to stream
├── 5. Publish to RabbitMQ (outbox pattern)
└── 6. Return optimistic response

Background Projection Consumer
├── 1. Consume event from RabbitMQ
├── 2. Project to read model (Neo4j graph)
└── 3. Publish to Redis PubSub (subscriptions)

Query: workPackage(id)
└── Read from projection (optimized for queries)
```

---

### Implementation

#### 1. Input Validation (Resolver Boundary)

```typescript
import { z } from 'zod';
import { ValidationError } from '@/domain/errors';

const CreateWorkPackageInputSchema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string().uuid()
});

export const resolvers = {
  Mutation: {
    createWorkPackage: async (_parent, { input }, context) => {
      // Validate at boundary
      const validated = CreateWorkPackageInputSchema.safeParse(input);
      if (!validated.success) {
        throw new ValidationError(
          validated.error.errors[0].message,
          validated.error.errors[0].path.join('.')
        );
      }

      // Command to domain
      const result = await context.commandBus.execute({
        type: 'CreateWorkPackage',
        payload: validated.data
      });

      return { workPackage: result, userErrors: [] };
    }
  }
};
```

#### 2. Command Handler (Write Model)

```typescript
import { EventStore } from '@/infrastructure/eventStore/EventStoreNeo4j';
import { WorkPackageAggregate } from '@/domain/aggregates/WorkPackageAggregate';
import { publishOutbox } from '@/infrastructure/rabbitmq/outbox';

export async function handleCreateWorkPackage(
  command: CreateWorkPackageCommand,
  context: { eventStore: EventStore; userId: string }
): Promise<{ workPackageId: string }> {
  // 1. Create aggregate
  const aggregate = WorkPackageAggregate.create(
    command.name,
    command.projectId,
    context.userId
  );

  // 2. Get uncommitted events
  const events = aggregate.getUncommittedEvents();

  // 3. Append to event store
  await context.eventStore.append(aggregate.id, 0, events, {
    userId: context.userId,
    correlationId: generateCorrelationId()
  });

  // 4. Publish to outbox (RabbitMQ)
  for (const event of events) {
    await publishOutbox('WorkPackage.Created', event);
  }

  // 5. Clear uncommitted events
  aggregate.clearUncommittedEvents();

  return { workPackageId: aggregate.id };
}
```

#### 3. Projection Consumer (Read Model)

```typescript
import { consume } from '@/infrastructure/rabbitmq/connection';
import { getSession } from '@/infrastructure/neo4j/driver';
import { WorkPackageCreatedEvent } from '@integrapcs/shared-types';

export async function startProjectionConsumers(): Promise<void> {
  await consume('workpackage.projection', async (msg) => {
    const event = JSON.parse(msg.content.toString()) as WorkPackageCreatedEvent;

    // Project to Neo4j read model
    const session = getSession('WRITE');
    try {
      await session.run(
        `
        CREATE (wp:WorkPackage {
          id: $id,
          name: $name,
          projectId: $projectId,
          status: 'PLANNING',
          createdAt: $createdAt,
          updatedAt: $createdAt
        })
        `,
        {
          id: event.data.workPackageId,
          name: event.data.name,
          projectId: event.data.projectId,
          createdAt: event.data.createdAt
        }
      );

      // Publish to GraphQL subscriptions
      await context.pubSub.publish('WORK_PACKAGE_CREATED', {
        workPackageStatusChanged: {
          id: event.data.workPackageId,
          name: event.data.name,
          projectId: event.data.projectId
        }
      });
    } finally {
      await session.close();
    }
  });
}
```

#### 4. Query Resolver (Read from Projection)

```typescript
export const resolvers = {
  Query: {
    workPackage: async (_parent, { id }, context) => {
      // Read from projection (optimized for queries)
      const session = context.driver.session({ defaultAccessMode: 'READ' });
      try {
        const result = await session.run(
          `
          MATCH (wp:WorkPackage {id: $id})
          RETURN wp
          `,
          { id }
        );

        if (!result.records.length) {
          throw new NotFoundError('WorkPackage', id);
        }

        return result.records[0].get('wp').properties;
      } finally {
        await session.close();
      }
    }
  }
};
```

---

## Summary

✅ **graphql-codegen**: Single source of truth (schema) → generated types for backend resolvers and frontend hooks
✅ **Error mapping**: Domain errors → GraphQLError with `extensions.code` for structured client handling
✅ **DataLoader**: Batch Neo4j reads per request, eliminates N+1 queries
✅ **CQRS**: Write models emit events → projections build read models asynchronously
✅ **Input validation**: Zod schemas at resolver boundary (fail fast)
✅ **Type safety**: End-to-end from schema → resolvers → client hooks

**Best Practices:**
1. Run `codegen:watch` during development for instant type updates
2. Always validate inputs at resolver boundary (before domain logic)
3. Use DataLoader for all N+1-prone relations
4. Keep write models simple (emit events, don't query)
5. Optimize read models for specific query patterns
6. Return user-friendly errors in mutation payloads (not just throw)
7. Add `__typename` to all object types for Apollo cache normalization
