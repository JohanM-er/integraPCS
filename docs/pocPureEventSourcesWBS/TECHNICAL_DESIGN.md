# Technical Design Document - Work Package ETC System

**Version**: 1.0  
**Date**: October 2025  
**Status**: Design Phase

---

## 1. System Architecture

### 1.0 Code Organization Philosophy

**POC Structure: Vertical Slice by Bounded Context**

Unlike the existing backend (horizontally layered: `services/`, `dal/`, `socket/`), this POC is organized as a **vertical slice** to prove event sourcing patterns:

```
backend/workPackageContext/     # 🎯 Complete bounded context in one folder
├── domain/                     # Aggregates, Events, Value Objects
├── application/                # Command Handlers, Projections
├── infrastructure/             # Event Store, Repositories, Messaging
├── api/                        # GraphQL Schema, Resolvers
└── tests/                      # Unit, Integration, E2E tests
```

**Benefits**:
- **Clear Isolation**: No accidental coupling with existing cost system
- **Easy Extraction**: Can become microservice by copying folder
- **Complete Flow**: Domain → Events → Projections → API in one place
- **DDD Alignment**: Bounded context clearly defined

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#11-folder-structure-philosophy) for complete folder structure.

---

### 1.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  ─────────────────────────────────────────────────     │
│  • React 19 Web App (PM Dashboard)                     │
│  • React Native Mobile App (Foreman/Crew - Future)     │
│  • Apollo Client (GraphQL queries/mutations/subs)      │
└────────────────────────────────────────────────────────┘
              ↓ GraphQL (HTTP + WebSocket)
┌────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                      │
│  ──────────────────────────────────────────────────    │
│  • GraphQL Server (Apollo Server)                      │
│  • Command Handlers (business logic)                   │
│  • Query Handlers (read model access)                  │
│  • Subscriptions (real-time updates)                   │
└────────────────────────────────────────────────────────┘
         ↓                                    ↓
┌──────────────────────┐          ┌──────────────────────┐
│   WRITE SIDE (CQRS)  │          │   READ SIDE (CQRS)   │
│   ─────────────────  │          │   ────────────────   │
│  • Aggregates        │          │  • Projections       │
│  • Event Store       │          │  • Read Models       │
│  • Command Handlers  │          │  • Query Optimized   │
│  • Event Bus         │          │  • GraphQL Resolvers │
└──────────────────────┘          └──────────────────────┘
         ↓                                    ↑
┌────────────────────────────────────────────────────────┐
│                   MESSAGING LAYER                       │
│  ───────────────────────────────────────────────────   │
│  • RabbitMQ (Event Bus)                                │
│  • Outbox Pattern (Reliable Publishing)                │
│  • Event Routing (workpackage.* topics)                │
└────────────────────────────────────────────────────────┘
         ↓                                    ↑
┌────────────────────────────────────────────────────────┐
│                   PERSISTENCE LAYER                     │
│  ───────────────────────────────────────────────────   │
│  • Neo4j (Event Store + Projections)                   │
│  • Event Nodes (:WorkPackageEvent)                     │
│  • Projection Nodes (:WorkPackage, :Task)              │
│  • Outbox Nodes (:OutboxEvent)                         │
└────────────────────────────────────────────────────────┘
```

### 1.2 CQRS Pattern Implementation

#### Write Side (Commands → Events)
```typescript
GraphQL Mutation: updateTaskProgress
    ↓
Resolver validates input
    ↓
WorkPackageCommandHandler.handleUpdateTaskProgress()
    ↓
Load aggregate: WorkPackageRepository.load(workPackageId)
    ↓ (replays events from event store)
WorkPackageAggregate in-memory
    ↓
aggregate.updateTaskProgress(command) // Business logic
    ↓ (generates TaskProgressUpdated event)
WorkPackageRepository.save(aggregate)
    ↓
EventStore.append(event) // Neo4j write
    ↓
OutboxRepository.create(event) // Transactional outbox
    ↓
Return success to client
```

#### Async Event Publishing (Background)
```typescript
OutboxPublisher (polling every 1s)
    ↓
OutboxRepository.findUnpublished()
    ↓
RabbitMQ.publish('workpackage.events', event)
    ↓
