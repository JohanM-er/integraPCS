# Implementation Guide - Work Package ETC System

**Version**: 1.0  
**Date**: October 2025  
**Status**: Implementation Phase

---

## Table of Contents
1. [Phase 1: Core Event Sourcing](#phase-1-core-event-sourcing)
2. [Phase 2: GraphQL API](#phase-2-graphql-api)
3. [Phase 3: Frontend Components](#phase-3-frontend-components)
4. [Verification Steps](#verification-steps)
5. [Common Patterns](#common-patterns)
6. [Troubleshooting](#troubleshooting)

---

## Phase 1: Core Event Sourcing

**Timeline**: 2 weeks  
**Goal**: Implement aggregate, event store, and projection pipeline

### 1.1 Folder Structure Philosophy

**Current Project Structure (Horizontal Layers)**:
- Backend: `services/`, `dal/`, `socket/`, `policies/` (separated by technical concern)
- Frontend: `src/features/` (feature-oriented, vertical slices) ✅

**POC Structure (Vertical Slice by Bounded Context)**:
- Backend: `workPackageContext/` (all layers for one bounded context together)
- Frontend: `src/features/WorkPackageETC/` (already feature-oriented) ✅

**Why Vertical Slicing for POC?**
1. **Clear Bounded Context**: All WorkPackage lifecycle code in one place
2. **Easy to Extract**: Can become a separate microservice later
3. **DDD Principles**: Aggregate, events, projections, and API together
4. **Complete Isolation**: No accidental dependencies on existing cost system
5. **Easier Onboarding**: New devs see the full flow in one folder

---

### 1.2 Complete File Structure

```
backend/
└── workPackageContext/              # 🎯 VERTICAL SLICE (Bounded Context)
    ├── domain/                      # Domain Layer (business logic)
    │   ├── WorkPackageAggregate.ts
    │   ├── Task.ts
    │   ├── valueObjects/
    │   │   ├── CrewMember.ts
    │   │   ├── TaskProgressReport.ts
    │   │   └── MaterialStatus.ts
    │   ├── commands/
    │   │   ├── CreateWorkPackageCommand.ts
    │   │   ├── AddTaskCommand.ts
    │   │   └── UpdateTaskProgressCommand.ts
    │   └── events/
    │       ├── DomainEvents.ts      # All event type definitions
    │       ├── WorkPackageCreated.ts
    │       ├── TaskAdded.ts
    │       ├── TaskProgressUpdated.ts
    │       └── TaskVarianceAlert.ts
    │
    ├── application/                 # Application Layer (use cases)
    │   ├── commandHandlers/
    │   │   └── WorkPackageCommandHandler.ts
    │   ├── queryHandlers/
    │   │   ├── WorkPackageQueryHandler.ts
    │   │   └── TaskQueryHandler.ts
    │   └── projections/
    │       ├── WorkPackageProjectionPipeline.ts
    │       ├── handlers/
    │       │   ├── WorkPackageProjectionHandler.ts
    │       │   └── TaskProjectionHandler.ts
    │       └── consumers/
    │           └── RabbitMQProjectionConsumer.ts
    │
    ├── infrastructure/              # Infrastructure Layer (technical concerns)
    │   ├── persistence/
    │   │   ├── WorkPackageEventStore.ts
    │   │   ├── WorkPackageRepository.ts
    │   │   └── projectionMappers/
    │   │       ├── mapWorkPackageNodeToProjection.ts
    │   │       └── mapTaskNodeToProjection.ts
    │   ├── outbox/
    │   │   ├── OutboxRepository.ts
    │   │   └── OutboxPublisher.ts
    │   └── messaging/
    │       └── WorkPackageEventBus.ts
    │
    ├── api/                         # API Layer (GraphQL interface)
    │   ├── schema/
    │   │   └── workpackage.graphql
    │   ├── resolvers/
    │   │   ├── workpackageQueries.ts
    │   │   ├── workpackageMutations.ts
    │   │   └── workpackageSubscriptions.ts
    │   ├── dataSources/
    │   │   ├── WorkPackageDataSource.ts
    │   │   └── TaskDataSource.ts
    │   └── pubsub/
    │       └── WorkPackagePubSubBridge.ts
    │
    ├── tests/                       # Tests (mirror domain structure)
    │   ├── unit/
    │   │   ├── domain/
    │   │   │   ├── WorkPackageAggregate.test.ts
    │   │   │   └── Task.test.ts
    │   │   ├── application/
    │   │   │   └── WorkPackageCommandHandler.test.ts
    │   │   └── api/
    │   │       └── workpackageResolvers.test.ts
    │   ├── integration/
    │   │   ├── WorkPackageEventStore.test.ts
    │   │   ├── WorkPackageProjection.test.ts
    │   │   └── WorkPackageGraphQL.test.ts
    │   └── e2e/
    │       └── workPackageFlow.test.ts
    │
    └── README.md                    # Context documentation

frontend/
└── src/
    └── features/
        └── WorkPackageETC/          # 🎯 VERTICAL SLICE (Feature)
            ├── components/
            │   ├── DailyProgressForm/
            │   │   ├── DailyProgressForm.tsx
            │   │   ├── DailyProgressForm.test.tsx
            │   │   ├── CrewInput.tsx
            │   │   └── ProgressSubmitButton.tsx
            │   ├── PMDashboard/
            │   │   ├── PMEarlyWarningDashboard.tsx
            │   │   ├── WorkPackageSummaryCard.tsx
            │   │   ├── TasksRequiringAttention.tsx
            │   │   └── VarianceAlertToast.tsx
            │   ├── TaskETCTrend/
            │   │   ├── TaskETCTrend.tsx
            │   │   ├── ETCLineChart.tsx
            │   │   └── VarianceIndicator.tsx
            │   └── shared/
            │       ├── ETCMetricsDisplay.tsx
            │       └── ProgressStatusBadge.tsx
            │
            ├── hooks/
            │   ├── useUpdateTaskProgress.ts
            │   ├── useWorkPackageQuery.ts
            │   ├── useTaskProgressSubscription.ts
            │   └── useVarianceAlerts.ts
            │
            ├── graphql/
            │   ├── queries.ts
            │   ├── mutations.ts
            │   └── subscriptions.ts
            │
            ├── pages/
            │   ├── ForemanReportPage.tsx
            │   └── PMEarlyWarningPage.tsx
            │
            ├── types/
            │   └── workpackage.types.ts
            │
            └── tests/
                └── e2e/
                    ├── dailyProgressReport.spec.ts
                    └── pmEarlyWarningDashboard.spec.ts

# Shared Infrastructure (Used by POC, but not owned by it)
backend/
├── shared/                          # Shared across bounded contexts
│   ├── infrastructure/
│   │   ├── neo4j/
│   │   │   └── driver.ts            # ✅ POC uses this
│   │   ├── rabbitmq/
│   │   │   └── connection.ts        # ✅ POC uses this
│   │   └── graphql/
│   │       └── server.ts            # ✅ POC registers schema here
│   ├── patterns/
│   │   ├── EventStore.interface.ts  # ✅ POC implements this
│   │   ├── Repository.interface.ts
│   │   └── DomainEvent.interface.ts
│   └── utils/
│       ├── idGenerator.ts
│       └── dateUtils.ts
```

---

### 1.3 Integration with Existing Project

```
schedNeoOrg/
├── backend/
│   ├── workPackageContext/         # 🆕 POC (vertical slice)
│   │   └── [structure above]
│   │
│   ├── services/                   # ✅ Existing (horizontal)
│   ├── dal/                        # ✅ Existing (horizontal)
│   ├── socket/                     # ✅ Existing (horizontal)
│   │
│   ├── shared/                     # ✅ Shared infrastructure
│   │   └── [Neo4j, RabbitMQ, etc.]
│   │
│   ├── server.socketio.ts          # Existing server
│   └── server.graphql.ts           # 🆕 GraphQL server (POC adds schema)
│
└── frontend/
    └── src/
        ├── features/
        │   ├── GridView/           # ✅ Existing (horizontal layers)
        │   ├── WBSNavigator/       # ✅ Existing
        │   └── WorkPackageETC/     # 🆕 POC (vertical slice)
        │
        └── lib/
            ├── apollo/
            │   └── client.ts       # 🆕 POC uses this
            └── socketio/
                └── client.ts       # ✅ Existing
```

### 1.4 Layer Dependencies & Rules

```
┌─────────────────────────────────────────────────────────┐
│                      API Layer                          │
│  (GraphQL Resolvers, DataSources, Subscriptions)       │
└───────────────────┬─────────────────────────────────────┘
                    ↓ imports from
┌─────────────────────────────────────────────────────────┐
│                 Application Layer                        │
│  (Command Handlers, Query Handlers, Projections)       │
└───────────────────┬─────────────────────────────────────┘
                    ↓ imports from
┌─────────────────────────────────────────────────────────┐
│                   Domain Layer                          │
│  (Aggregates, Entities, Value Objects, Events)         │
│  ⚠️ NO IMPORTS FROM BELOW LAYERS                        │
└─────────────────────────────────────────────────────────┘
                    ↑ used by
┌─────────────────────────────────────────────────────────┐
│              Infrastructure Layer                        │
│  (Event Store, Repositories, Messaging)                │
│  → Implements interfaces defined in Domain              │
└─────────────────────────────────────────────────────────┘
```

**Dependency Rules** (Enforced by ESLint/TS config):
```typescript
// ✅ ALLOWED
import { WorkPackageAggregate } from '../domain/WorkPackageAggregate';
import { TaskProgressUpdated } from '../domain/events/DomainEvents';

// ❌ FORBIDDEN (domain importing from infrastructure)
import { WorkPackageEventStore } from '../infrastructure/persistence/WorkPackageEventStore';
// → Domain should only depend on interfaces, not implementations

// ✅ CORRECT (infrastructure implements domain interface)
// domain/WorkPackageRepository.interface.ts
export interface IWorkPackageRepository {
  load(id: string): Promise<WorkPackageAggregate>;
}

// infrastructure/persistence/WorkPackageRepository.ts
export class WorkPackageRepository implements IWorkPackageRepository {
  // Implementation uses Neo4j driver
}
```

---

### 1.5 Comparison: Horizontal vs. Vertical Slicing

#### Current Backend (Horizontal Layers)
```
backend/
├── services/
│   ├── lineItemService.ts        # All line item business logic
│   ├── taskService.ts            # All task business logic
│   └── hierarchyService.ts
├── dal/
│   ├── lineItemDal.ts            # All line item data access
│   ├── taskDal.ts
│   └── hierarchyDal.ts
└── socket/
    ├── lineItemHandlers.ts       # All line item Socket.IO handlers
    └── taskHandlers.ts

❌ Problem: To understand line item flow, must navigate 3+ folders
❌ Problem: Hard to extract as separate microservice
❌ Problem: Risk of tight coupling (services import from each other)
```

#### POC Backend (Vertical Slice by Bounded Context)
```
backend/
└── workPackageContext/
    ├── domain/                   # Business logic
    ├── application/              # Use cases
    ├── infrastructure/           # Technical implementations
    └── api/                      # GraphQL interface

✅ Benefit: Complete flow in one folder (domain → events → projections → API)
✅ Benefit: Easy to extract as microservice (copy folder + wire dependencies)
✅ Benefit: Clear bounded context boundary (no accidental coupling)
✅ Benefit: Onboarding: "Go to workPackageContext/ to understand work packages"
```

---

### 1.6 Practical Guidelines

#### When to Add a New File

**Adding a new command:**
```bash
# Create in domain layer
backend/workPackageContext/domain/commands/CompleteTaskCommand.ts

# Add handler in application layer
backend/workPackageContext/application/commandHandlers/
  → WorkPackageCommandHandler.ts (add method)

# Add tests
backend/workPackageContext/tests/unit/application/
  → WorkPackageCommandHandler.test.ts
```

**Adding a new event:**
```bash
# Define event in domain layer
backend/workPackageContext/domain/events/TaskCompleted.ts
backend/workPackageContext/domain/events/DomainEvents.ts (export)

# Add projection handler
backend/workPackageContext/application/projections/handlers/
  → TaskProjectionHandler.ts (add case in switch)

# Add test
backend/workPackageContext/tests/integration/TaskProjection.test.ts
```

**Adding a new GraphQL query:**
```bash
# Add to schema
backend/workPackageContext/api/schema/workpackage.graphql

# Add resolver
backend/workPackageContext/api/resolvers/workpackageQueries.ts

# Add data source method (if needed)
backend/workPackageContext/api/dataSources/WorkPackageDataSource.ts

# Add frontend hook
frontend/src/features/WorkPackageETC/hooks/useWorkPackageQuery.ts
```

#### Shared Infrastructure

**✅ POC Can Use (Shared, Stable)**:
- `backend/shared/infrastructure/neo4j/driver.ts`
- `backend/shared/infrastructure/rabbitmq/connection.ts`
- `backend/shared/patterns/EventStore.interface.ts`
- `backend/shared/utils/idGenerator.ts`

**❌ POC Should NOT Import (Existing Business Logic)**:
- `backend/services/*` (existing line item services)
- `backend/dal/*` (existing data access)
- `backend/socket/*` (Socket.IO handlers)
- `backend/policies/*` (existing business rules)

**Why?** POC proves event sourcing architecture independently. Importing existing services creates coupling and defeats the purpose of isolation.

---

### 1.2 Step-by-Step Implementation

#### Step 1.1: Define Domain Events

**File**: `backend/domain/workpackage/events/DomainEvents.ts`

```typescript
export interface BaseDomainEvent {
  eventId: string;
  type: string;
  timestamp: Date;
  aggregateId: string;
  aggregateType: 'WorkPackage';
  metadata?: {
    userId: string;
    userName: string;
    correlationId?: string;
    causationId?: string;
  };
}

export interface WorkPackageCreated extends BaseDomainEvent {
  type: 'WorkPackageCreated';
  workPackageId: string;
  name: string;
  description: string;
  approvedBudget: number;
  scheduledStart: Date;
  scheduledEnd: Date;
}

export interface TaskAdded extends BaseDomainEvent {
  type: 'TaskAdded';
  taskId: string;
  name: string;
  estimatedHours: number;
  reportingTemplate: 'minimal' | 'standard' | 'detailed';
}

export interface TaskProgressUpdated extends BaseDomainEvent {
  type: 'TaskProgressUpdated';
  taskId: string;
  
  // ETC data
  hoursWorkedToday: number;
  cumulativeHoursSpent: number;
  hoursRemainingEstimate: number;
  estimateAtCompletion: number;
  variance: number;
  variancePercentage: number;
  status: 'on-track' | 'at-risk' | 'over-budget';
  
  // Context
  crew: Array<{
    workerId: string;
    name: string;
    hoursWorked: number;
    role: string;
  }>;
  workDescription: string;
  
  // Audit enrichment
  previousValues?: {
    cumulativeHoursSpent: number;
    hoursRemainingEstimate: number;
    estimateAtCompletion: number;
    status: string;
  };
}

export interface TaskVarianceAlert extends BaseDomainEvent {
  type: 'TaskVarianceAlert';
  taskId: string;
  variance: number;
  variancePercentage: number;
  status: 'at-risk' | 'over-budget';
  estimateAtCompletion: number;
  originalEstimate: number;
  severity: 'warning' | 'critical';
  alertMessage: string;
}

export type WorkPackageEvent =
  | WorkPackageCreated
  | TaskAdded
  | TaskProgressUpdated
  | TaskVarianceAlert;
```

#### Step 1.2: Implement Task Entity

**File**: `backend/domain/workpackage/Task.ts`

```typescript
import { TaskProgressUpdated, TaskVarianceAlert } from './events/DomainEvents';
import { v4 as uuidv4 } from 'uuid';

export type TaskStatus = 'not-started' | 'in-progress' | 'complete' | 'blocked';
export type ProgressStatus = 'on-track' | 'at-risk' | 'over-budget';
export type ReportingTemplate = 'minimal' | 'standard' | 'detailed';

export interface CrewMember {
  workerId: string;
  name: string;
  hoursWorked: number;
  role: 'journeyman' | 'apprentice' | 'laborer';
}

export class Task {
  readonly taskId: string;
  name: string;
  status: TaskStatus = 'not-started';
  
  // ETC Tracking
  readonly originalEstimate: number;
  hoursSpentToDate: number = 0;
  hoursRemainingEstimate: number;
  estimateAtCompletion: number;
  variance: number = 0;
  variancePercentage: number = 0;
  progressStatus: ProgressStatus = 'on-track';
  
  // Configuration
  reportingTemplate: ReportingTemplate;
  autoAlertThreshold: number = 10;
  
  constructor(
    taskId: string,
    name: string,
    estimatedHours: number,
    reportingTemplate: ReportingTemplate = 'standard'
  ) {
    this.taskId = taskId;
    this.name = name;
    this.originalEstimate = estimatedHours;
    this.hoursRemainingEstimate = estimatedHours;
    this.estimateAtCompletion = estimatedHours;
    this.reportingTemplate = reportingTemplate;
  }
  
  /**
   * Business Logic: Calculate ETC and generate event
   */
  updateProgress(
    hoursWorkedToday: number,
    hoursRemainingEstimate: number,
    crew: CrewMember[],
    workDescription: string,
    userId: string,
    userName: string
  ): { progressEvent: TaskProgressUpdated; alertEvent?: TaskVarianceAlert } {
    // Capture old values for audit trail
    const previousValues = {
      cumulativeHoursSpent: this.hoursSpentToDate,
      hoursRemainingEstimate: this.hoursRemainingEstimate,
      estimateAtCompletion: this.estimateAtCompletion,
      status: this.progressStatus
    };
    
    // Calculate new values
    const cumulativeHoursSpent = this.hoursSpentToDate + hoursWorkedToday;
    const eac = cumulativeHoursSpent + hoursRemainingEstimate;
    const variance = eac - this.originalEstimate;
    const variancePercentage = (variance / this.originalEstimate) * 100;
    
    // Determine status
    let status: ProgressStatus;
    if (variancePercentage <= 5) status = 'on-track';
    else if (variancePercentage <= 15) status = 'at-risk';
    else status = 'over-budget';
    
    // Update task status
    if (this.status === 'not-started' && hoursWorkedToday > 0) {
      this.status = 'in-progress';
    }
    
    // Generate progress event
    const progressEvent: TaskProgressUpdated = {
      eventId: uuidv4(),
      type: 'TaskProgressUpdated',
      timestamp: new Date(),
      aggregateId: '', // Will be set by aggregate
      aggregateType: 'WorkPackage',
      taskId: this.taskId,
      hoursWorkedToday,
      cumulativeHoursSpent,
      hoursRemainingEstimate,
      estimateAtCompletion: eac,
      variance,
      variancePercentage,
      status,
      crew,
      workDescription,
      previousValues,
      metadata: { userId, userName }
    };
    
    // Generate alert if over threshold
    let alertEvent: TaskVarianceAlert | undefined;
    if (Math.abs(variancePercentage) > this.autoAlertThreshold) {
      const severity = Math.abs(variancePercentage) > 20 ? 'critical' : 'warning';
      alertEvent = {
        eventId: uuidv4(),
        type: 'TaskVarianceAlert',
        timestamp: new Date(),
        aggregateId: '',
        aggregateType: 'WorkPackage',
        taskId: this.taskId,
        variance,
        variancePercentage,
        status,
        estimateAtCompletion: eac,
        originalEstimate: this.originalEstimate,
        severity,
        alertMessage: `Task "${this.name}" variance: ${variance.toFixed(1)}h (${variancePercentage.toFixed(1)}%)`,
        metadata: { userId, userName }
      };
    }
    
    return { progressEvent, alertEvent };
  }
  
  /**
   * Apply event to update state (during replay or after command)
   */
  applyProgressUpdate(event: TaskProgressUpdated): void {
    this.hoursSpentToDate = event.cumulativeHoursSpent;
    this.hoursRemainingEstimate = event.hoursRemainingEstimate;
    this.estimateAtCompletion = event.estimateAtCompletion;
    this.variance = event.variance;
    this.variancePercentage = event.variancePercentage;
    this.progressStatus = event.status;
    
    if (this.status === 'not-started' && event.hoursWorkedToday > 0) {
      this.status = 'in-progress';
    }
  }
}
```

#### Step 1.3: Implement Work Package Aggregate

**File**: `backend/domain/workpackage/WorkPackageAggregate.ts`

```typescript
import { Task, CrewMember } from './Task';
import { WorkPackageEvent, WorkPackageCreated, TaskAdded, TaskProgressUpdated } from './events/DomainEvents';

export type WorkPackagePhase = 'planning' | 'approved' | 'execution' | 'complete' | 'cancelled';

export class WorkPackageAggregate {
  private workPackageId: string;
  private version: number = 0;
  
  // State
  private name: string = '';
  private description: string = '';
  private phase: WorkPackagePhase = 'planning';
  private approvedBudget: number = 0;
  private scheduledStart: Date = new Date();
  private scheduledEnd: Date = new Date();
  
  // Owned entities
  private tasks: Map<string, Task> = new Map();
  
  // Uncommitted events
  private uncommittedEvents: WorkPackageEvent[] = [];
  
  constructor(workPackageId?: string) {
    this.workPackageId = workPackageId || '';
  }
  
  // ============================================
  // GETTERS
  // ============================================
  
  get id(): string { return this.workPackageId; }
  get aggregateVersion(): number { return this.version; }
  get currentPhase(): WorkPackagePhase { return this.phase; }
  getUncommittedEvents(): WorkPackageEvent[] { return [...this.uncommittedEvents]; }
  clearUncommittedEvents(): void { this.uncommittedEvents = []; }
  
  // ============================================
  // COMMAND METHODS
  // ============================================
  
  static create(
    workPackageId: string,
    name: string,
    description: string,
    approvedBudget: number,
    scheduledStart: Date,
    scheduledEnd: Date,
    userId: string,
    userName: string
  ): WorkPackageAggregate {
    const aggregate = new WorkPackageAggregate(workPackageId);
    
    const event: WorkPackageCreated = {
      eventId: require('uuid').v4(),
      type: 'WorkPackageCreated',
      timestamp: new Date(),
      aggregateId: workPackageId,
      aggregateType: 'WorkPackage',
      workPackageId,
      name,
      description,
      approvedBudget,
      scheduledStart,
      scheduledEnd,
      metadata: { userId, userName }
    };
    
    aggregate.applyEvent(event);
    aggregate.uncommittedEvents.push(event);
    
    return aggregate;
  }
  
  addTask(
    taskId: string,
    name: string,
    estimatedHours: number,
    reportingTemplate: 'minimal' | 'standard' | 'detailed',
    userId: string,
    userName: string
  ): void {
    // Validation
    if (this.phase !== 'planning') {
      throw new Error('Cannot add tasks after approval');
    }
    if (this.tasks.has(taskId)) {
      throw new Error('Task already exists');
    }
    
    // Generate event
    const event: TaskAdded = {
      eventId: require('uuid').v4(),
      type: 'TaskAdded',
      timestamp: new Date(),
      aggregateId: this.workPackageId,
      aggregateType: 'WorkPackage',
      taskId,
      name,
      estimatedHours,
      reportingTemplate,
      metadata: { userId, userName }
    };
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  updateTaskProgress(
    taskId: string,
    hoursWorkedToday: number,
    hoursRemainingEstimate: number,
    crew: CrewMember[],
    workDescription: string,
    userId: string,
    userName: string
  ): void {
    // Validation
    if (this.phase !== 'execution' && this.phase !== 'approved') {
      throw new Error('Work package not in execution phase');
    }
    
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    // Delegate to task entity
    const { progressEvent, alertEvent } = task.updateProgress(
      hoursWorkedToday,
      hoursRemainingEstimate,
      crew,
      workDescription,
      userId,
      userName
    );
    
    // Set aggregate ID
    progressEvent.aggregateId = this.workPackageId;
    
    this.applyEvent(progressEvent);
    this.uncommittedEvents.push(progressEvent);
    
    if (alertEvent) {
      alertEvent.aggregateId = this.workPackageId;
      this.uncommittedEvents.push(alertEvent);
    }
  }
  
  // ============================================
  // EVENT APPLICATION
  // ============================================
  
  private applyEvent(event: WorkPackageEvent): void {
    switch (event.type) {
      case 'WorkPackageCreated':
        this.workPackageId = event.workPackageId;
        this.name = event.name;
        this.description = event.description;
        this.approvedBudget = event.approvedBudget;
        this.scheduledStart = event.scheduledStart;
        this.scheduledEnd = event.scheduledEnd;
        this.phase = 'planning';
        break;
        
      case 'TaskAdded':
        const task = new Task(event.taskId, event.name, event.estimatedHours, event.reportingTemplate);
        this.tasks.set(event.taskId, task);
        break;
        
      case 'TaskProgressUpdated':
        const t = this.tasks.get(event.taskId);
        if (t) {
          t.applyProgressUpdate(event);
        }
        break;
    }
    
    this.version++;
  }
  
  // ============================================
  // AGGREGATE RECONSTRUCTION
  // ============================================
  
  static fromHistory(workPackageId: string, events: WorkPackageEvent[]): WorkPackageAggregate {
    const aggregate = new WorkPackageAggregate(workPackageId);
    
    for (const event of events) {
      aggregate.applyEvent(event);
    }
    
    return aggregate;
  }
}
```

#### Step 1.4: Implement Event Store

**File**: `backend/infrastructure/eventStore/WorkPackageEventStore.ts`

```typescript
import { Driver, Session } from 'neo4j-driver';
import { WorkPackageEvent } from '../../domain/workpackage/events/DomainEvents';

export interface StoredEvent extends WorkPackageEvent {
  aggregateVersion: number;
  storedAt: Date;
}

export class WorkPackageEventStore {
  constructor(private driver: Driver) {}
  
  /**
   * Append event with optimistic concurrency control
   */
  async append(event: WorkPackageEvent): Promise<StoredEvent> {
    const session = this.driver.session();
    
    try {
      return await session.executeWrite(async (tx) => {
        // 1. Get current version
        const versionResult = await tx.run(
          `MERGE (a:Aggregate {aggregateId: $aggId, aggregateType: 'WorkPackage'})
           ON CREATE SET a.currentVersion = 0
           RETURN a.currentVersion as version`,
          { aggId: event.aggregateId }
        );
        
        const currentVersion = versionResult.records[0].get('version').toInt();
        const nextVersion = currentVersion + 1;
        
        // 2. Append event
        const storedAt = new Date();
        await tx.run(
          `CREATE (e:WorkPackageEvent {
             eventId: $eventId,
             eventType: $type,
             timestamp: datetime($timestamp),
             aggregateId: $aggId,
             aggregateType: 'WorkPackage',
             aggregateVersion: $nextVersion,
             payload: $payload,
             recordedBy: $userId,
             storedAt: datetime($storedAt)
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
            nextVersion,
            payload: JSON.stringify(event),
            userId: event.metadata?.userId || 'system',
            storedAt: storedAt.toISOString()
          }
        );
        
        // 3. Insert into outbox (transactional)
        await tx.run(
          `CREATE (o:OutboxEvent {
             id: randomUUID(),
             eventId: $eventId,
             eventType: $type,
             payload: $payload,
             status: 'pending',
             createdAt: datetime(),
             attempts: 0
           })`,
          {
            eventId: event.eventId,
            type: event.type,
            payload: JSON.stringify(event)
          }
        );
        
        return { ...event, aggregateVersion: nextVersion, storedAt };
      });
    } finally {
      await session.close();
    }
  }
  
  /**
   * Load all events for an aggregate
   */
  async loadEvents(aggregateId: string): Promise<StoredEvent[]> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(
        `MATCH (a:Aggregate {aggregateId: $aggId})-[r:HAS_EVENT]->(e:WorkPackageEvent)
         RETURN e
         ORDER BY e.aggregateVersion ASC`,
        { aggId: aggregateId }
      );
      
      return result.records.map(record => {
        const node = record.get('e');
        const payload = JSON.parse(node.properties.payload);
        return {
          ...payload,
          aggregateVersion: node.properties.aggregateVersion.toInt(),
          storedAt: new Date(node.properties.storedAt)
        };
      });
    } finally {
      await session.close();
    }
  }
}
```

#### Step 1.5: Implement Repository

**File**: `backend/infrastructure/eventStore/WorkPackageRepository.ts`

```typescript
import { WorkPackageAggregate } from '../../domain/workpackage/WorkPackageAggregate';
import { WorkPackageEventStore } from './WorkPackageEventStore';

