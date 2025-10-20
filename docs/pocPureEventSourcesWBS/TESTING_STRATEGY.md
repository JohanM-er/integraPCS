# Testing Strategy - Work Package ETC System

**Version**: 1.0  
**Date**: October 2025  
**Status**: Design Phase

---

## Table of Contents
1. [Testing Philosophy](#1-testing-philosophy)
2. [Unit Tests](#2-unit-tests)
3. [Integration Tests](#3-integration-tests)
4. [E2E Tests](#4-e2e-tests)
5. [Performance Tests](#5-performance-tests)
6. [Test Data Strategy](#6-test-data-strategy)
7. [CI/CD Integration](#7-cicd-integration)

---

## 1. Testing Philosophy

### 1.1 Testing Pyramid

```
                    ▲
                   / \
                  /   \
                 /  E2E \ ←── 10% (Critical user flows)
                /_______\
               /         \
              / Integration \ ←── 30% (Event store, projections)
             /_____________\
            /               \
           /   Unit Tests    \ ←── 60% (Domain logic, aggregates)
          /_________________\
```

### 1.2 Test Coverage Goals

| Layer | Target Coverage | Priority |
|-------|----------------|----------|
| **Domain Logic** (Aggregates, Entities) | 95% | High |
| **Command Handlers** | 90% | High |
| **Event Store** | 85% | High |
| **Projections** | 80% | Medium |
| **GraphQL Resolvers** | 70% | Medium |
| **Frontend Components** | 60% | Low (POC) |

### 1.3 Testing Principles

1. **Test Behavior, Not Implementation**: Focus on inputs/outputs, not internal state
2. **Event Sourcing Advantages**: Easy to test—just replay events and verify state
3. **Fast Feedback**: Unit tests run in <1 second, integration tests in <10 seconds
4. **Isolation**: No cross-test dependencies, parallel execution safe
5. **Deterministic**: Same inputs = same outputs (no flaky tests)

---

## 2. Unit Tests

### 2.1 Domain Logic (Aggregates & Entities)

**File**: `backend/tests/unit/WorkPackageAggregate.test.ts`

```typescript
import { WorkPackageAggregate } from '../../domain/workpackage/WorkPackageAggregate';
import { TaskProgressUpdated, TaskVarianceAlert } from '../../domain/workpackage/events/DomainEvents';

describe('WorkPackageAggregate', () => {
  describe('updateTaskProgress', () => {
    it('should calculate EAC correctly', () => {
      // Given: Work package with task (64h estimate)
      const aggregate = WorkPackageAggregate.create(
        'wp-1',
        'Test WP',
        'desc',
        50000,
        new Date(),
        new Date(),
        'user-1',
        'John'
      );
      
      aggregate.addTask('task-1', 'Test Task', 64, 'standard', 'user-1', 'John');
      aggregate.clearUncommittedEvents(); // Clear creation events
      
      // When: Foreman reports 16h worked, 48h remaining
      aggregate.updateTaskProgress(
        'task-1',
        16, // hoursWorkedToday
        48, // hoursRemainingEstimate
        [],
        'Installed conduits',
        'user-1',
        'John'
      );
      
      // Then: EAC = 16 (spent) + 48 (remaining) = 64h (on-track)
      const events = aggregate.getUncommittedEvents();
      const progressEvent = events.find(e => e.type === 'TaskProgressUpdated') as TaskProgressUpdated;
      
      expect(progressEvent).toBeDefined();
      expect(progressEvent.cumulativeHoursSpent).toBe(16);
      expect(progressEvent.hoursRemainingEstimate).toBe(48);
      expect(progressEvent.estimateAtCompletion).toBe(64);
      expect(progressEvent.variance).toBe(0);
      expect(progressEvent.status).toBe('on-track');
    });
    
    it('should generate variance alert when threshold exceeded', () => {
      // Given: Task with 64h estimate, 32h already spent, 48h remaining
      const aggregate = givenTaskWithProgress('task-1', 64, 32, 48);
      
      // When: Foreman reports 16h more worked, 50h remaining
      // EAC will be 48 (32+16) + 50 = 98h (variance: 34h = 53%)
      aggregate.updateTaskProgress(
        'task-1',
        16,
        50,
        [],
        'Progress slower than expected',
        'user-1',
        'John'
      );
      
      // Then: Variance alert generated (threshold: 10%)
      const events = aggregate.getUncommittedEvents();
      const alertEvent = events.find(e => e.type === 'TaskVarianceAlert') as TaskVarianceAlert;
      
      expect(alertEvent).toBeDefined();
      expect(alertEvent.variance).toBe(34);
      expect(alertEvent.variancePercentage).toBeCloseTo(53.1, 1);
      expect(alertEvent.severity).toBe('critical'); // > 20%
    });
    
    it('should throw error if work package not in execution phase', () => {
      // Given: Work package in PLANNING phase
      const aggregate = WorkPackageAggregate.create(
        'wp-1',
        'Test WP',
        'desc',
        50000,
        new Date(),
        new Date(),
        'user-1',
        'John'
      );
      
      aggregate.addTask('task-1', 'Test Task', 64, 'standard', 'user-1', 'John');
      
      // When/Then: Attempting to update progress throws error
      expect(() => {
        aggregate.updateTaskProgress('task-1', 16, 48, [], 'desc', 'user-1', 'John');
      }).toThrow('Work package not in execution phase');
    });
  });
  
  describe('fromHistory (Event Replay)', () => {
    it('should reconstruct aggregate state from events', () => {
      // Given: Event stream
      const events = [
        { type: 'WorkPackageCreated', workPackageId: 'wp-1', name: 'Test', /* ... */ },
        { type: 'TaskAdded', taskId: 'task-1', name: 'Task 1', estimatedHours: 64, /* ... */ },
        { 
          type: 'TaskProgressUpdated', 
          taskId: 'task-1', 
          hoursWorkedToday: 16, 
          cumulativeHoursSpent: 16,
          hoursRemainingEstimate: 48,
          estimateAtCompletion: 64,
          variance: 0,
          /* ... */
        }
      ];
      
      // When: Reconstruct aggregate
      const aggregate = WorkPackageAggregate.fromHistory('wp-1', events);
      
      // Then: State matches events
      expect(aggregate.id).toBe('wp-1');
      expect(aggregate.aggregateVersion).toBe(3); // 3 events applied
      // Task state should reflect progress update
      // (add getter to expose task state in test build)
    });
  });
});

// Helper function
function givenTaskWithProgress(
  taskId: string,
  estimatedHours: number,
  hoursSpent: number,
  hoursRemaining: number
): WorkPackageAggregate {
  const aggregate = WorkPackageAggregate.create('wp-1', 'Test', 'desc', 50000, new Date(), new Date(), 'user-1', 'John');
  aggregate.addTask(taskId, 'Test Task', estimatedHours, 'standard', 'user-1', 'John');
  
  // Apply progress events to reach desired state
  const progressEvent: TaskProgressUpdated = {
    eventId: 'evt-1',
    type: 'TaskProgressUpdated',
    timestamp: new Date(),
    aggregateId: 'wp-1',
    aggregateType: 'WorkPackage',
    taskId,
    hoursWorkedToday: hoursSpent,
    cumulativeHoursSpent: hoursSpent,
    hoursRemainingEstimate: hoursRemaining,
    estimateAtCompletion: hoursSpent + hoursRemaining,
    variance: (hoursSpent + hoursRemaining) - estimatedHours,
    variancePercentage: 0, // Calculate if needed
    status: 'on-track',
    crew: [],
    workDescription: 'Test',
    metadata: { userId: 'user-1', userName: 'John' }
  };
  
  // Use private applyEvent method or expose for testing
  // aggregate['applyEvent'](progressEvent);
  
  return aggregate;
}
```

### 2.2 Task Entity Tests

**File**: `backend/tests/unit/Task.test.ts`

```typescript
import { Task } from '../../domain/workpackage/Task';

describe('Task', () => {
  describe('updateProgress', () => {
    it('should calculate variance percentage correctly', () => {
      const task = new Task('task-1', 'Test Task', 64, 'standard');
      
      const { progressEvent } = task.updateProgress(
        32, // worked today
        50, // remaining
        [],
        'Progress update',
        'user-1',
        'John'
      );
      
      // EAC = 32 + 50 = 82, variance = 82 - 64 = 18, variance% = (18/64)*100 = 28.125%
      expect(progressEvent.estimateAtCompletion).toBe(82);
      expect(progressEvent.variance).toBe(18);
      expect(progressEvent.variancePercentage).toBeCloseTo(28.125, 2);
      expect(progressEvent.status).toBe('over-budget'); // > 15%
    });
    
    it('should include old values for audit trail', () => {
      const task = new Task('task-1', 'Test Task', 64, 'standard');
      
      // First update
      task.updateProgress(16, 48, [], 'Day 1', 'user-1', 'John');
      task.applyProgressUpdate(/* first event */); // Apply to task state
      
      // Second update
      const { progressEvent } = task.updateProgress(16, 50, [], 'Day 2', 'user-1', 'John');
      
      expect(progressEvent.previousValues).toEqual({
        cumulativeHoursSpent: 16,
        hoursRemainingEstimate: 48,
        estimateAtCompletion: 64,
        status: 'on-track'
      });
    });
  });
});
```

### 2.3 Command Handler Tests

**File**: `backend/tests/unit/WorkPackageCommandHandler.test.ts`

```typescript
import { WorkPackageCommandHandler } from '../../application/commandHandlers/WorkPackageCommandHandler';
import { WorkPackageRepository } from '../../infrastructure/eventStore/WorkPackageRepository';

describe('WorkPackageCommandHandler', () => {
  let handler: WorkPackageCommandHandler;
  let mockRepository: jest.Mocked<WorkPackageRepository>;
  
  beforeEach(() => {
    mockRepository = {
      load: jest.fn(),
      save: jest.fn()
    } as any;
    
    handler = new WorkPackageCommandHandler(mockRepository);
  });
  
  it('should load aggregate, execute command, and save', async () => {
    // Given: Mock aggregate
    const mockAggregate = {
      updateTaskProgress: jest.fn(),
      getUncommittedEvents: jest.fn(() => [/* events */]),
      clearUncommittedEvents: jest.fn()
    };
    
    mockRepository.load.mockResolvedValue(mockAggregate as any);
    
    // When: Handle command
    await handler.handleUpdateTaskProgress({
      workPackageId: 'wp-1',
      taskId: 'task-1',
      hoursWorkedToday: 16,
      hoursRemainingEstimate: 48,
      crew: [],
      workDescription: 'Test',
      userId: 'user-1',
      userName: 'John'
    });
    
    // Then: Repository interactions
    expect(mockRepository.load).toHaveBeenCalledWith('wp-1');
    expect(mockAggregate.updateTaskProgress).toHaveBeenCalledWith(
      'task-1',
      16,
      48,
      [],
      'Test',
      'user-1',
      'John'
    );
    expect(mockRepository.save).toHaveBeenCalledWith(mockAggregate);
  });
});
```

---

## 3. Integration Tests

### 3.1 Event Store Tests

**File**: `backend/tests/integration/WorkPackageEventStore.test.ts`

```typescript
import { Driver } from 'neo4j-driver';
import { WorkPackageEventStore } from '../../infrastructure/eventStore/WorkPackageEventStore';
import { WorkPackageCreated } from '../../domain/workpackage/events/DomainEvents';
import { v4 as uuidv4 } from 'uuid';

describe('WorkPackageEventStore (Integration)', () => {
  let driver: Driver;
  let eventStore: WorkPackageEventStore;
  
  beforeAll(async () => {
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'password')
    );
    eventStore = new WorkPackageEventStore(driver);
  });
  
  afterAll(async () => {
    await driver.close();
  });
  
  beforeEach(async () => {
    // Clean test data
    const session = driver.session();
    await session.run('MATCH (n:WorkPackageEvent) DETACH DELETE n');
    await session.run('MATCH (n:Aggregate) DETACH DELETE n');
    await session.close();
  });
  
  it('should append event with version 1 for new aggregate', async () => {
    const event: WorkPackageCreated = {
      eventId: uuidv4(),
      type: 'WorkPackageCreated',
      timestamp: new Date(),
      aggregateId: 'wp-test-1',
      aggregateType: 'WorkPackage',
      workPackageId: 'wp-test-1',
      name: 'Test WP',
      description: 'Test',
      approvedBudget: 50000,
      scheduledStart: new Date(),
      scheduledEnd: new Date(),
      metadata: { userId: 'user-1', userName: 'John' }
    };
    
    const stored = await eventStore.append(event);
    
    expect(stored.aggregateVersion).toBe(1);
    expect(stored.storedAt).toBeInstanceOf(Date);
  });
  
  it('should enforce optimistic concurrency (version increment)', async () => {
    const aggId = 'wp-test-2';
    
    // Append first event
    await eventStore.append(createEvent(aggId, 'WorkPackageCreated'));
    
    // Append second event
    const stored = await eventStore.append(createEvent(aggId, 'TaskAdded'));
    
    expect(stored.aggregateVersion).toBe(2);
  });
  
  it('should load events in version order', async () => {
    const aggId = 'wp-test-3';
    
    // Append 3 events
    await eventStore.append(createEvent(aggId, 'WorkPackageCreated'));
    await eventStore.append(createEvent(aggId, 'TaskAdded'));
    await eventStore.append(createEvent(aggId, 'TaskProgressUpdated'));
    
    // Load events
    const events = await eventStore.loadEvents(aggId);
    
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('WorkPackageCreated');
    expect(events[1].type).toBe('TaskAdded');
    expect(events[2].type).toBe('TaskProgressUpdated');
    expect(events[0].aggregateVersion).toBe(1);
    expect(events[1].aggregateVersion).toBe(2);
    expect(events[2].aggregateVersion).toBe(3);
  });
  
  it('should write to outbox in same transaction', async () => {
    const event = createEvent('wp-test-4', 'WorkPackageCreated');
    
    await eventStore.append(event);
    
    // Verify outbox entry exists
    const session = driver.session();
    const result = await session.run(
      'MATCH (o:OutboxEvent {eventId: $eventId}) RETURN o',
      { eventId: event.eventId }
    );
    await session.close();
    
    expect(result.records).toHaveLength(1);
    const outboxNode = result.records[0].get('o');
    expect(outboxNode.properties.status).toBe('pending');
  });
});

function createEvent(aggregateId: string, type: string): any {
  return {
    eventId: uuidv4(),
    type,
    timestamp: new Date(),
    aggregateId,
    aggregateType: 'WorkPackage',
    metadata: { userId: 'user-1', userName: 'John' }
  };
}
```

### 3.2 Projection Tests

**File**: `backend/tests/integration/WorkPackageProjection.test.ts`

```typescript
describe('WorkPackageProjectionPipeline (Integration)', () => {
  let driver: Driver;
  let pipeline: WorkPackageProjectionPipeline;
  let mockPubSub: any;
  
  beforeAll(async () => {
    driver = neo4j.driver(/* ... */);
    mockPubSub = { publish: jest.fn() };
    pipeline = new WorkPackageProjectionPipeline(driver, mockPubSub);
  });
  
  beforeEach(async () => {
    // Clean projection nodes
    const session = driver.session();
    await session.run('MATCH (n:WorkPackage) DETACH DELETE n');
    await session.run('MATCH (n:Task) DETACH DELETE n');
    await session.close();
  });
  
  it('should create Task projection node on TaskAdded event', async () => {
    const event: TaskAdded = {
      eventId: uuidv4(),
      type: 'TaskAdded',
      timestamp: new Date(),
      aggregateId: 'wp-1',
      aggregateType: 'WorkPackage',
      taskId: 'task-1',
      name: 'Test Task',
      estimatedHours: 64,
      reportingTemplate: 'standard',
      metadata: { userId: 'user-1', userName: 'John' }
    };
    
    await pipeline.dispatch(event);
    
    // Verify Task node created
    const session = driver.session();
    const result = await session.run(
      'MATCH (t:Task {id: $taskId}) RETURN t',
      { taskId: 'task-1' }
    );
    await session.close();
    
    expect(result.records).toHaveLength(1);
    const taskNode = result.records[0].get('t');
    expect(taskNode.properties.name).toBe('Test Task');
    expect(taskNode.properties.originalEstimate).toBe(64);
  });
  
  it('should update Task projection on TaskProgressUpdated event', async () => {
    // Given: Task projection exists
    await seedTaskProjection('task-1', 64);
    
    // When: Progress updated
    const event: TaskProgressUpdated = {
      /* ... */
      taskId: 'task-1',
      cumulativeHoursSpent: 48,
      hoursRemainingEstimate: 50,
      estimateAtCompletion: 98,
      variance: 34,
      variancePercentage: 53.1,
      status: 'over-budget',
      /* ... */
    };
    
    await pipeline.dispatch(event);
    
    // Then: Task node updated
    const session = driver.session();
    const result = await session.run(
      'MATCH (t:Task {id: $taskId}) RETURN t',
      { taskId: 'task-1' }
    );
    await session.close();
    
    const taskNode = result.records[0].get('t');
    expect(taskNode.properties.hoursSpentToDate).toBe(48);
    expect(taskNode.properties.estimateAtCompletion).toBe(98);
    expect(taskNode.properties.progressStatus).toBe('over-budget');
  });
  
  it('should recalculate work package totals after task update', async () => {
    // Given: Work package with 2 tasks
    await seedWorkPackageWithTasks('wp-1', [
      { id: 'task-1', estimate: 64, spent: 32, remaining: 32 },
      { id: 'task-2', estimate: 32, spent: 16, remaining: 16 }
    ]);
    
    // When: Update task-1 progress
    const event: TaskProgressUpdated = {
      /* ... */
      aggregateId: 'wp-1',
      taskId: 'task-1',
      cumulativeHoursSpent: 48,
      hoursRemainingEstimate: 50,
      estimateAtCompletion: 98,
      /* ... */
    };
    
    await pipeline.dispatch(event);
    
    // Then: Work package totals updated
    const session = driver.session();
    const result = await session.run(
      'MATCH (wp:WorkPackage {id: $wpId}) RETURN wp',
      { wpId: 'wp-1' }
    );
    await session.close();
    
    const wpNode = result.records[0].get('wp');
    expect(wpNode.properties.hoursSpentToDate).toBe(64); // 48 + 16
    expect(wpNode.properties.hoursRemainingEstimate).toBe(66); // 50 + 16
    expect(wpNode.properties.estimateAtCompletion).toBe(130); // 64 + 66
  });
  
  it('should publish to GraphQL PubSub', async () => {
    const event: TaskProgressUpdated = { /* ... */ };
    
    await pipeline.dispatch(event);
    
    expect(mockPubSub.publish).toHaveBeenCalledWith(
      'TASK_PROGRESS_UPDATED',
      expect.objectContaining({
        taskProgressUpdated: expect.objectContaining({
          taskId: event.taskId
        })
      })
    );
  });
});
```

---

## 4. E2E Tests

### 4.1 GraphQL E2E Tests (Playwright)

**File**: `frontend/tests/e2e/dailyProgressReport.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Daily Progress Report Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as foreman
    await page.goto('http://localhost:5173/login');
    await page.fill('[name="username"]', 'foreman-carlos');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
  });
  
  test('foreman can submit daily report in <5 minutes', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to work package
    await page.goto('http://localhost:5173/foreman/wp-elec-f3');
    
    // Select task
    await page.click('text=Install conduits and backboxes');
    
    // Fill progress form
    await page.fill('[name="hoursWorkedToday"]', '16');
    await page.fill('[name="hoursRemaining"]', '48');
    await page.fill('[name="workDescription"]', 'Installed conduits in north corridor');
    
    // Submit
    await page.click('button:has-text("Submit Report")');
    
    // Wait for success message
    await expect(page.locator('text=Report submitted successfully')).toBeVisible();
    
    const duration = (Date.now() - startTime) / 1000;
    expect(duration).toBeLessThan(300); // 5 minutes = 300 seconds
  });
  
  test('PM sees real-time variance alert', async ({ page, context }) => {
    // Open PM dashboard in new tab
    const pmPage = await context.newPage();
    await pmPage.goto('http://localhost:5173/pm/dashboard/wp-elec-f3');
    
    // Open foreman form in original tab
    await page.goto('http://localhost:5173/foreman/wp-elec-f3/task-1');
    
    // Foreman submits report with high variance
    await page.fill('[name="hoursWorkedToday"]', '16');
    await page.fill('[name="hoursRemaining"]', '80'); // Way over estimate
    await page.click('button:has-text("Submit Report")');
    
    // PM dashboard should show alert within 1 second
    await expect(pmPage.locator('.variance-alert')).toBeVisible({ timeout: 1000 });
    await expect(pmPage.locator('.variance-alert')).toContainText('Task variance:');
  });
});
```

### 4.2 Event Sourcing E2E Test

**File**: `backend/tests/e2e/eventSourcingFlow.test.ts`

```typescript
describe('Event Sourcing Flow (E2E)', () => {
  it('should persist events and rebuild aggregate from event store', async () => {
    // 1. Create work package via GraphQL
    const createResult = await graphqlRequest(`
      mutation {
        createWorkPackage(input: {
          name: "E2E Test WP"
          approvedBudget: 50000
          scheduledStart: "2025-11-01T00:00:00Z"
          scheduledEnd: "2025-11-30T00:00:00Z"
        }) {
          id
        }
      }
    `);
    
    const wpId = createResult.data.createWorkPackage.id;
    
    // 2. Add task
    await graphqlRequest(`
      mutation {
        addTask(workPackageId: "${wpId}", input: {
          name: "E2E Test Task"
          estimatedHours: 64
        }) {
          id
        }
      }
    `);
    
    // 3. Submit progress 3 times
    for (let i = 0; i < 3; i++) {
      await graphqlRequest(`
        mutation {
          updateTaskProgress(
            workPackageId: "${wpId}"
            taskId: "task-1"
            input: {
              hoursWorkedToday: 16
              hoursRemainingEstimate: ${48 - i * 10}
              crew: []
              workDescription: "Day ${i + 1}"
            }
          ) {
            id
          }
        }
      `);
    }
    
    // 4. Verify event store has all events
    const eventStore = new WorkPackageEventStore(driver);
    const events = await eventStore.loadEvents(wpId);
    
    expect(events).toHaveLength(5); // WorkPackageCreated + TaskAdded + 3x TaskProgressUpdated
    expect(events[0].type).toBe('WorkPackageCreated');
    expect(events[1].type).toBe('TaskAdded');
    expect(events[2].type).toBe('TaskProgressUpdated');
    
    // 5. Rebuild aggregate from events
    const repository = new WorkPackageRepository(eventStore);
    const aggregate = await repository.load(wpId);
    
    expect(aggregate.aggregateVersion).toBe(5);
    // Verify task state matches last progress update
  });
});
```

---

## 5. Performance Tests

### 5.1 Event Store Benchmark

**File**: `backend/tests/performance/eventStoreBenchmark.test.ts`

```typescript
describe('Event Store Performance', () => {
  it('should append 100 events in <1 second', async () => {
    const startTime = Date.now();
    
    for (let i = 0; i < 100; i++) {
      await eventStore.append(createTestEvent(`wp-perf-${i}`, 'WorkPackageCreated'));
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000);
  });
  
  it('should load 100 events in <500ms', async () => {
    // Seed 100 events
    const wpId = 'wp-perf-load';
    for (let i = 0; i < 100; i++) {
      await eventStore.append(createTestEvent(wpId, 'TaskProgressUpdated'));
    }
    
    // Benchmark load
    const startTime = Date.now();
    const events = await eventStore.loadEvents(wpId);
    const duration = Date.now() - startTime;
    
    expect(events).toHaveLength(100);
    expect(duration).toBeLessThan(500);
  });
  
  it('should handle concurrent writes with optimistic locking', async () => {
    const wpId = 'wp-perf-concurrent';
    await eventStore.append(createTestEvent(wpId, 'WorkPackageCreated'));
    
    // Simulate 10 concurrent writes
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        eventStore.append(createTestEvent(wpId, 'TaskProgressUpdated'))
      );
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    // All should succeed (serialized by Neo4j transaction)
    expect(successful).toBe(10);
  });
});
```

---

## 6. Test Data Strategy

### 6.1 Test Fixtures

**File**: `backend/tests/fixtures/workPackageFixtures.ts`

```typescript
export const testWorkPackages = {
  smallWP: {
    id: 'wp-small',
    name: 'Small Work Package',
    tasks: [
      { id: 'task-1', name: 'Task 1', estimatedHours: 32 }
    ]
  },
  
  largeWP: {
    id: 'wp-large',
    name: 'Large Work Package',
    tasks: [
      { id: 'task-1', name: 'Task 1', estimatedHours: 64 },
      { id: 'task-2', name: 'Task 2', estimatedHours: 128 },
      { id: 'task-3', name: 'Task 3', estimatedHours: 96 }
    ]
  },
  
  wpWithVariance: {
    id: 'wp-variance',
    tasks: [
      { 
        id: 'task-over-budget',
        estimatedHours: 64,
        spent: 48,
        remaining: 50,
        eac: 98,
        variance: 34,
        status: 'over-budget'
      }
    ]
  }
};
```

### 6.2 Seed Scripts

**File**: `backend/tests/seedTestData.ts`

```typescript
export async function seedWorkPackageWithProgress(
  wpId: string,
  tasks: Array<{
    taskId: string;
    estimatedHours: number;
    hoursSpent: number;
    hoursRemaining: number;
  }>
): Promise<void> {
  const eventStore = new WorkPackageEventStore(driver);
  
  // 1. Create work package
  await eventStore.append({
    eventId: uuidv4(),
    type: 'WorkPackageCreated',
    aggregateId: wpId,
    /* ... */
  });
  
  // 2. Add tasks
  for (const task of tasks) {
    await eventStore.append({
      eventId: uuidv4(),
      type: 'TaskAdded',
      aggregateId: wpId,
      taskId: task.taskId,
      estimatedHours: task.estimatedHours,
      /* ... */
    });
    
    // 3. Add progress
    await eventStore.append({
      eventId: uuidv4(),
      type: 'TaskProgressUpdated',
      aggregateId: wpId,
      taskId: task.taskId,
      cumulativeHoursSpent: task.hoursSpent,
      hoursRemainingEstimate: task.hoursRemaining,
      estimateAtCompletion: task.hoursSpent + task.hoursRemaining,
      /* ... */
    });
  }
  
  // 4. Process projections
  const events = await eventStore.loadEvents(wpId);
  const pipeline = new WorkPackageProjectionPipeline(driver, mockPubSub);
  for (const event of events) {
    await pipeline.dispatch(event);
  }
}
```

---

## 7. CI/CD Integration

### 7.1 GitHub Actions Workflow

**File**: `.github/workflows/poc-workpackage-tests.yml`

```yaml
name: POC Work Package Tests

on:
  push:
    branches: [ feature/poc-workpackage-etc ]
  pull_request:
    branches: [ main ]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    services:
      neo4j:
        image: neo4j:5
        env:
          NEO4J_AUTH: neo4j/testpassword
        ports:
          - 7687:7687
      
      rabbitmq:
        image: rabbitmq:3.12
        ports:
          - 5672:5672
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Run unit tests
        run: |
          cd backend
          npm run test:unit -- --coverage
      
      - name: Run integration tests
        run: |
          cd backend
          npm run test:integration
        env:
          NEO4J_URI: bolt://localhost:7687
          NEO4J_USER: neo4j
          NEO4J_PASSWORD: testpassword
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: ./backend/coverage

  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Run E2E tests
        run: |
          cd frontend
          npm ci
          npx playwright install
          npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### 7.2 Test Scripts (package.json)

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration --runInBand",
    "test:e2e": "playwright test",
    "test:performance": "jest --testPathPattern=tests/performance",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 8. Test Maintenance

### 8.1 Test Naming Conventions

```typescript
// Pattern: describe(unit) → describe(method) → it(scenario)
describe('WorkPackageAggregate', () => {
  describe('updateTaskProgress', () => {
    it('should calculate EAC correctly when on track', () => {});
    it('should generate variance alert when threshold exceeded', () => {});
    it('should throw error if work package not in execution phase', () => {});
  });
});
```

### 8.2 Test Data Cleanup

```typescript
// Always clean up after tests
afterEach(async () => {
  const session = driver.session();
  await session.run('MATCH (n:WorkPackageEvent) WHERE n.aggregateId STARTS WITH "test-" DETACH DELETE n');
  await session.close();
});
```

---

**Document Status**: Design Phase  
**Last Updated**: October 2025  
**Next Steps**: Implement tests alongside Phase 1 development