OutboxRepository.markPublished(event.id)
```

#### Read Side (Events → Projections)
```typescript
RabbitMQ Consumer (workpackage.projections queue)
    ↓
Receives TaskProgressUpdated event
    ↓
WorkPackageProjection.onTaskProgressUpdated(event)
    ↓
Neo4j: UPDATE Task SET hoursSpent=..., eac=..., variance=...
    ↓
GraphQL PubSub.publish('TASK_PROGRESS_UPDATED', data)
    ↓
Connected clients receive real-time update
```

### 1.3 Event Sourcing Pattern

```typescript
// Event Stream for Work Package "wp-elec-f3"
[
  { v:1, type: 'WorkPackageCreated', budget: 50000 },
  { v:2, type: 'TaskAdded', taskId: 'T1', estimatedHours: 64 },
  { v:3, type: 'TaskProgressUpdated', taskId: 'T1', hoursSpent: 16, remaining: 48 },
  { v:4, type: 'TaskProgressUpdated', taskId: 'T1', hoursSpent: 32, remaining: 50 },
  { v:5, type: 'TaskVarianceAlert', taskId: 'T1', variance: 18 },
  // ... more events
]

// Reconstruct aggregate from events
const aggregate = WorkPackageAggregate.fromHistory(wpId, events);
// aggregate.tasks.get('T1').hoursSpentToDate === 32
// aggregate.tasks.get('T1').estimateAtCompletion === 82
```

---

## 2. Technology Stack

| Layer | Technology | Version | Justification |
|-------|------------|---------|---------------|
| **Frontend** | React | 19 | Already in use, concurrent rendering |
| **State Management** | Zustand | 4.x | Lightweight, TypeScript-friendly |
| **GraphQL Client** | Apollo Client | 3.8+ | Queries, mutations, subscriptions |
| **UI Components** | shadcn/ui | Latest | Accessible, customizable |
| **Backend Runtime** | Node.js | 20 LTS | Already in use, stable |
| **Language** | TypeScript | 5.x | Type safety, existing codebase |
| **GraphQL Server** | Apollo Server | 4.x | WebSocket support, extensible |
| **Event Store** | Neo4j | 5.x | Graph queries, already deployed |
| **Message Broker** | RabbitMQ | 3.12+ | Reliable, supports pub/sub |
| **Testing (BE)** | Jest | 29.x | Unit and integration tests |
| **Testing (FE)** | Vitest | 1.x | Fast, Vite-compatible |
| **E2E Testing** | Playwright | 1.40+ | Already in use |

---

## 3. Domain-Driven Design

### 3.1 Bounded Context

**Work Package Lifecycle Context**
- **Responsible for**: Complete project lifecycle (planning → estimation → execution → control)
  - **Planning Phase**: Work breakdown structure (WP → Task → LineItem hierarchy)
  - **Estimation Phase**: Cost calculations, material takeoffs, labor estimates
  - **Execution Phase**: Field progress tracking with ETC methodology *(POC Focus)*
  - **Control Phase**: Variance analysis, earned value management
- **Aggregate Roots**: `WorkPackageAggregate`
- **Entities**: `Task`, `LineItem` (within aggregate)
- **Value Objects**: `TaskProgressState`, `MaterialStatus`, `CostEstimate`, `MaterialTakeoff`
- **Events**: 
  - Planning: `WorkPackageCreated`, `TaskAdded`, `LineItemAdded`
  - Estimation: `CostEstimateUpdated`, `MaterialTakeoffCalculated`
  - Execution: `TaskProgressUpdated`, `TaskVarianceAlert` *(POC)*
  - Control: `VarianceAnalysisCompleted`, `EarnedValueCalculated`

**POC Scope**: Focus on **Execution Phase events** as vertical slice

**Isolation from Existing Cost Context**
- NO shared aggregates with existing LineItem system
- Separate event streams (`:WorkPackageEvent` vs `:CostEvent`)
- Separate projections (`:WorkPackage`, `:Task` vs existing `:LineItem`)
- Future: May publish integration events to Cost Context and Invoicing Context

### 3.2 Aggregate Root: WorkPackageAggregate

```typescript
class WorkPackageAggregate {
  // Identity
  private workPackageId: string;
  private version: number; // For optimistic concurrency
  
  // State
  private name: string;
  private phase: 'planning' | 'approved' | 'execution' | 'complete';
  private approvedBudget: number;
  