export class WorkPackageRepository {
  constructor(private eventStore: WorkPackageEventStore) {}
  
  /**
   * Load aggregate from event store
   */
  async load(workPackageId: string): Promise<WorkPackageAggregate> {
    const events = await this.eventStore.loadEvents(workPackageId);
    
    if (events.length === 0) {
      throw new Error(`Work package not found: ${workPackageId}`);
    }
    
    return WorkPackageAggregate.fromHistory(workPackageId, events);
  }
  
  /**
   * Save aggregate (append uncommitted events)
   */
  async save(aggregate: WorkPackageAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    
    for (const event of events) {
      await this.eventStore.append(event);
    }
    
    aggregate.clearUncommittedEvents();
  }
}
```

#### Step 1.6: Implement Command Handler

**File**: `backend/application/commandHandlers/WorkPackageCommandHandler.ts`

```typescript
import { WorkPackageRepository } from '../../infrastructure/eventStore/WorkPackageRepository';
import { WorkPackageAggregate } from '../../domain/workpackage/WorkPackageAggregate';

export interface UpdateTaskProgressCommand {
  workPackageId: string;
  taskId: string;
  hoursWorkedToday: number;
  hoursRemainingEstimate: number;
  crew: Array<{
    workerId: string;
    name: string;
    hoursWorked: number;
    role: string;
  }>;
  workDescription: string;
  userId: string;
  userName: string;
}

