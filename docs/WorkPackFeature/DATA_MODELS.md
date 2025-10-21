# Data Models - Work Package ETC System

**Version**: 1.0  
**Date**: October 2025  
**Status**: Design Phase

---

## Table of Contents
1. [Domain Models (Aggregates)](#1-domain-models-aggregates)
2. [Event Schemas](#2-event-schemas)
3. [Command Schemas](#3-command-schemas)
4. [Projection Schemas (Read Models)](#4-projection-schemas-read-models)
5. [Database Schema (Neo4j)](#5-database-schema-neo4j)
6. [GraphQL Types](#6-graphql-types)

---

## 1. Domain Models (Aggregates)

### 1.1 WorkPackageAggregate

```typescript
/**
 * Aggregate Root: Work Package
 * Transaction boundary for all operations on a work package and its tasks.
 */
export class WorkPackageAggregate {
  // ============================================
  // IDENTITY
  // ============================================
  private workPackageId: string;
  private version: number = 0; // Optimistic concurrency control
  
  // ============================================
  // ROOT ENTITY PROPERTIES
  // ============================================
  private name: string;
  private description: string;
  private phase: WorkPackagePhase;
  private approvedBudget: number; // USD
  private scheduledStart: Date;
  private scheduledEnd: Date;
  
  // ============================================
  // OWNED ENTITIES (Task, LineItem)
  // ============================================
  private tasks: Map<string, Task> = new Map();
  
  // ============================================
  // VALUE OBJECTS
  // ============================================
  private metrics: WorkPackageMetrics;
  
  // ============================================
  // EVENT TRACKING
  // ============================================
  private uncommittedEvents: DomainEvent[] = [];
  
  // ============================================
  // GETTERS (Read-only access to state)
  // ============================================
  get id(): string { return this.workPackageId; }
  get aggregateVersion(): number { return this.version; }
  get currentPhase(): WorkPackagePhase { return this.phase; }
  
  // ============================================
  // COMMANDS (Business Logic)
  // ============================================
  
  addTask(cmd: AddTaskCommand): void {
    // Validation
    if (this.phase !== 'planning') {
      throw new DomainError('Cannot add tasks after approval');
    }
    if (this.tasks.has(cmd.taskId)) {
      throw new DomainError('Task already exists');
    }
    
    // Create task entity
    const task = new Task(
      cmd.taskId,
      cmd.name,
      cmd.estimatedHours,
      cmd.reportingTemplate || 'standard'
    );
    
    this.tasks.set(cmd.taskId, task);
    
    // Emit event
    this.addEvent(new TaskAdded({
      workPackageId: this.workPackageId,
      taskId: cmd.taskId,
      name: cmd.name,
      estimatedHours: cmd.estimatedHours,
      reportingTemplate: task.reportingTemplate,
      timestamp: new Date()
    }));
  }
  
  updateTaskProgress(cmd: UpdateTaskProgressCommand): void {
    // Validation
    if (this.phase !== 'execution') {
      throw new DomainError('Work package not in execution phase');
    }
    
    const task = this.tasks.get(cmd.taskId);
    if (!task) {
      throw new DomainError('Task not found');
    }
    
    // Delegate to task entity
    const progressEvent = task.updateProgress(
      cmd.hoursWorkedToday,
      cmd.hoursRemainingEstimate,
      cmd.crew,
      cmd.workDescription
    );
    
    this.addEvent(progressEvent);
    
    // Check if variance alert needed
    if (Math.abs(task.variancePercentage) > task.autoAlertThreshold) {
      this.addEvent(new TaskVarianceAlert({
        workPackageId: this.workPackageId,
        taskId: cmd.taskId,
        variance: task.variance,
        variancePercentage: task.variancePercentage,
        status: task.progressStatus,
        estimateAtCompletion: task.estimateAtCompletion,
        originalEstimate: task.originalEstimate,
        timestamp: new Date()
      }));
    }
  }
  
  // ============================================
  // EVENT APPLICATION (State Mutation)
  // ============================================
  
  private applyEvent(event: DomainEvent): void {
    switch (event.type) {
      case 'WorkPackageCreated':
        this.applyWorkPackageCreated(event as WorkPackageCreated);
        break;
      case 'TaskAdded':
        this.applyTaskAdded(event as TaskAdded);
        break;
      case 'TaskProgressUpdated':
        this.applyTaskProgressUpdated(event as TaskProgressUpdated);
        break;
      case 'WorkPackageApprovedForExecution':
        this.phase = 'approved';
        break;
    }
    
    this.version++;
  }
  
  private applyTaskProgressUpdated(event: TaskProgressUpdated): void {
    const task = this.tasks.get(event.taskId);
    if (task) {
      task.applyProgressUpdate(event);
    }
  }
  
  // ============================================
  // AGGREGATE RECONSTRUCTION
  // ============================================
  
  static fromHistory(wpId: string, events: DomainEvent[]): WorkPackageAggregate {
    const aggregate = new WorkPackageAggregate();
    aggregate.workPackageId = wpId;
    
    for (const event of events) {
      aggregate.applyEvent(event);
    }
    
    return aggregate;
  }
}
```

### 1.2 Task Entity (Within Aggregate)

```typescript
/**
 * Entity: Task
 * Part of WorkPackage aggregate, cannot exist independently.
 */
export class Task {
  // Identity
  readonly taskId: string;
  
  // Properties
  name: string;
  status: TaskStatus;
  
  // ETC Tracking
  readonly originalEstimate: number; // Immutable baseline
  hoursSpentToDate: number = 0;
  hoursRemainingEstimate: number;
  estimateAtCompletion: number;
  variance: number = 0;
  variancePercentage: number = 0;
  progressStatus: ProgressStatus = 'on-track';
  
  // Configuration
  reportingTemplate: ReportingTemplate;
  autoAlertThreshold: number = 10; // Default 10%
  
  // Progress History (value object)
  progressReports: TaskProgressReport[] = [];
  
  // Material tracking (if applicable)
  materials: Map<string, MaterialStatus> = new Map();
  
  constructor(
    taskId: string,
    name: string,
    estimatedHours: number,
    reportingTemplate: ReportingTemplate = 'standard'
  ) {
    this.taskId = taskId;
    this.name = name;
    this.originalEstimate = estimatedHours;
    this.hoursRemainingEstimate = estimatedHours; // Initially, all work remains
    this.estimateAtCompletion = estimatedHours;
    this.status = 'not-started';
    this.reportingTemplate = reportingTemplate;
  }
  
  /**
   * Business logic: Calculate ETC metrics
   */
  updateProgress(
    hoursWorkedToday: number,
    hoursRemainingEstimate: number,
    crew: CrewMember[],
    workDescription: string
  ): TaskProgressUpdated {
    // Calculate cumulative hours
    const cumulativeHoursSpent = this.hoursSpentToDate + hoursWorkedToday;
    
    // Calculate EAC (Estimate at Completion)
    const eac = cumulativeHoursSpent + hoursRemainingEstimate;
    
    // Calculate variance
    const variance = eac - this.originalEstimate;
    const variancePercentage = (variance / this.originalEstimate) * 100;
    
    // Determine status
    let status: ProgressStatus;
    if (variancePercentage <= 5) status = 'on-track';
    else if (variancePercentage <= 15) status = 'at-risk';
    else status = 'over-budget';
    
    // Update status
    if (this.status === 'not-started' && hoursWorkedToday > 0) {
      this.status = 'in-progress';
    }
    
    // Create progress report record
    const report = new TaskProgressReport(
      new Date(),
      hoursWorkedToday,
      hoursRemainingEstimate,
      crew,
      workDescription
    );
    this.progressReports.push(report);
    
    // Generate event
    return new TaskProgressUpdated({
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
      timestamp: new Date()
    });
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
  }
}
```

### 1.3 Value Objects

```typescript
/**
 * Value Object: Crew Member
 */
export class CrewMember {
  constructor(
    readonly workerId: string,
    readonly name: string,
    readonly hoursWorked: number,
    readonly role: 'journeyman' | 'apprentice' | 'laborer'
  ) {}
}

/**
 * Value Object: Task Progress Report
 */
export class TaskProgressReport {
  constructor(
    readonly reportDate: Date,
    readonly hoursWorkedToday: number,
    readonly hoursRemainingEstimate: number,
    readonly crew: CrewMember[],
    readonly workDescription: string
  ) {}
}

/**
 * Value Object: Material Status
 */
export class MaterialStatus {
  constructor(
    readonly lineItemId: string,
    readonly description: string,
    readonly plannedQuantity: number,
    readonly usedToDate: number,
    readonly remainingEstimate: number,
    readonly status: 'ok' | 'low' | 'depleted'
  ) {}
}

/**
 * Value Object: Work Package Metrics
 */
export class WorkPackageMetrics {
  constructor(
    readonly totalOriginalEstimate: number,
    readonly totalHoursSpent: number,
    readonly totalHoursRemaining: number,
    readonly totalEAC: number,
    readonly totalVariance: number,
    readonly overallStatus: ProgressStatus
  ) {}
}
```

### 1.4 Enums & Types

```typescript
export type WorkPackagePhase = 
  | 'planning'      // Initial state, adding tasks
  | 'approved'      // Approved for execution
  | 'execution'     // Work in progress
  | 'complete'      // All tasks finished
  | 'cancelled';    // Cancelled

export type TaskStatus = 
  | 'not-started'
  | 'in-progress'
  | 'complete'
  | 'blocked';

export type ProgressStatus = 
  | 'on-track'      // Variance <= 5%
  | 'at-risk'       // Variance 5-15%
  | 'over-budget';  // Variance > 15%

export type ReportingTemplate = 
  | 'minimal'       // Hours only
  | 'standard'      // Hours + crew + material quick-check
  | 'detailed'      // Hours + crew + detailed material + photos
  | 'time-only'     // Labor tracking only, no materials
  | 'material-critical'; // Detailed per-item consumption
```

---

## 2. Event Schemas

### 2.1 Base Event Interface

```typescript
/**
 * Base Domain Event
 */
export interface DomainEvent {
  // Event identification
  eventId: string;
  type: string;
  timestamp: Date;
  
  // Aggregate identification
  aggregateId: string;       // workPackageId
  aggregateType: 'WorkPackage';
  
  // Metadata
  metadata?: {
    userId: string;
    userName: string;
    correlationId?: string;
    causationId?: string;
  };
}
```

### 2.2 Work Package Events

#### WorkPackageCreated
```typescript
export interface WorkPackageCreated extends DomainEvent {
  type: 'WorkPackageCreated';
  aggregateId: string; // workPackageId
  
  // Payload
  workPackageId: string;
  name: string;
  description: string;
  approvedBudget: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  phase: 'planning';
}
```

#### WorkPackageApprovedForExecution
```typescript
export interface WorkPackageApprovedForExecution extends DomainEvent {
  type: 'WorkPackageApprovedForExecution';
  aggregateId: string; // workPackageId
  
  // Payload
  approvedBy: string;
  approvalDate: Date;
  totalEstimatedHours: number;
  totalTaskCount: number;
}
```

### 2.3 Task Events

#### TaskAdded
```typescript
export interface TaskAdded extends DomainEvent {
  type: 'TaskAdded';
  aggregateId: string; // workPackageId
  
  // Payload
  taskId: string;
  name: string;
  estimatedHours: number;
  reportingTemplate: ReportingTemplate;
  
  // Optional line items (for detailed cost tracking)
  lineItems?: {
    lineItemId: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}
```

#### TaskProgressUpdated
```typescript
export interface TaskProgressUpdated extends DomainEvent {
  type: 'TaskProgressUpdated';
  aggregateId: string; // workPackageId
  
  // Payload
  taskId: string;
  
  // ETC Inputs (NEW values)
  hoursWorkedToday: number;
  cumulativeHoursSpent: number;
  hoursRemainingEstimate: number;
  
  // ETC Calculations (derived)
  estimateAtCompletion: number;
  variance: number;
  variancePercentage: number;
  status: ProgressStatus;
  
  // Context
  crew: {
    workerId: string;
    name: string;
    hoursWorked: number;
    role: 'journeyman' | 'apprentice' | 'laborer';
  }[];
  workDescription: string;
  
  // Audit enrichment (OLD values for audit trail)
  previousValues?: {
    cumulativeHoursSpent: number;
    hoursRemainingEstimate: number;
    estimateAtCompletion: number;
    status: ProgressStatus;
  };
}
```

#### TaskVarianceAlert
```typescript
export interface TaskVarianceAlert extends DomainEvent {
  type: 'TaskVarianceAlert';
  aggregateId: string; // workPackageId
  
  // Payload
  taskId: string;
  variance: number;
  variancePercentage: number;
  status: ProgressStatus;
  estimateAtCompletion: number;
  originalEstimate: number;
  
  // Alert details
  severity: 'warning' | 'critical'; // warning: 10-20%, critical: >20%
  alertMessage: string;
}
```

#### TaskCompleted
```typescript
export interface TaskCompleted extends DomainEvent {
  type: 'TaskCompleted';
  aggregateId: string; // workPackageId
  
  // Payload
  taskId: string;
  completedDate: Date;
  finalHours: number;
  finalVariance: number;
  completedBy: string;
}
```

### 2.4 Material Events (Optional, Post-MVP)

#### MaterialStatusChecked
```typescript
export interface MaterialStatusChecked extends DomainEvent {
  type: 'MaterialStatusChecked';
  aggregateId: string; // workPackageId
  
  // Payload
  taskId: string;
  lineItems: {
    lineItemId: string;
    plannedQuantity: number;
    usedToDate: number;
    remainingEstimate: number;
    status: 'ok' | 'low' | 'depleted';
    needsReorder: boolean;
  }[];
  checkedBy: string;
}
```

### 2.5 Event Metadata Patterns

```typescript
/**
 * Audit Enrichment Pattern
 * Store old + new values for audit trail
 */
export interface AuditEnrichedEvent {
  changesDetailed: {
    [fieldName: string]: {
      old: any;
      new: any;
    };
  };
}

/**
 * Example: TaskProgressUpdated with audit enrichment
 */
const event: TaskProgressUpdated = {
  eventId: 'evt-123',
  type: 'TaskProgressUpdated',
  aggregateId: 'wp-1',
  taskId: 'task-1',
  
  // NEW values (primary)
  hoursWorkedToday: 16,
  cumulativeHoursSpent: 48,
  hoursRemainingEstimate: 50,
  estimateAtCompletion: 98,
  variance: 34,
  status: 'over-budget',
  
  // OLD values (audit trail)
  previousValues: {
    cumulativeHoursSpent: 32,
    hoursRemainingEstimate: 48,
    estimateAtCompletion: 80,
    status: 'at-risk'
  },
  
  // Metadata
  timestamp: new Date(),
  metadata: {
    userId: 'foreman-123',
    userName: 'Carlos Rodriguez'
  }
};
```

---

## 3. Command Schemas

Commands represent user intent to change state.

### 3.1 Work Package Commands

#### CreateWorkPackageCommand
```typescript
export interface CreateWorkPackageCommand {
  workPackageId: string; // Client-generated UUID
  name: string;
  description: string;
  approvedBudget: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  userId: string; // Who is creating
}
```

#### ApproveWorkPackageCommand
```typescript
export interface ApproveWorkPackageCommand {
  workPackageId: string;
  userId: string;
}
```

### 3.2 Task Commands

#### AddTaskCommand
```typescript
export interface AddTaskCommand {
  workPackageId: string;
  taskId: string; // Client-generated UUID
  name: string;
  estimatedHours: number;
  reportingTemplate?: ReportingTemplate;
  userId: string;
}
```

#### UpdateTaskProgressCommand
```typescript
export interface UpdateTaskProgressCommand {
  workPackageId: string;
  taskId: string;
  
  // ETC Inputs
  hoursWorkedToday: number;
  hoursRemainingEstimate: number;
  
  // Context
  crew: {
    workerId: string;
    name: string;
    hoursWorked: number;
    role: 'journeyman' | 'apprentice' | 'laborer';
  }[];
  workDescription: string;
  
  // Metadata
  userId: string;
  userName: string;
}
```

#### CompleteTaskCommand
```typescript
export interface CompleteTaskCommand {
  workPackageId: string;
  taskId: string;
  userId: string;
}
```

---

## 4. Projection Schemas (Read Models)

Projections are denormalized, query-optimized views.

### 4.1 WorkPackageProjection

```typescript
/**
 * Read Model: Work Package
 * Optimized for PM dashboard queries
 */
export interface WorkPackageProjection {
  // Identity
  id: string;
  name: string;
  description: string;
  phase: WorkPackagePhase;
  
  // Financial
  approvedBudget: number;
  
  // Schedule
  scheduledStart: Date;
  scheduledEnd: Date;
  
  // ETC Metrics (rolled up from tasks)
  originalEstimate: number;
  hoursSpentToDate: number;
  hoursRemainingEstimate: number;
  estimateAtCompletion: number;
  variance: number;
  variancePercentage: number;
  status: ProgressStatus;
  
  // Summary counts
  totalTaskCount: number;
  completedTaskCount: number;
  atRiskTaskCount: number;
  overBudgetTaskCount: number;
  
  // Metadata
  createdAt: Date;
  lastUpdated: Date;
  version: number; // Projection version for idempotency
}
```

### 4.2 TaskProjection

```typescript
/**
 * Read Model: Task
 * Optimized for task list and detail queries
 */
export interface TaskProjection {
  // Identity
  id: string;
  workPackageId: string;
  name: string;
  status: TaskStatus;
  
  // ETC Tracking
  originalEstimate: number;
  hoursSpentToDate: number;
  hoursRemainingEstimate: number;
  estimateAtCompletion: number;
  variance: number;
  variancePercentage: number;
  progressStatus: ProgressStatus;
  
  // Configuration
  reportingTemplate: ReportingTemplate;
  autoAlertThreshold: number;
  
  // Latest progress info
  lastReportDate?: Date;
  lastReportedBy?: string;
  lastWorkDescription?: string;
  
  // Metadata
  createdAt: Date;
  lastUpdated: Date;
  version: number;
}
```

### 4.3 TaskProgressHistoryProjection (Time Series)

```typescript
/**
 * Read Model: Task Progress History
 * Optimized for trend charts (ETC over time)
 */
export interface TaskProgressHistoryEntry {
  taskId: string;
  reportDate: Date;
  
  // Snapshot at this point in time
  hoursSpentToDate: number;
  hoursRemainingEstimate: number;
  estimateAtCompletion: number;
  variance: number;
  status: ProgressStatus;
  
  // Crew info
  crewSize: number;
  totalHoursWorkedToday: number;
}
```

---

## 5. Database Schema (Neo4j)

### 5.1 Event Store Nodes

```cypher
// Event node
(:WorkPackageEvent {
  eventId: string UNIQUE,
  eventType: string,
  timestamp: datetime,
  
  // Aggregate identification
  aggregateId: string,
  aggregateType: 'WorkPackage',
  aggregateVersion: integer,
  
  // Event payload (JSON)
  payload: string, // Full event serialized as JSON
  
  // Metadata
  recordedBy: string,
  storedAt: datetime
})

// Aggregate tracking node
(:Aggregate {
  aggregateId: string,
  aggregateType: string,
  currentVersion: integer,
  lastEventAt: datetime
})

// Relationships
(agg:Aggregate)-[:HAS_EVENT {version: integer}]->(evt:WorkPackageEvent)
```

### 5.2 Projection Nodes

```cypher
// Work Package Projection
(:WorkPackage {
  id: string UNIQUE,
  name: string,
  description: string,
  phase: string,
  approvedBudget: float,
  
  // Metrics (denormalized)
  originalEstimate: float,
  hoursSpentToDate: float,
  hoursRemainingEstimate: float,
  estimateAtCompletion: float,
  variance: float,
  variancePercentage: float,
  status: string,
  
  // Counts
  totalTaskCount: integer,
  completedTaskCount: integer,
  atRiskTaskCount: integer,
  overBudgetTaskCount: integer,
  
  // Timestamps
  scheduledStart: datetime,
  scheduledEnd: datetime,
  createdAt: datetime,
  lastUpdated: datetime,
  
  // Versioning
  version: integer
})

// Task Projection
(:Task {
  id: string UNIQUE,
  workPackageId: string,
  name: string,
  status: string,
  
  // ETC Metrics
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
  
  // Latest report info
  lastReportDate: datetime,
  lastReportedBy: string,
  lastWorkDescription: string,
  
  // Timestamps
  createdAt: datetime,
  lastUpdated: datetime,
  
  // Versioning
  version: integer
})

// Task Progress History (time series)
(:TaskProgressHistory {
  id: string UNIQUE,
  taskId: string,
  reportDate: datetime,
  
  // Snapshot
  hoursSpentToDate: float,
  hoursRemainingEstimate: float,
  estimateAtCompletion: float,
  variance: float,
  status: string,
  
  // Crew info
  crewSize: integer,
  totalHoursWorkedToday: float
})

// Relationships
(wp:WorkPackage)-[:CONTAINS]->(t:Task)
(t:Task)-[:HAS_HISTORY]->(h:TaskProgressHistory)
```

### 5.3 Indexes & Constraints

```cypher
// ============================================
// UNIQUE CONSTRAINTS
// ============================================

CREATE CONSTRAINT workpackage_event_id IF NOT EXISTS
FOR (e:WorkPackageEvent) REQUIRE e.eventId IS UNIQUE;

CREATE CONSTRAINT aggregate_composite_key IF NOT EXISTS
FOR (a:Aggregate) REQUIRE (a.aggregateId, a.aggregateType) IS UNIQUE;

CREATE CONSTRAINT workpackage_id IF NOT EXISTS
FOR (wp:WorkPackage) REQUIRE wp.id IS UNIQUE;

CREATE CONSTRAINT task_id IF NOT EXISTS
FOR (t:Task) REQUIRE t.id IS UNIQUE;

// ============================================
// PERFORMANCE INDEXES
// ============================================

// Event store indexes
CREATE INDEX event_aggregate_id IF NOT EXISTS
FOR (e:WorkPackageEvent) ON (e.aggregateId);

CREATE INDEX event_type IF NOT EXISTS
FOR (e:WorkPackageEvent) ON (e.eventType);

CREATE INDEX event_timestamp IF NOT EXISTS
FOR (e:WorkPackageEvent) ON (e.timestamp);

CREATE INDEX event_version IF NOT EXISTS
FOR (e:WorkPackageEvent) ON (e.aggregateId, e.aggregateVersion);

// Projection indexes
CREATE INDEX workpackage_phase IF NOT EXISTS
FOR (wp:WorkPackage) ON (wp.phase);

CREATE INDEX workpackage_status IF NOT EXISTS
FOR (wp:WorkPackage) ON (wp.status);

CREATE INDEX task_workpackage IF NOT EXISTS
FOR (t:Task) ON (t.workPackageId);

CREATE INDEX task_status IF NOT EXISTS
FOR (t:Task) ON (t.progressStatus);

CREATE INDEX task_history_date IF NOT EXISTS
FOR (h:TaskProgressHistory) ON (h.taskId, h.reportDate);
```

### 5.4 Outbox Pattern Nodes

```cypher
(:OutboxEvent {
  id: string UNIQUE,
  eventId: string,
  eventType: string,
  payload: string,
  status: string, // 'pending' | 'published' | 'failed'
  createdAt: datetime,
  publishedAt: datetime,
  attempts: integer,
  lastError: string
})

// Index for polling unpublished events
CREATE INDEX outbox_status IF NOT EXISTS
FOR (o:OutboxEvent) ON (o.status, o.createdAt);
```

---

## 6. GraphQL Types

See [API_SPECIFICATION.md](./API_SPECIFICATION.md) for complete GraphQL schema.

**Summary of key types**:
```graphql
type WorkPackage {
  id: ID!
  name: String!
  phase: WorkPackagePhase!
  metrics: WorkPackageMetrics!
  tasks: [Task!]!
}

type Task {
  id: ID!
  name: String!
  etcMetrics: ETCMetrics!
  progressHistory(days: Int): [TaskProgressHistory!]!
}

type ETCMetrics {
  originalEstimate: Float!
  hoursSpentToDate: Float!
  hoursRemainingEstimate: Float!
  estimateAtCompletion: Float!
  variance: Float!
  variancePercentage: Float!
  status: ProgressStatus!
}

input UpdateTaskProgressInput {
  hoursWorkedToday: Float!
  hoursRemainingEstimate: Float!
  crew: [CrewMemberInput!]!
  workDescription: String!
}
```

---

## 7. Data Flow Diagrams

### 7.1 Command to Event Flow

```
┌──────────────────────────────────────────────────┐
│ GraphQL Mutation: updateTaskProgress            │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Command Handler validates input                  │
│ - User authorized?                               │
│ - Work package in execution phase?               │
│ - Task exists?                                   │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Load aggregate from event store                  │
│ WorkPackageRepository.load(wpId)                 │
│  └─> Query events from Neo4j                     │
│  └─> Replay events to reconstruct state          │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Execute business logic on aggregate              │
│ aggregate.updateTaskProgress(command)            │
│  └─> Calculate EAC, variance                     │
│  └─> Generate TaskProgressUpdated event          │
│  └─> Generate TaskVarianceAlert if needed        │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Save aggregate (persist events)                  │
│ WorkPackageRepository.save(aggregate)            │
│  └─> Append events to Neo4j event store          │
│  └─> Insert into outbox (same transaction)       │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Return success to client                         │
└──────────────────────────────────────────────────┘
```

### 7.2 Event to Projection Flow

```
┌──────────────────────────────────────────────────┐
│ Outbox Publisher polls for unpublished events   │
│ (every 1 second)                                 │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Publish event to RabbitMQ                        │
│ Exchange: workpackage.events                     │
│ Routing key: TaskProgressUpdated                 │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Projection consumer receives event               │
│ Queue: workpackage.projections                   │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Update Task projection (Neo4j)                   │
│ SET hoursSpentToDate = event.cumulativeHoursSpent│
│ SET eac = event.estimateAtCompletion             │
│ ... (update all ETC fields)                      │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Recalculate Work Package totals                  │
│ SUM all task metrics → update WorkPackage node   │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ Publish to GraphQL PubSub                        │
│ Topic: TASK_PROGRESS_UPDATED                     │
│  └─> All subscribed clients receive update       │
└──────────────────────────────────────────────────┘
```

---

**Document Status**: Design Phase  
**Last Updated**: October 2025  
**Next Steps**: Validate with backend team, begin implementation