  // Owned Entities
  private tasks: Map<string, Task>;
  
  // Event tracking
  private uncommittedEvents: DomainEvent[] = [];
  
  // ============================================
  // COMMAND METHODS (Business Logic)
  // ============================================
  
  addTask(cmd: AddTaskCommand): void {
    // Validation
    if (this.phase !== 'planning') {
      throw new Error('Cannot add tasks after approval');
    }
    
    // Business logic
    const task = new Task(cmd.taskId, cmd.name, cmd.estimatedHours);
    this.tasks.set(cmd.taskId, task);
    
    // Generate event
    this.addEvent({
      type: 'TaskAdded',
      taskId: cmd.taskId,
      task: task.toSnapshot()
    });
  }
  
  updateTaskProgress(cmd: UpdateTaskProgressCommand): void {
    // Validation
    const task = this.tasks.get(cmd.taskId);
    if (!task) throw new Error('Task not found');
    
    // Business logic: ETC calculation
    const newHoursSpent = task.hoursSpentToDate + cmd.hoursWorkedToday;
    const hoursRemaining = cmd.hoursRemainingEstimate;
    const eac = newHoursSpent + hoursRemaining;
    const variance = eac - task.originalEstimate;
    const variancePercentage = (variance / task.originalEstimate) * 100;
    
    // Determine status
    let status: ProgressStatus;
    if (variancePercentage <= 5) status = 'on-track';
    else if (variancePercentage <= 15) status = 'at-risk';
    else status = 'over-budget';
    
    // Update task state
    task.hoursSpentToDate = newHoursSpent;
    task.hoursRemainingEstimate = hoursRemaining;
    task.estimateAtCompletion = eac;
    task.variance = variance;
    task.status = status;
    
    // Generate event
    this.addEvent({
      type: 'TaskProgressUpdated',
      taskId: cmd.taskId,
      hoursWorkedToday: cmd.hoursWorkedToday,
      cumulativeHoursSpent: newHoursSpent,
      hoursRemainingEstimate: hoursRemaining,
      estimateAtCompletion: eac,
      variance: variance,
      variancePercentage: variancePercentage,
      status: status,
      crew: cmd.crew,
      workDescription: cmd.workDescription
    });
    
    // Generate alert if over threshold
    if (Math.abs(variancePercentage) > 10) {
      this.addEvent({
        type: 'TaskVarianceAlert',
        taskId: cmd.taskId,
        variance: variance,
        variancePercentage: variancePercentage,
        status: status
      });
    }
  }
  
  // ============================================
  // EVENT APPLICATION (State Mutation)
  // ============================================
  
  private applyEvent(event: DomainEvent): void {
    switch (event.type) {
      case 'WorkPackageCreated':
        this.workPackageId = event.workPackageId;
        this.name = event.name;
        this.approvedBudget = event.approvedBudget;
        this.phase = 'planning';
        break;
        
      case 'TaskAdded':
        const task = Task.fromSnapshot(event.task);
        this.tasks.set(event.taskId, task);
        break;
        
      case 'TaskProgressUpdated':
        const t = this.tasks.get(event.taskId);
        t.hoursSpentToDate = event.cumulativeHoursSpent;
        t.hoursRemainingEstimate = event.hoursRemainingEstimate;
        t.estimateAtCompletion = event.estimateAtCompletion;
        t.variance = event.variance;
        t.status = event.status;
        break;
    }
    
    this.version++;
  }
  
  // ============================================
  // AGGREGATE RECONSTRUCTION
  // ============================================
  
  static fromHistory(wpId: string, events: DomainEvent[]): WorkPackageAggregate {
    const aggregate = new WorkPackageAggregate(wpId);
    for (const event of events) {
      aggregate.applyEvent(event);
    }
    return aggregate;
  }
}
```

---

## 4. Event Store Design

### 4.1 Event Node Schema (Neo4j)

```cypher
// Event node
(:WorkPackageEvent {
  eventId: string UNIQUE,
  eventType: string,
  timestamp: datetime,
  
  // Aggregate identification
  aggregateId: string,          // workPackageId
  aggregateType: 'WorkPackage',
  aggregateVersion: integer,    // Version within this aggregate
  
  // Event payload (JSON string)
  payload: string,              // Full event data
  
  // Metadata
  recordedBy: string,           // userId
  storedAt: datetime
})