export class WorkPackageCommandHandler {
  constructor(private repository: WorkPackageRepository) {}
  
  async handleUpdateTaskProgress(command: UpdateTaskProgressCommand): Promise<void> {
    // Load aggregate
    const aggregate = await this.repository.load(command.workPackageId);
    
    // Execute command (generates events)
    aggregate.updateTaskProgress(
      command.taskId,
      command.hoursWorkedToday,
      command.hoursRemainingEstimate,
      command.crew,
      command.workDescription,
      command.userId,
      command.userName
    );
    
    // Save (append events)
    await this.repository.save(aggregate);
  }
}
```

#### Step 1.7: Implement Projection Pipeline

**File**: `backend/application/projections/WorkPackageProjectionPipeline.ts`

```typescript
import { Driver } from 'neo4j-driver';
import { WorkPackageEvent, TaskProgressUpdated, TaskVarianceAlert } from '../../domain/workpackage/events/DomainEvents';

export class WorkPackageProjectionPipeline {
  constructor(
    private driver: Driver,
    private pubsub: any // GraphQL PubSub
  ) {}
  
  async dispatch(event: WorkPackageEvent): Promise<void> {
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
             t.lastReportDate = datetime(),
             t.lastReportedBy = $userId,
             t.lastWorkDescription = $workDesc,
             t.lastUpdated = datetime(),
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
          userId: event.metadata?.userId,
          workDesc: event.workDescription,
          eventVersion: 1 // In real impl, get from event.aggregateVersion
        }
      );
      
      // Store progress history for trend chart
      await session.run(
        `CREATE (h:TaskProgressHistory {
           id: randomUUID(),
           taskId: $taskId,
           reportDate: datetime($timestamp),
           hoursSpentToDate: $hoursSpent,
           hoursRemainingEstimate: $hoursRemaining,
           estimateAtCompletion: $eac,
           variance: $variance,
           status: $status,
           crewSize: $crewSize,
           totalHoursWorkedToday: $hoursToday
         })
         WITH h
         MATCH (t:Task {id: $taskId})
         CREATE (t)-[:HAS_HISTORY]->(h)`,
        {
          taskId: event.taskId,
          timestamp: event.timestamp.toISOString(),
          hoursSpent: event.cumulativeHoursSpent,
          hoursRemaining: event.hoursRemainingEstimate,
          eac: event.estimateAtCompletion,
          variance: event.variance,
          status: event.status,
          crewSize: event.crew.length,
          hoursToday: event.hoursWorkedToday
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
              SUM(t.hoursRemainingEstimate) as totalRemaining,
              COUNT(t) as totalTasks,
              SUM(CASE WHEN t.status = 'complete' THEN 1 ELSE 0 END) as completedTasks,
              SUM(CASE WHEN t.progressStatus = 'at-risk' THEN 1 ELSE 0 END) as atRiskTasks,
              SUM(CASE WHEN t.progressStatus = 'over-budget' THEN 1 ELSE 0 END) as overBudgetTasks
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
             wp.totalTaskCount = totalTasks,
             wp.completedTaskCount = completedTasks,
             wp.atRiskTaskCount = atRiskTasks,
             wp.overBudgetTaskCount = overBudgetTasks,
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
  
  private async publishAlertToGraphQL(event: TaskVarianceAlert): Promise<void> {
    await this.pubsub.publish('TASK_VARIANCE_ALERT', {
      taskVarianceAlert: {
        taskId: event.taskId,
        variance: event.variance,
        variancePercentage: event.variancePercentage,
        severity: event.severity,
        message: event.alertMessage
      }
    });
  }
}
```

### 1.3 Verification Steps

#### Test 1: Aggregate Reconstruction

```bash
cd backend
npm test -- WorkPackageAggregate.test.ts
```

**Expected**: Aggregate correctly reconstructs state from events

#### Test 2: Event Store Persistence

```bash
npm test -- WorkPackageEventStore.test.ts
```

**Expected**: Events persisted to Neo4j with correct versioning

#### Test 3: Projection Update

```bash
npm test -- WorkPackageProjection.test.ts
```

**Expected**: Task node updated with ETC metrics

---

## Phase 2: GraphQL API

**Timeline**: 1 week  
**Goal**: Expose commands and queries via GraphQL

### 2.1 File Structure

```
backend/
└── graphql/
    ├── schema/
    │   ├── workpackage.graphql
    │   └── index.ts
    ├── resolvers/
    │   ├── workpackageQueries.ts
    │   ├── workpackageMutations.ts
    │   └── workpackageSubscriptions.ts
    └── context.ts
```

### 2.2 Implementation

See [API_SPECIFICATION.md](./API_SPECIFICATION.md) for complete schema and resolvers.

### 2.3 Verification Steps

```bash
# Start backend
cd backend && npm run dev

# Test mutation
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { updateTaskProgress(workPackageId: \"wp-1\", taskId: \"task-1\", input: { hoursWorkedToday: 16, hoursRemainingEstimate: 48, crew: [], workDescription: \"Test\" }) { id etcMetrics { estimateAtCompletion } } }"
  }'
```

---

## Phase 3: Frontend Components

**Timeline**: 1 week  
**Goal**: Build mobile-optimized forms and PM dashboard

### 3.1 File Structure

```
frontend/
└── src/
    ├── features/
    │   └── WorkPackageETC/
    │       ├── components/
    │       │   ├── DailyProgressForm.tsx
    │       │   ├── PMDashboard.tsx
    │       │   ├── TaskETCTrend.tsx
    │       │   └── VarianceAlertBadge.tsx
    │       ├── hooks/
    │       │   ├── useUpdateTaskProgress.ts
    │       │   ├── useWorkPackageQuery.ts
    │       │   └── useTaskProgressSubscription.ts
    │       └── pages/
    │           ├── ForemanReportPage.tsx
    │           └── PMEarlyWarningPage.tsx
    └── lib/
        └── apollo/
            └── client.ts
```

### 3.2 Key Components

#### Daily Progress Form (Mobile)

```tsx
// frontend/src/features/WorkPackageETC/components/DailyProgressForm.tsx
import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_TASK_PROGRESS } from '../graphql/mutations';

export function DailyProgressForm({ workPackageId, taskId }: Props) {
  const [hoursWorked, setHoursWorked] = useState('');
  const [hoursRemaining, setHoursRemaining] = useState('');
  const [workDesc, setWorkDesc] = useState('');
  
  const [updateProgress, { loading }] = useMutation(UPDATE_TASK_PROGRESS);
  
  const handleSubmit = async () => {
    await updateProgress({
      variables: {
        workPackageId,
        taskId,
        input: {
          hoursWorkedToday: parseFloat(hoursWorked),
          hoursRemainingEstimate: parseFloat(hoursRemaining),
          crew: [], // Simplified for POC
          workDescription: workDesc
        }
      }
    });
    
    // Reset form
    setHoursWorked('');
    setHoursRemaining('');
    setWorkDesc('');
  };
  
  return (
    <form className="space-y-4 p-4">
      <div>
        <label className="block text-lg font-medium">Hours Worked Today</label>
        <input
          type="number"
          value={hoursWorked}
          onChange={(e) => setHoursWorked(e.target.value)}
          className="w-full text-2xl p-3 border rounded-lg"
          placeholder="16"
        />
      </div>
      
      <div>
        <label className="block text-lg font-medium">Hours Remaining</label>
        <input
          type="number"
          value={hoursRemaining}
          onChange={(e) => setHoursRemaining(e.target.value)}
          className="w-full text-2xl p-3 border rounded-lg"
          placeholder="48"
        />
      </div>
      
      <div>
        <label className="block text-lg font-medium">Work Description</label>
        <textarea
          value={workDesc}
          onChange={(e) => setWorkDesc(e.target.value)}
          className="w-full p-3 border rounded-lg"
          placeholder="Installed conduits..."
          rows={3}
        />
      </div>
      
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-blue-600 text-white text-xl p-4 rounded-lg"
      >
        {loading ? 'Submitting...' : 'Submit Report'}
      </button>
    </form>
  );
}
```

### 3.3 Verification Steps

```bash
cd frontend
npm run dev

# Navigate to http://localhost:5173/foreman/wp-1/task-1
# Submit daily report
# Verify real-time update on PM dashboard
```

---

## Common Patterns

### Pattern 1: Event Enrichment (Old + New Values)

```typescript
// In Task.updateProgress()
const previousValues = {
  cumulativeHoursSpent: this.hoursSpentToDate,
  hoursRemainingEstimate: this.hoursRemainingEstimate,
  estimateAtCompletion: this.estimateAtCompletion,
  status: this.progressStatus
};

const event: TaskProgressUpdated = {
  // ... new values
  previousValues // OLD values for audit trail
};
```

### Pattern 2: Optimistic Concurrency

```typescript
// In EventStore.append()
const currentVersion = await getAggregateVersion(aggregateId);
const nextVersion = currentVersion + 1;

// If another write happened, version will have changed
// → Transaction will fail, client must retry
```

### Pattern 3: Idempotent Projections

```cypher
// Only update if event version > projection version
SET t.version = CASE 
  WHEN COALESCE(t.version, 0) < $eventVersion 
  THEN $eventVersion 
  ELSE t.version 
END
```

---

## Troubleshooting

### Issue 1: Concurrent Edit Conflicts

**Symptom**: `ConcurrencyError` when saving aggregate

**Solution**: Reload aggregate and retry command

```typescript
try {
  await repository.save(aggregate);
} catch (e) {
  if (e.name === 'ConcurrencyError') {
    // Reload and retry
    aggregate = await repository.load(wpId);
    aggregate.updateTaskProgress(...);
    await repository.save(aggregate);
  }
}
```

### Issue 2: Projection Lag

**Symptom**: Client queries show stale data after mutation

**Solution**: Accept eventual consistency or poll for update

```typescript
// Option 1: Accept lag (recommended)
await updateProgress(); // Returns immediately
// Projection updates within 500ms

// Option 2: Poll projection (not recommended)
await updateProgress();
await new Promise(r => setTimeout(r, 500));
const updated = await refetch();
```

### Issue 3: Event Replay Slow

**Symptom**: Loading aggregate takes >2 seconds

**Solution**: Implement snapshots (future enhancement)

```typescript
// Every 100 events, store snapshot
if (aggregate.version % 100 === 0) {
  await snapshotStore.save(aggregate.toSnapshot());
}

// Load from snapshot + replay recent events
const snapshot = await snapshotStore.load(wpId);
const aggregate = WorkPackageAggregate.fromSnapshot(snapshot);
const recentEvents = await eventStore.loadEventsSince(wpId, snapshot.version);
aggregate.replayEvents(recentEvents);
```

---

**Document Status**: Implementation Phase  
**Last Updated**: October 2025  
**Next Steps**: Begin Phase 1 implementation

