# API Specification - Work Package ETC System

**Version**: 1.0  
**Date**: October 2025  
**Status**: Design Phase

---

## Table of Contents
1. [GraphQL Schema](#1-graphql-schema)
2. [Queries](#2-queries)
3. [Mutations](#3-mutations)
4. [Subscriptions](#4-subscriptions)
5. [Error Handling](#5-error-handling)
6. [Examples](#6-examples)

---

## 1. GraphQL Schema

### Complete Schema Definition

```graphql
# ============================================
# TYPES
# ============================================

type WorkPackage {
  id: ID!
  name: String!
  description: String
  phase: WorkPackagePhase!
  approvedBudget: Float!
  scheduledStart: DateTime!
  scheduledEnd: DateTime!
  
  # Metrics (rolled up from tasks)
  metrics: WorkPackageMetrics!
  
  # Tasks
  tasks: [Task!]!
  
  # Metadata
  createdAt: DateTime!
  lastUpdated: DateTime!
}

type WorkPackageMetrics {
  originalEstimate: Float!
  hoursSpentToDate: Float!
  hoursRemainingEstimate: Float!
  estimateAtCompletion: Float!
  variance: Float!
  variancePercentage: Float!
  status: ProgressStatus!
  
  # Summary counts
  totalTaskCount: Int!
  completedTaskCount: Int!
  atRiskTaskCount: Int!
  overBudgetTaskCount: Int!
}

type Task {
  id: ID!
  workPackageId: ID!
  name: String!
  status: TaskStatus!
  
  # ETC Metrics
  etcMetrics: ETCMetrics!
  
  # Configuration
  reportingTemplate: ReportingTemplate!
  autoAlertThreshold: Float!
  
  # Latest report info
  lastReportDate: DateTime
  lastReportedBy: String
  lastWorkDescription: String
  
  # Progress history (for trend charts)
  progressHistory(days: Int = 14): [TaskProgressHistory!]!
  
  # Metadata
  createdAt: DateTime!
  lastUpdated: DateTime!
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

type TaskProgressHistory {
  reportDate: DateTime!
  hoursSpentToDate: Float!
  hoursRemainingEstimate: Float!
  estimateAtCompletion: Float!
  variance: Float!
  status: ProgressStatus!
  crewSize: Int!
  totalHoursWorkedToday: Float!
}

type CrewMember {
  workerId: ID!
  name: String!
  hoursWorked: Float!
  role: CrewRole!
}

# ============================================
# ENUMS
# ============================================

enum WorkPackagePhase {
  PLANNING
  APPROVED
  EXECUTION
  COMPLETE
  CANCELLED
}

enum TaskStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETE
  BLOCKED
}

enum ProgressStatus {
  ON_TRACK
  AT_RISK
  OVER_BUDGET
}

enum ReportingTemplate {
  MINIMAL
  STANDARD
  DETAILED
  TIME_ONLY
  MATERIAL_CRITICAL
}

enum CrewRole {
  JOURNEYMAN
  APPRENTICE
  LABORER
}

# ============================================
# INPUTS
# ============================================

input CreateWorkPackageInput {
  name: String!
  description: String
  approvedBudget: Float!
  scheduledStart: DateTime!
  scheduledEnd: DateTime!
}

input AddTaskInput {
  name: String!
  estimatedHours: Float!
  reportingTemplate: ReportingTemplate = STANDARD
}

input UpdateTaskProgressInput {
  hoursWorkedToday: Float!
  hoursRemainingEstimate: Float!
  crew: [CrewMemberInput!]!
  workDescription: String!
}

input CrewMemberInput {
  workerId: ID!
  name: String!
  hoursWorked: Float!
  role: CrewRole!
}

# ============================================
# QUERIES
# ============================================

type Query {
  """
  Get work package by ID with all tasks and metrics
  """
  workPackage(id: ID!): WorkPackage
  
  """
  List all work packages (with pagination)
  """
  workPackages(
    phase: WorkPackagePhase
    status: ProgressStatus
    limit: Int = 30
    offset: Int = 0
  ): WorkPackageConnection!
  
  """
  Get task by ID with ETC metrics and history
  """
  task(id: ID!): Task
  
  """
  List tasks for a work package
  """
  tasks(
    workPackageId: ID!
    status: TaskStatus
    progressStatus: ProgressStatus
  ): [Task!]!
  
  """
  Get tasks requiring attention (at-risk or over-budget)
  """
  tasksRequiringAttention(
    workPackageId: ID!
    severityThreshold: Float = 10.0
  ): [Task!]!
}

type WorkPackageConnection {
  nodes: [WorkPackage!]!
  totalCount: Int!
  hasMore: Boolean!
}

# ============================================
# MUTATIONS
# ============================================

type Mutation {
  """
  Create a new work package
  """
  createWorkPackage(
    input: CreateWorkPackageInput!
  ): WorkPackage!
  
  """
  Add a task to a work package
  """
  addTask(
    workPackageId: ID!
    input: AddTaskInput!
  ): Task!
  
  """
  Update task progress (ETC method)
  """
  updateTaskProgress(
    workPackageId: ID!
    taskId: ID!
    input: UpdateTaskProgressInput!
  ): Task!
  
  """
  Mark task as complete
  """
  completeTask(
    workPackageId: ID!
    taskId: ID!
  ): Task!
  
  """
  Approve work package for execution
  """
  approveWorkPackage(
    workPackageId: ID!
  ): WorkPackage!
}

# ============================================
# SUBSCRIPTIONS
# ============================================

type Subscription {
  """
  Subscribe to task progress updates
  Filter by workPackageId or taskId
  """
  taskProgressUpdated(
    workPackageId: ID
    taskId: ID
  ): TaskProgressUpdatePayload!
  
  """
  Subscribe to variance alerts
  """
  taskVarianceAlert(
    workPackageId: ID
  ): TaskVarianceAlertPayload!
}

type TaskProgressUpdatePayload {
  taskId: ID!
  workPackageId: ID!
  hoursSpentToDate: Float!
  estimateAtCompletion: Float!
  variance: Float!
  status: ProgressStatus!
  timestamp: DateTime!
}

type TaskVarianceAlertPayload {
  taskId: ID!
  workPackageId: ID!
  variance: Float!
  variancePercentage: Float!
  severity: AlertSeverity!
  message: String!
  timestamp: DateTime!
}

enum AlertSeverity {
  WARNING
  CRITICAL
}

# ============================================
# SCALAR TYPES
# ============================================

scalar DateTime
```

---

## 2. Queries

### 2.1 workPackage

**Description**: Fetch a work package with all tasks and metrics

**Arguments**:
- `id: ID!` - Work package ID

**Returns**: `WorkPackage` or `null`

**Example**:
```graphql
query GetWorkPackage($id: ID!) {
  workPackage(id: $id) {
    id
    name
    phase
    metrics {
      originalEstimate
      estimateAtCompletion
      variance
      variancePercentage
      status
      totalTaskCount
      atRiskTaskCount
      overBudgetTaskCount
    }
    tasks {
      id
      name
      status
      etcMetrics {
        hoursSpentToDate
        hoursRemainingEstimate
        estimateAtCompletion
        variance
        variancePercentage
        status
      }
    }
  }
}
```

**Variables**:
```json
{
  "id": "wp-elec-f3"
}
```

**Response**:
```json
{
  "data": {
    "workPackage": {
      "id": "wp-elec-f3",
      "name": "Install Electrical System - Floor 3",
      "phase": "EXECUTION",
      "metrics": {
        "originalEstimate": 320,
        "estimateAtCompletion": 380,
        "variance": 60,
        "variancePercentage": 18.75,
        "status": "OVER_BUDGET",
        "totalTaskCount": 5,
        "atRiskTaskCount": 1,
        "overBudgetTaskCount": 2
      },
      "tasks": [
        {
          "id": "task-conduits",
          "name": "Install conduits and backboxes",
          "status": "IN_PROGRESS",
          "etcMetrics": {
            "hoursSpentToDate": 48,
            "hoursRemainingEstimate": 50,
            "estimateAtCompletion": 98,
            "variance": 34,
            "variancePercentage": 53.1,
            "status": "OVER_BUDGET"
          }
        }
        // ... more tasks
      ]
    }
  }
}
```

### 2.2 workPackages

**Description**: List all work packages with filtering and pagination

**Arguments**:
- `phase: WorkPackagePhase` (optional) - Filter by phase
- `status: ProgressStatus` (optional) - Filter by status
- `limit: Int = 30` - Page size
- `offset: Int = 0` - Pagination offset

**Example**:
```graphql
query ListWorkPackages($phase: WorkPackagePhase, $status: ProgressStatus) {
  workPackages(phase: $phase, status: $status, limit: 10) {
    nodes {
      id
      name
      phase
      metrics {
        status
        variancePercentage
        totalTaskCount
        overBudgetTaskCount
      }
    }
    totalCount
    hasMore
  }
}
```

### 2.3 task

**Description**: Fetch a task with ETC metrics and progress history

**Arguments**:
- `id: ID!` - Task ID

**Example**:
```graphql
query GetTask($id: ID!) {
  task(id: $id) {
    id
    name
    status
    etcMetrics {
      originalEstimate
      hoursSpentToDate
      hoursRemainingEstimate
      estimateAtCompletion
      variance
      variancePercentage
      status
    }
    progressHistory(days: 7) {
      reportDate
      estimateAtCompletion
      variance
      status
    }
    lastReportDate
    lastReportedBy
    lastWorkDescription
  }
}
```

**Use Case**: Display task detail page with ETC trend chart

### 2.4 tasksRequiringAttention

**Description**: Fetch tasks with variance alerts

**Arguments**:
- `workPackageId: ID!`
- `severityThreshold: Float = 10.0` - Variance percentage threshold

**Example**:
```graphql
query GetAlerts($wpId: ID!) {
  tasksRequiringAttention(workPackageId: $wpId, severityThreshold: 10) {
    id
    name
    etcMetrics {
      variance
      variancePercentage
      status
    }
  }
}
```

**Use Case**: PM early warning dashboard

---

## 3. Mutations

### 3.1 createWorkPackage

**Description**: Create a new work package

**Arguments**:
- `input: CreateWorkPackageInput!`

**Example**:
```graphql
mutation CreateWorkPackage($input: CreateWorkPackageInput!) {
  createWorkPackage(input: $input) {
    id
    name
    phase
  }
}
```

**Variables**:
```json
{
  "input": {
    "name": "Install Electrical System - Floor 3",
    "description": "Complete electrical rough-in for floor 3",
    "approvedBudget": 50000,
    "scheduledStart": "2025-11-01T08:00:00Z",
    "scheduledEnd": "2025-11-30T17:00:00Z"
  }
}
```

**Response**:
```json
{
  "data": {
    "createWorkPackage": {
      "id": "wp-abc123",
      "name": "Install Electrical System - Floor 3",
      "phase": "PLANNING"
    }
  }
}
```

### 3.2 addTask

**Description**: Add a task to a work package

**Arguments**:
- `workPackageId: ID!`
- `input: AddTaskInput!`

**Example**:
```graphql
mutation AddTask($wpId: ID!, $input: AddTaskInput!) {
  addTask(workPackageId: $wpId, input: $input) {
    id
    name
    etcMetrics {
      originalEstimate
    }
  }
}
```

**Variables**:
```json
{
  "wpId": "wp-abc123",
  "input": {
    "name": "Install conduits and backboxes",
    "estimatedHours": 64,
    "reportingTemplate": "STANDARD"
  }
}
```

### 3.3 updateTaskProgress

**Description**: Update task progress using ETC method (PRIMARY MUTATION)

**Arguments**:
- `workPackageId: ID!`
- `taskId: ID!`
- `input: UpdateTaskProgressInput!`

**Example**:
```graphql
mutation UpdateTaskProgress(
  $wpId: ID!
  $taskId: ID!
  $input: UpdateTaskProgressInput!
) {
  updateTaskProgress(
    workPackageId: $wpId
    taskId: $taskId
    input: $input
  ) {
    id
    etcMetrics {
      hoursSpentToDate
      hoursRemainingEstimate
      estimateAtCompletion
      variance
      variancePercentage
      status
    }
    lastReportDate
  }
}
```

**Variables**:
```json
{
  "wpId": "wp-abc123",
  "taskId": "task-xyz789",
  "input": {
    "hoursWorkedToday": 16,
    "hoursRemainingEstimate": 50,
    "crew": [
      {
        "workerId": "worker-1",
        "name": "John Smith",
        "hoursWorked": 8,
        "role": "JOURNEYMAN"
      },
      {
        "workerId": "worker-2",
        "name": "Mike Jones",
        "hoursWorked": 8,
        "role": "APPRENTICE"
      }
    ],
    "workDescription": "Installed conduits in north corridor, backboxes in rooms 301-305"
  }
}
```

**Response**:
```json
{
  "data": {
    "updateTaskProgress": {
      "id": "task-xyz789",
      "etcMetrics": {
        "hoursSpentToDate": 48,
        "hoursRemainingEstimate": 50,
        "estimateAtCompletion": 98,
        "variance": 34,
        "variancePercentage": 53.1,
        "status": "OVER_BUDGET"
      },
      "lastReportDate": "2025-10-19T14:30:00Z"
    }
  }
}
```

**Business Logic Trigger**:
- If `variancePercentage > autoAlertThreshold` (default 10%), generates `TaskVarianceAlert` event
- Alert published to subscriptions (`taskVarianceAlert`)
- PM receives real-time notification

### 3.4 completeTask

**Description**: Mark task as complete

**Example**:
```graphql
mutation CompleteTask($wpId: ID!, $taskId: ID!) {
  completeTask(workPackageId: $wpId, taskId: $taskId) {
    id
    status
    etcMetrics {
      hoursSpentToDate
      variance
    }
  }
}
```

### 3.5 approveWorkPackage

**Description**: Approve work package for execution

**Example**:
```graphql
mutation ApproveWorkPackage($wpId: ID!) {
  approveWorkPackage(workPackageId: $wpId) {
    id
    phase
    metrics {
      totalTaskCount
      originalEstimate
    }
  }
}
```

---

## 4. Subscriptions

### 4.1 taskProgressUpdated

**Description**: Real-time task progress updates

**Arguments**:
- `workPackageId: ID` (optional) - Subscribe to all tasks in work package
- `taskId: ID` (optional) - Subscribe to specific task

**Example**:
```graphql
subscription OnTaskProgressUpdated($wpId: ID!) {
  taskProgressUpdated(workPackageId: $wpId) {
    taskId
    workPackageId
    hoursSpentToDate
    estimateAtCompletion
    variance
    status
    timestamp
  }
}
```

**Client Usage** (React + Apollo):
```typescript
import { useSubscription } from '@apollo/client';

function TaskList({ workPackageId }: Props) {
  const { data } = useSubscription(TASK_PROGRESS_UPDATED_SUB, {
    variables: { wpId: workPackageId }
  });
  
  useEffect(() => {
    if (data?.taskProgressUpdated) {
      // Update local state or refetch query
      console.log('Task updated:', data.taskProgressUpdated);
    }
  }, [data]);
  
  return <div>...</div>;
}
```

### 4.2 taskVarianceAlert

**Description**: Real-time variance alerts (early warning system)

**Arguments**:
- `workPackageId: ID` (optional) - Subscribe to alerts for work package

**Example**:
```graphql
subscription OnVarianceAlert($wpId: ID!) {
  taskVarianceAlert(workPackageId: $wpId) {
    taskId
    workPackageId
    variance
    variancePercentage
    severity
    message
    timestamp
  }
}
```

**Client Usage** (PM Dashboard):
```typescript
function VarianceAlerts({ workPackageId }: Props) {
  const { data } = useSubscription(TASK_VARIANCE_ALERT_SUB, {
    variables: { wpId: workPackageId }
  });
  
  useEffect(() => {
    if (data?.taskVarianceAlert) {
      // Show toast notification
      toast.error(data.taskVarianceAlert.message, {
        duration: 10000,
        icon: '🚨'
      });
    }
  }, [data]);
  
  return null; // Just handles notifications
}
```

---

## 5. Error Handling

### 5.1 Error Types

```typescript
enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONCURRENCY_ERROR = 'CONCURRENCY_ERROR',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

### 5.2 Error Format

```json
{
  "errors": [
    {
      "message": "Cannot add tasks after approval",
      "extensions": {
        "code": "BUSINESS_RULE_VIOLATION",
        "details": {
          "workPackageId": "wp-123",
          "currentPhase": "APPROVED"
        }
      }
    }
  ]
}
```

### 5.3 Common Errors

#### Concurrency Error
```json
{
  "errors": [
    {
      "message": "Aggregate version conflict. Please reload and retry.",
      "extensions": {
        "code": "CONCURRENCY_ERROR",
        "details": {
          "expectedVersion": 5,
          "actualVersion": 6
        }
      }
    }
  ]
}
```

**Client Handling**:
```typescript
try {
  await updateTaskProgress({ variables });
} catch (error) {
  if (error.extensions?.code === 'CONCURRENCY_ERROR') {
    // Refetch and retry
    await refetch();
    await updateTaskProgress({ variables });
  }
}
```

#### Business Rule Violation
```json
{
  "errors": [
    {
      "message": "Work package not in execution phase",
      "extensions": {
        "code": "BUSINESS_RULE_VIOLATION",
        "details": {
          "currentPhase": "PLANNING",
          "requiredPhase": "EXECUTION"
        }
      }
    }
  ]
}
```

---

## 6. Examples

### 6.1 Complete Daily Report Flow

```graphql
# Step 1: Query tasks for today
query GetMyTasks {
  tasks(workPackageId: "wp-1", status: IN_PROGRESS) {
    id
    name
    etcMetrics {
      hoursRemainingEstimate
    }
  }
}

# Step 2: Submit progress for each task
mutation SubmitDailyReport {
  task1: updateTaskProgress(
    workPackageId: "wp-1"
    taskId: "task-1"
    input: {
      hoursWorkedToday: 16
      hoursRemainingEstimate: 48
      crew: [{ workerId: "w1", name: "John", hoursWorked: 8, role: JOURNEYMAN }]
      workDescription: "Installed conduits"
    }
  ) {
    id
    etcMetrics { estimateAtCompletion }
  }
  
  task2: updateTaskProgress(
    workPackageId: "wp-1"
    taskId: "task-2"
    input: {
      hoursWorkedToday: 8
      hoursRemainingEstimate: 16
      crew: [{ workerId: "w2", name: "Mike", hoursWorked: 8, role: APPRENTICE }]
      workDescription: "Pulled wire"
    }
  ) {
    id
    etcMetrics { estimateAtCompletion }
  }
}
```

### 6.2 PM Dashboard Query

```graphql
query PMEarlyWarningDashboard($wpId: ID!) {
  workPackage(id: $wpId) {
    id
    name
    metrics {
      originalEstimate
      estimateAtCompletion
      variance
      variancePercentage
      status
      overBudgetTaskCount
      atRiskTaskCount
    }
  }
  
  alerts: tasksRequiringAttention(workPackageId: $wpId) {
    id
    name
    etcMetrics {
      variance
      variancePercentage
      status
    }
    lastReportDate
    lastReportedBy
  }
}
```

### 6.3 Task Trend Analysis

```graphql
query TaskETCTrend($taskId: ID!) {
  task(id: $taskId) {
    id
    name
    etcMetrics {
      originalEstimate
      estimateAtCompletion
      variance
    }
    progressHistory(days: 14) {
      reportDate
      estimateAtCompletion
      variance
      status
    }
  }
}
```

**Use Case**: Display line chart showing EAC trend over past 14 days

---

## 7. Resolver Implementation

### 7.1 Mutation Resolver Pattern

```typescript
// backend/graphql/resolvers/workpackageMutations.ts
import { WorkPackageCommandHandler } from '../../application/commandHandlers/WorkPackageCommandHandler';
import { GraphQLContext } from '../context';

export const workpackageMutations = (cmdHandler: WorkPackageCommandHandler) => ({
  updateTaskProgress: async (
    _: any,
    { workPackageId, taskId, input }: any,
    ctx: GraphQLContext
  ) => {
    // 1. Authorization
    if (!ctx.user) {
      throw new Error('Unauthorized');
    }
    
    // 2. Execute command (generates and persists events)
    await cmdHandler.handleUpdateTaskProgress({
      workPackageId,
      taskId,
      hoursWorkedToday: input.hoursWorkedToday,
      hoursRemainingEstimate: input.hoursRemainingEstimate,
      crew: input.crew,
      workDescription: input.workDescription,
      userId: ctx.user.id,
      userName: ctx.user.name
    });
    
    // 3. Read from projection (eventual consistency acceptable)
    return await ctx.dataSources.tasks.findById(taskId);
  }
});
```

### 7.2 Query Resolver Pattern

```typescript
// backend/graphql/resolvers/workpackageQueries.ts
export const workpackageQueries = {
  workPackage: async (_: any, { id }: any, ctx: GraphQLContext) => {
    // Read from projection (fast!)
    return await ctx.dataSources.workPackages.findById(id);
  },
  
  tasksRequiringAttention: async (
    _: any,
    { workPackageId, severityThreshold }: any,
    ctx: GraphQLContext
  ) => {
    // Cypher query on projection
    const session = ctx.neo4jDriver.session();
    try {
      const result = await session.run(
        `MATCH (wp:WorkPackage {id: $wpId})-[:CONTAINS]->(t:Task)
         WHERE t.variancePercentage >= $threshold
         RETURN t
         ORDER BY t.variancePercentage DESC`,
        { wpId: workPackageId, threshold: severityThreshold }
      );
      
      return result.records.map(r => mapNodeToTask(r.get('t')));
    } finally {
      await session.close();
    }
  }
};
```

---

**Document Status**: Design Phase  
**Last Updated**: October 2025  
**Next Steps**: Implement resolvers in Phase 2