// Aggregate version tracking
(:Aggregate {
  aggregateId: string UNIQUE,
  aggregateType: string,
  currentVersion: integer,
  lastEventAt: datetime
})

// Relationships
(agg:Aggregate)-[:HAS_EVENT {version: integer}]->(evt:WorkPackageEvent)
```

### 4.2 Constraints & Indexes

```cypher
// Unique constraints
CREATE CONSTRAINT workpackage_event_id IF NOT EXISTS
FOR (e:WorkPackageEvent) REQUIRE e.eventId IS UNIQUE;

CREATE CONSTRAINT workpackage_aggregate_id IF NOT EXISTS
FOR (a:Aggregate) REQUIRE (a.aggregateId, a.aggregateType) IS UNIQUE;

// Performance indexes
CREATE INDEX workpackage_event_aggregate IF NOT EXISTS
FOR (e:WorkPackageEvent) ON (e.aggregateId);

CREATE INDEX workpackage_event_type IF NOT EXISTS
FOR (e:WorkPackageEvent) ON (e.eventType);

CREATE INDEX workpackage_event_timestamp IF NOT EXISTS
FOR (e:WorkPackageEvent) ON (e.timestamp);

// Versioning index (critical for ordering)
CREATE INDEX workpackage_event_version IF NOT EXISTS
FOR (e:WorkPackageEvent) ON (e.aggregateId, e.aggregateVersion);
```

### 4.3 Optimistic Concurrency Control

```typescript
// Append with version check
async append(event: DomainEvent): Promise<StoredEvent> {
  const session = this.driver.session();
  
  return session.executeWrite(async (tx) => {
    // 1. Get current version
    const result = await tx.run(
      `MERGE (a:Aggregate {aggregateId: $aggId, aggregateType: $aggType})
       ON CREATE SET a.currentVersion = 0
       RETURN a.currentVersion as version`,
      { aggId: event.aggregateId, aggType: event.aggregateType }
    );
    
    const currentVersion = result.records[0].get('version');
    const nextVersion = currentVersion + 1;
    
    // 2. Append event with next version
    await tx.run(
      `CREATE (e:WorkPackageEvent {
         eventId: $eventId,
         eventType: $type,
         timestamp: datetime($timestamp),
         aggregateId: $aggId,
         aggregateType: $aggType,
         aggregateVersion: $nextVersion,
         payload: $payload,
         recordedBy: $userId,
         storedAt: datetime()
       })
       WITH e
       MATCH (a:Aggregate {aggregateId: $aggId})
       SET a.currentVersion = $nextVersion,
           a.lastEventAt = datetime()
       CREATE (a)-[:HAS_EVENT {version: $nextVersion}]->(e)`,
      {
        eventId: event.eventId,
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        aggId: event.aggregateId,
        aggType: event.aggregateType,
        nextVersion,
        payload: JSON.stringify(event),
        userId: event.metadata?.userId
      }
    );
    
    return { ...event, aggregateVersion: nextVersion, storedAt: new Date() };
  });
}
```

**Concurrent Write Scenario:**
- User A and User B both load aggregate at version 5
- User A appends event → version 6 (success)
- User B tries to append event → expects version 6, but finds 6 → conflict!
- System throws `ConcurrencyError`, User B must reload and retry

---

## 5. Projection Design

### 5.1 Read Model Schema (Neo4j)

```cypher
// Work Package Projection (read-optimized)
(:WorkPackage {
  id: string UNIQUE,
  name: string,
  phase: string,
  approvedBudget: float,
  
  // ETC Metrics (denormalized for fast queries)
  originalEstimate: float,
  hoursSpentToDate: float,
  hoursRemainingEstimate: float,
  estimateAtCompletion: float,
  variance: float,
  variancePercentage: float,
  status: string,  // 'on-track' | 'at-risk' | 'over-budget'
  
  lastUpdated: datetime,
  version: integer  // Projection version for idempotency
})

// Task Projection
(:Task {
  id: string UNIQUE,
  workPackageId: string,
  name: string,
  status: string,
  
  // ETC Tracking
  originalEstimate: float,
  hoursSpentToDate: float,
  hoursRemainingEstimate: float,
  estimateAtCompletion: float,
  variance: float,
  variancePercentage: float,
  progressStatus: string,
  
  // Configuration
  reportingTemplate: string,
  autoAlertThreshold: float,
  
  lastUpdate: datetime,
  version: integer
})

// Relationships
(wp:WorkPackage)-[:CONTAINS]->(t:Task)
```

### 5.2 Projection Pipeline

```typescript
class WorkPackageProjectionPipeline {
  constructor(
    private driver: Driver,
    private pubsub: PubSub
  ) {}
  
  async start(): Promise<void> {
    await rabbitMQ.consume('workpackage.projections', async (msg) => {
      const event = JSON.parse(msg.content.toString());
      await this.dispatch(event);
    });
  }
  
  private async dispatch(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case 'WorkPackageCreated':
        await this.onWorkPackageCreated(event);
        break;
      case 'TaskAdded':
        await this.onTaskAdded(event);
        break;
      case 'TaskProgressUpdated':
        await this.onTaskProgressUpdated(event);
        await this.recalculateWorkPackageTotals(event.aggregateId);
        await this.publishToGraphQL(event);
        break;
      case 'TaskVarianceAlert':
        await this.publishAlertToGraphQL(event);
        break;
    }
  }
  
  private async onTaskProgressUpdated(event: TaskProgressUpdated): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (t:Task {id: $taskId})
         SET t.hoursSpentToDate = $hoursSpent,
             t.hoursRemainingEstimate = $hoursRemaining,
             t.estimateAtCompletion = $eac,
             t.variance = $variance,
             t.variancePercentage = $variancePct,
             t.progressStatus = $status,
             t.lastUpdate = datetime(),
             t.version = CASE 
               WHEN COALESCE(t.version, 0) < $eventVersion 
               THEN $eventVersion 
               ELSE t.version 
             END`,
        {
          taskId: event.taskId,
          hoursSpent: event.cumulativeHoursSpent,
          hoursRemaining: event.hoursRemainingEstimate,
          eac: event.estimateAtCompletion,
          variance: event.variance,
          variancePct: event.variancePercentage,
          status: event.status,
          eventVersion: event.aggregateVersion
        }
      );
    } finally {
      await session.close();
    }
  }
  
  private async recalculateWorkPackageTotals(wpId: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (wp:WorkPackage {id: $wpId})-[:CONTAINS]->(t:Task)
         WITH wp, 
              SUM(t.originalEstimate) as totalOriginal,
              SUM(t.hoursSpentToDate) as totalSpent,
              SUM(t.hoursRemainingEstimate) as totalRemaining
         SET wp.originalEstimate = totalOriginal,
             wp.hoursSpentToDate = totalSpent,
             wp.hoursRemainingEstimate = totalRemaining,
             wp.estimateAtCompletion = totalSpent + totalRemaining,
             wp.variance = (totalSpent + totalRemaining) - totalOriginal,
             wp.variancePercentage = 
               CASE WHEN totalOriginal > 0 
               THEN (((totalSpent + totalRemaining) - totalOriginal) / totalOriginal) * 100 
               ELSE 0 END,
             wp.status = CASE
               WHEN (((totalSpent + totalRemaining) - totalOriginal) / totalOriginal) * 100 <= 5 THEN 'on-track'
               WHEN (((totalSpent + totalRemaining) - totalOriginal) / totalOriginal) * 100 <= 15 THEN 'at-risk'
               ELSE 'over-budget'
             END,
             wp.lastUpdated = datetime()`,
        { wpId }
      );
    } finally {
      await session.close();
    }
  }
  
  private async publishToGraphQL(event: TaskProgressUpdated): Promise<void> {
    await this.pubsub.publish('TASK_PROGRESS_UPDATED', {
      taskProgressUpdated: {
        taskId: event.taskId,
        hoursSpentToDate: event.cumulativeHoursSpent,
        estimateAtCompletion: event.estimateAtCompletion,
        variance: event.variance,
        status: event.status
      }
    });
  }
}
```

### 5.3 Idempotency Strategy

**Problem**: Events may be processed twice (RabbitMQ at-least-once delivery)

**Solution**: Version-based idempotency
```cypher
// Only update if event version > projection version
SET t.version = CASE 
  WHEN COALESCE(t.version, 0) < $eventVersion 
  THEN $eventVersion 
  ELSE t.version 
END
```

**Alternative**: Event ID deduplication cache (LRU cache for 5000 recent event IDs)

---

## 6. GraphQL API Design

### 6.1 Schema Organization

```
backend/graphql/
├── schema.graphql           # Complete schema
├── resolvers/
│   ├── workpackageQueries.ts
│   ├── workpackageMutations.ts
│   └── workpackageSubscriptions.ts
└── pubsubBridge/
    └── RabbitToGraphQL.ts
```

### 6.2 Resolver Pattern

```typescript
// Mutations call command handlers
export const workpackageMutations = (cmdHandler: WorkPackageCommandHandler) => ({
  updateTaskProgress: async (
    _: any,
    { workPackageId, taskId, input }: any,
    ctx: GraphQLContext
  ) => {
    // 1. Execute command (generates events)
    await cmdHandler.handleUpdateTaskProgress({
      workPackageId,
      taskId,
      hoursWorkedToday: input.hoursWorkedToday,
      hoursRemainingEstimate: input.hoursRemainingEstimate,
      crew: input.crew,
      workDescription: input.workDescription,
      userId: ctx.user.id
    });
    
    // 2. Read from projection (eventual consistency OK)
    return await ctx.dataSources.tasks.findById(taskId);
  }
});

// Queries read from projections
export const workpackageQueries = {
  workPackage: async (_: any, { id }: any, ctx: GraphQLContext) => {
    return await ctx.dataSources.workPackages.findById(id);
  },
  
  task: async (_: any, { id }: any, ctx: GraphQLContext) => {
    return await ctx.dataSources.tasks.findById(id);
  }
};

// Subscriptions bridge RabbitMQ → GraphQL PubSub
export const workpackageSubscriptions = {
  taskProgressUpdated: {
    subscribe: (_, { taskId }, ctx) => {
      return ctx.pubsub.asyncIterator(['TASK_PROGRESS_UPDATED']);
    }
  }
};
```

---

## 7. Separation from Existing System

### 7.1 Shared Infrastructure (Reuse Directly)

```typescript
// SHARED: Technical infrastructure (refactor in place, no wrappers)

// Database & Messaging
✅ Neo4j driver (/dal/neo4jDriver.ts)
✅ RabbitMQ service (/services/rabbitMQService.ts)
✅ Event store interface (/events/store/EventStore.ts)
✅ Outbox pattern (/events/outbox/OutboxRepository.ts)

// Authentication & Authorization
✅ authNService (/services/authNService.ts) - JWT verification
✅ AuthorizationPolicyService (/services/AuthorizationPolicyService.ts) - Refactor to add WorkPackage policies
✅ userRoleDAL (/dal/userRoleDAL.ts) - User/role queries
✅ User/Role Neo4j schema - Same users across cost system and POC

// Frontend Auth Components
✅ LoginForm (/components/auth/LoginForm.tsx)
✅ RoleAssignmentPanel (/components/auth/RoleAssignmentPanel.tsx)
✅ useAuth hook (/hooks/useAuth.ts)

// GraphQL Infrastructure
✅ GraphQL server setup (/graphql/server.ts)
✅ Apollo Server configuration
```

**Strategy**: Refactor existing infrastructure directly (no backward compatibility constraints). Both cost system and POC use same auth, same users, same infrastructure.

### 7.2 Isolated Business Logic

```typescript
// SEPARATE: Business logic completely isolated
❌ Different aggregates:
   Existing: LineItem (aggregateId = lineItemId) - Cost tracking subsystem
   POC: WorkPackage (aggregateId = workPackageId) - Full lifecycle system

❌ Different event types:
   Existing: lineitem:created, lineitem:updated (cost changes only)
   POC: workpackage:created, task:added, task:progressUpdated, lineitem:estimated
        (planning, estimation, execution events)

❌ Different event nodes:
   Existing: :CostEvent (cost aggregation focus)
   POC: :WorkPackageEvent (full lifecycle events)

❌ Different projections:
   Existing: :LineItem nodes (cost read model)
   POC: :WorkPackage, :Task, :LineItem nodes (planning + execution read models)

❌ Different RabbitMQ exchanges:
   Existing: cost.events → cost.projections
   POC: workpackage.events → workpackage.projections
        (Future: workpackage.integration → invoicing, procurement)

❌ Different command handlers:
   Existing: LineItemCommandHandler (CRUD for line items)
   POC: WorkPackageCommandHandler (planning, estimation, execution commands)

❌ Different GraphQL schema types:
   Existing: LineItem, Task types (cost-focused)
   POC: WorkPackage, Task, LineItem types (lifecycle-focused with ETC metrics)
```

**Why Separate?**
- Existing system: Tactical cost tracking for ongoing operations
- POC system: Strategic lifecycle management from planning to control
- Different business rules: Cost aggregation vs. ETC variance analysis
- Different user workflows: Excel-like planning vs. cell-level editing
- Future integration: POC events can feed existing cost system if needed

### 7.3 Future Integration Points

When POC is proven and full lifecycle system is built, potential integrations:

```typescript
// 1. POC → Cost System: Task completion triggers cost aggregation
EventBus.publish('integration.TaskCompleted', {
  taskId: 'task-1',
  actualHours: 104,
  originalEstimate: 64,
  lineItems: [/* actual quantities used */]
});
// → Cost System subscribes and updates budget projections

// 2. POC → Invoicing System: Progress billing based on completed tasks
EventBus.publish('integration.WorkPackageProgressUpdated', {
  workPackageId: 'wp-1',
  percentComplete: 65,
  completedTasks: ['task-1', 'task-2'],
  earnedValue: 32500
});
// → Invoicing System generates progress invoice

// 3. POC → Procurement System: Material needs from line item estimates
EventBus.publish('integration.MaterialRequirementPlanned', {
  workPackageId: 'wp-1',
  lineItems: [
    { material: '25mm PVC conduit', quantity: 500, requiredBy: '2025-11-15' }
  ]
});
// → Procurement System creates purchase orders

// 4. POC → Contractual System: Link tasks to contract obligations
EventBus.publish('integration.TaskLinkedToContract', {
  taskId: 'task-1',
  contractLineItem: 'contract-123-item-5',
  billableAmount: 5000
});
// → Contract System tracks deliverable completion

// 5. Cost System → POC: Budget changes flow back
EventBus.subscribe('cost.BudgetAdjusted', (event) => {
  // Update work package approved budget
  workPackageCommandHandler.adjustBudget(event.workPackageId, event.newBudget);
});
```

**Integration Strategy**: 
- Use separate `integration.*` RabbitMQ exchange for cross-bounded-context events
- Events are enriched with minimal data (no tight coupling)
- Each system maintains its own projections
- Event versioning for backward compatibility

---

## 8. Performance Considerations

### 8.1 Query Optimization

- Projections are pre-calculated (no aggregation on read)
- Neo4j indexes on common query paths
- GraphQL DataLoader for batch loading
- Pagination on list queries (default: 30, max: 100)

### 8.2 Event Store Optimization

- Snapshots every 100 events (future enhancement)
- Event stream compaction (archive old events after 1 year)
- Separate hot/cold storage (future)

### 8.3 Real-Time Updates

- GraphQL subscriptions via WebSocket
- PubSub backed by Redis (future) or in-memory (POC)
- Subscribe only to relevant aggregates (not broadcast all)

---

## 9. Security & Authorization

### 9.1 Authentication
- JWT tokens (existing system)
- GraphQL context includes user ID and roles

### 9.2 Authorization

**POC reuses existing authorization infrastructure** (refactor in place, no wrappers):

```typescript
// GraphQL Context (reuses existing auth services)
import { authNService } from '../../services/authNService';
import { AuthorizationPolicyService } from '../../services/AuthorizationPolicyService';
import { UserContext } from '../../types/auth';

export interface GraphQLContext {
  user: UserContext | null;               // ✅ REUSE: existing UserContext type
  isAuthenticated: boolean;
  authService: AuthorizationPolicyService; // ✅ REUSE: existing service (refactored)
  neo4jDriver: Driver;
}

// ✅ REUSE: Existing UserContext structure
// (already includes project-scoped roles)
interface UserContext {
  id: string;
  username: string;
  status: string;
  roles: Array<{
    roleName: string;      // 'SuperAdmin', 'PM', 'Foreman', 'Estimator'
    scope: string;         // 'global', 'project', 'site'
    projectId?: string;
    siteId?: string;
  }>;
  sessionVersion: number;
  passwordChangedAt?: string;
}

// Context factory
export async function createGraphQLContext(req: Request): Promise<GraphQLContext> {
  const authHeader = req.headers.authorization;
  let userContext: UserContext | null = null;
  let isAuthenticated = false;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // ✅ REUSE: existing JWT verification
      userContext = await authNService.verifyAccessTokenAndGetUser(token);
      isAuthenticated = true;
    } catch (error) {
      console.error('[GraphQL] Token verification failed:', error);
    }
  }
  
  const driver = await getDriver();
  const authService = new AuthorizationPolicyService(); // ✅ REUSE directly
  
  return { user: userContext, isAuthenticated, authService, neo4jDriver: driver };
}

// Resolver pattern: Authorize before command execution
export const workpackageMutations = {
  updateTaskProgress: async (_, { workPackageId, taskId, input }, context) => {
    // 1. Authentication check
    if (!context.isAuthenticated || !context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    }

    // 2. Authorization check - ✅ REUSE existing service directly
    await context.authService.authorize(
      context.user,
      'WorkPackage' as ResourceType,  // ✅ REFACTOR: Add to existing enum
      'UPDATE' as PolicyAction,
      workPackageId,
      { taskId },
      context.neo4jDriver
    );

    // 3. Execute command
    await commandHandler.handleUpdateTaskProgress({ ... });

    return await context.dataSources.tasks.findById(taskId);
  }
};

// Role-based policies (existing pattern, extended for POC)
const workPackagePolicies = [
  {
    id: 'wp-update-foreman',
    resourceType: 'WorkPackage',
    action: 'UPDATE',
    roles: ['Foreman'],
    conditions: {
      // Foremen can only update task progress in assigned work packages
      customCheck: async (userContext, resourceDetails, driver) => {
        // Check assignment in Neo4j
        return await isUserAssignedToWorkPackage(
          userContext.id, 
          resourceDetails.workPackageId, 
          driver
        );
      }
    }
  }
];
```

**Key Integration Points**:
- ✅ **Reuse `authNService.verifyAccessTokenAndGetUser()`** for JWT verification
- ✅ **Reuse `AuthorizationPolicyService.authorize()`** for permission checks
- ✅ **Refactor existing enum**: Add `'WorkPackage'` to `ResourceType`
- ✅ **Extend existing policies**: Add work package policies alongside task/lineitem policies
- ✅ **Same User/Role schema**: Both cost system and POC use same users
- Events enriched with authorization audit metadata

**Implementation Approach**: 
- **Refactor in place**: Extend existing `AuthorizationPolicyService` directly (no wrappers)
- **No backward compatibility**: Can refactor existing services as needed
- **Extract later**: Eventually copy to new project, leave old cost code behind

See [AUTH_AS_EVENT_SOURCED.md](./AUTH_AS_EVENT_SOURCED.md#7-reusing-existing-auth-infrastructure-migration-strategy) for complete reuse strategy.  
See [AUTHORIZATION_PHASES.md](./AUTHORIZATION_PHASES.md) for phased feature implementation.

---

## 10. Observability

### 10.1 Logging
- Structured logging (JSON format)
- Log levels: DEBUG, INFO, WARN, ERROR
- Key log points: Command received, Event appended, Projection updated

### 10.2 Metrics
- Event append latency (histogram)
- Projection lag (gauge)
- GraphQL query duration (histogram)
- Concurrent edit conflicts (counter)

### 10.3 Tracing
- Correlation IDs flow through: Command → Event → Projection
- Distributed tracing (future: OpenTelemetry)

---

## 11. Deployment Architecture

### 11.1 Development
```
Docker Compose:
- Neo4j (port 7474/7687)
- RabbitMQ (port 5672/15672)
- Backend (port 3000)
- Frontend (port 5173)
```

### 11.2 Production (Future)
```
Kubernetes:
- Backend pods (3 replicas)
- Projection pipeline (2 replicas)
- Outbox publisher (1 replica, leader election)
- Neo4j cluster (3 nodes)
- RabbitMQ cluster (3 nodes)
```

---

**Document Status**: Design Phase  
**Next Review**: After Phase 1 implementation  
**Last Updated**: October 2025

