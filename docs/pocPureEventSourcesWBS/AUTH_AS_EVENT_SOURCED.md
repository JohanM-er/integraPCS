# Should Authorization Be Event-Sourced?

**Version**: 1.0  
**Date**: October 2025  
**Status**: Architectural Decision

---

## Table of Contents
1. [The Question](#1-the-question)
2. [Pure Event Sourcing Approach](#2-pure-event-sourcing-approach)
3. [Traditional CRUD Approach](#3-traditional-crud-approach)
4. [Hybrid Approach (Recommended)](#4-hybrid-approach-recommended)
5. [Industry Patterns](#5-industry-patterns)
6. [Recommendation for POC](#6-recommendation-for-poc)
7. [Reusing Existing Auth Infrastructure (Migration Strategy)](#7-reusing-existing-auth-infrastructure-migration-strategy)
8. [Summary](#8-summary)

---

## 1. The Question

Should the **authorization system itself** (users, roles, permissions, role assignments) be event-sourced, or is traditional CRUD sufficient?

### Context

**Work Package system is event-sourced**:
```
Command: UpdateTaskProgress
  ↓
Event: TaskProgressUpdated
  ↓
Event Store (append-only)
  ↓
Projection (current state)
```

**But what about authorization?**:
```
Command: AssignRoleToUser(userId, projectId, roleName)
  ↓
Event: RoleAssignedToUser ???
  OR
Direct Update: User-[:HAS_ROLE]->Role ???
```

---

## 2. Pure Event Sourcing Approach

### 2.1 What It Looks Like

**Event Stream for User "Sarah"**:
```typescript
[
  { type: 'UserCreated', userId: 'user-1', username: 'sarah', timestamp: '2025-01-01' },
  { type: 'GlobalRoleAssigned', userId: 'user-1', roleName: 'Estimator', timestamp: '2025-01-02' },
  { type: 'ProjectRoleAssigned', userId: 'user-1', projectId: 'proj-1', roleName: 'PM', timestamp: '2025-02-15' },
  { type: 'GlobalRoleRevoked', userId: 'user-1', roleName: 'Estimator', timestamp: '2025-03-10' },
  { type: 'ProjectRoleAssigned', userId: 'user-1', projectId: 'proj-2', roleName: 'Foreman', timestamp: '2025-04-05' }
]

// Current state derived by replaying events
currentState = {
  userId: 'user-1',
  username: 'sarah',
  roles: [
    { roleName: 'PM', scope: 'project', projectId: 'proj-1' },
    { roleName: 'Foreman', scope: 'project', projectId: 'proj-2' }
  ]
}
```

### 2.2 Implementation

```typescript
// backend/authContext/domain/UserAggregate.ts
export class UserAggregate {
  private userId: string;
  private username: string;
  private roles: Map<string, RoleAssignment> = new Map();
  private version: number = 0;
  private uncommittedEvents: DomainEvent[] = [];
  
  // Command
  assignProjectRole(projectId: string, roleName: string, assignedBy: string): void {
    // Validation
    if (this.hasRole(projectId, roleName)) {
      throw new Error('Role already assigned');
    }
    
    // Generate event
    const event: ProjectRoleAssigned = {
      eventId: uuidv4(),
      type: 'ProjectRoleAssigned',
      timestamp: new Date(),
      aggregateId: this.userId,
      aggregateType: 'User',
      userId: this.userId,
      projectId,
      roleName,
      assignedBy,
      metadata: { reason: 'User promoted to PM' }
    };
    
    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }
  
  // Event application
  private applyEvent(event: DomainEvent): void {
    switch (event.type) {
      case 'UserCreated':
        this.userId = event.userId;
        this.username = event.username;
        break;
        
      case 'ProjectRoleAssigned':
        const key = `${event.projectId}:${event.roleName}`;
        this.roles.set(key, {
          roleName: event.roleName,
          scope: 'project',
          projectId: event.projectId,
          assignedAt: event.timestamp,
          assignedBy: event.assignedBy
        });
        break;
        
      case 'ProjectRoleRevoked':
        const revokeKey = `${event.projectId}:${event.roleName}`;
        this.roles.delete(revokeKey);
        break;
    }
    
    this.version++;
  }
  
  // Reconstruct from events
  static fromHistory(userId: string, events: DomainEvent[]): UserAggregate {
    const user = new UserAggregate();
    for (const event of events) {
      user.applyEvent(event);
    }
    return user;
  }
}
```

### 2.3 Authorization Check (Event-Sourced)

```typescript
// On every GraphQL request:
async function authorize(userId: string, action: string, resource: string) {
  // 1. Load user aggregate from event store
  const events = await userEventStore.loadEvents(userId);
  const user = UserAggregate.fromHistory(userId, events);
  
  // 2. Check permissions based on current roles
  const hasPermission = user.hasPermissionFor(action, resource);
  
  if (!hasPermission) {
    throw new GraphQLError('Not authorized');
  }
}
```

### 2.4 Pros of Pure Event Sourcing

#### ✅ Complete Audit Trail
```cypher
// "Show me all role changes for Sarah in the past 6 months"
MATCH (e:UserEvent {userId: 'user-1'})
WHERE e.timestamp > datetime() - duration('P6M')
  AND e.type IN ['ProjectRoleAssigned', 'ProjectRoleRevoked']
RETURN e
ORDER BY e.timestamp
```

**Use case**: Compliance audits, security investigations

#### ✅ Temporal Queries
```typescript
// "What permissions did Sarah have on March 1, 2025?"
const eventsUntilMarch = await userEventStore.loadEventsUntil(
  'user-1', 
  new Date('2025-03-01')
);
const user = UserAggregate.fromHistory('user-1', eventsUntilMarch);
const permissions = user.getPermissions(); // As of March 1
```

**Use case**: "Why did this user have access to X on date Y?"

#### ✅ Debugging Permission Issues
```typescript
// "When did Sarah lose PM access in Project A?"
const events = await userEventStore.loadEvents('user-1');
const revokedEvent = events.find(
  e => e.type === 'ProjectRoleRevoked' 
    && e.projectId === 'proj-a' 
    && e.roleName === 'PM'
);
console.log('Access revoked:', revokedEvent.timestamp, 'by', revokedEvent.revokedBy);
```

**Use case**: User complaints "I used to have access, what happened?"

#### ✅ Consistency with Domain
If your work packages are event-sourced, having users event-sourced feels architecturally consistent.

### 2.5 Cons of Pure Event Sourcing

#### ❌ Performance: Hot Path Problem

**Authorization happens on EVERY request**:
```typescript
// Every GraphQL query/mutation
app.use(async (req, res, next) => {
  // Load user aggregate from events (potentially 1000s of events)
  const events = await userEventStore.loadEvents(req.userId); // 50-200ms
  const user = UserAggregate.fromHistory(req.userId, events); // 10-50ms
  req.user = user;
  next();
});
```

**Problem**: 
- Authorization check happens 1000+ times per day per user
- 60-250ms overhead per request is unacceptable
- Most requests are reads (queries), not writes

**Workaround**: Projection + caching (but then why event source?)

#### ❌ Complexity Without Clear Value

**Scenario**: Check if user has PM role in Project A
```typescript
// Event-sourced (complex)
const events = await userEventStore.loadEvents(userId);
const user = UserAggregate.fromHistory(userId, events);
const hasRole = user.hasProjectRole('proj-a', 'PM');

// vs. CRUD (simple)
const hasRole = await neo4j.run(`
  MATCH (u:User {id: $userId})-[r:HAS_ROLE {scope: 'project', targetId: $projectId}]->(role:Role {name: 'PM'})
  RETURN count(r) > 0
`, { userId, projectId: 'proj-a' });
```

**Question**: Does the complexity justify the benefits for your use case?

#### ❌ Cache Invalidation Complexity

```typescript
// User roles changed - must invalidate caches across all servers
await userEventStore.append({
  type: 'ProjectRoleAssigned',
  userId: 'user-1',
  projectId: 'proj-a',
  roleName: 'PM'
});

// Now invalidate:
// - In-memory cache
// - Redis cache
// - All active JWT tokens (or wait for expiry)
// - All connected WebSocket sessions
```

**Problem**: Distributed cache invalidation is hard

#### ❌ Snapshot Required Anyway

After 10,000 role assignment events, replaying becomes slow. You need snapshots:
```typescript
// Snapshot every 100 events
if (user.version % 100 === 0) {
  await snapshotStore.save({
    userId: user.id,
    version: user.version,
    state: user.toSnapshot()
  });
}

// Load: snapshot + recent events
const snapshot = await snapshotStore.load(userId);
const recentEvents = await userEventStore.loadEventsSince(userId, snapshot.version);
const user = UserAggregate.fromSnapshot(snapshot);
user.replayEvents(recentEvents);
```

**But**: If you're storing current state anyway (snapshot), why not just use CRUD with audit log?

---

## 3. Traditional CRUD Approach

### 3.1 What It Looks Like

**Current State Stored Directly**:
```cypher
// User with roles (state-based)
(user:User {
  id: 'user-1',
  username: 'sarah',
  email: 'sarah@company.com',
  status: 'active',
  createdAt: datetime('2025-01-01'),
  updatedAt: datetime('2025-04-05')
})

(user)-[:HAS_ROLE {
  scope: 'project',
  targetId: 'proj-1',
  assignedAt: datetime('2025-02-15'),
  assignedBy: 'admin-1'
}]->(role:Role {name: 'ProjectManager'})

(user)-[:HAS_ROLE {
  scope: 'project',
  targetId: 'proj-2',
  assignedAt: datetime('2025-04-05'),
  assignedBy: 'admin-2'
}]->(role:Role {name: 'Foreman'})
```

**Separate Audit Log** (optional):
```cypher
(auditLog:AuditLog {
  id: 'audit-123',
  action: 'ROLE_ASSIGNED',
  userId: 'user-1',
  projectId: 'proj-1',
  roleName: 'ProjectManager',
  performedBy: 'admin-1',
  timestamp: datetime('2025-02-15'),
  reason: 'User promoted to PM'
})
```

### 3.2 Implementation

```typescript
// backend/services/userRoleService.ts
export class UserRoleService {
  async assignProjectRole(
    userId: string,
    projectId: string,
    roleName: string,
    assignedBy: string
  ): Promise<void> {
    const session = driver.session();
    
    try {
      await session.executeWrite(async (tx) => {
        // 1. Assign role (direct state update)
        await tx.run(`
          MATCH (u:User {id: $userId})
          MATCH (r:Role {name: $roleName})
          MATCH (p:Project {id: $projectId})
          MERGE (u)-[rel:HAS_ROLE {
            scope: 'project',
            targetId: $projectId
          }]->(r)
          SET rel.assignedAt = datetime(),
              rel.assignedBy = $assignedBy
        `, { userId, projectId, roleName, assignedBy });
        
        // 2. Create audit log entry (optional)
        await tx.run(`
          CREATE (log:AuditLog {
            id: randomUUID(),
            action: 'ROLE_ASSIGNED',
            userId: $userId,
            projectId: $projectId,
            roleName: $roleName,
            performedBy: $assignedBy,
            timestamp: datetime()
          })
        `, { userId, projectId, roleName, assignedBy });
      });
    } finally {
      await session.close();
    }
  }
  
  async hasProjectRole(userId: string, projectId: string, roleName: string): Promise<boolean> {
    const session = driver.session();
    
    try {
      const result = await session.run(`
        MATCH (u:User {id: $userId})-[r:HAS_ROLE {
          scope: 'project',
          targetId: $projectId
        }]->(role:Role {name: $roleName})
        RETURN count(r) > 0 as hasRole
      `, { userId, projectId, roleName });
      
      return result.records[0]?.get('hasRole') || false;
    } finally {
      await session.close();
    }
  }
}
```

### 3.3 Authorization Check (CRUD)

```typescript
// On every GraphQL request:
async function authorize(userId: string, projectId: string, action: string) {
  // Simple, fast query
  const hasRole = await userRoleService.hasProjectRole(
    userId,
    projectId,
    'ProjectManager'
  );
  
  if (!hasRole) {
    throw new GraphQLError('Not authorized');
  }
}
```

### 3.4 Pros of CRUD Approach

#### ✅ Blazing Fast Authorization Checks
```cypher
// 1-5ms query with index
MATCH (u:User {id: $userId})-[r:HAS_ROLE {targetId: $projectId}]->(role)
RETURN role.name
```

No event replay, no aggregation—just direct read.

#### ✅ Simple to Understand
Developers understand CRUD. No need to explain event sourcing, aggregate reconstruction, projections, etc.

#### ✅ Easier to Cache
```typescript
// Cache current user roles (simple key-value)
const cacheKey = `user:${userId}:roles`;
const cachedRoles = await redis.get(cacheKey);

if (cachedRoles) {
  return JSON.parse(cachedRoles);
}

const roles = await loadRolesFromDatabase(userId);
await redis.set(cacheKey, JSON.stringify(roles), 'EX', 3600); // 1 hour TTL
return roles;
```

No complex aggregate reconstruction needed.

#### ✅ Standard Pattern
99% of systems use CRUD for user management. Well-understood, plenty of libraries, existing expertise.

### 3.5 Cons of CRUD Approach

#### ❌ Limited Audit Trail
```cypher
// "When did Sarah get PM access in Project A?"
// Answer: Lost! Only know current state.
MATCH (u:User {id: 'user-1'})-[r:HAS_ROLE {targetId: 'proj-a'}]->(role:Role {name: 'PM'})
RETURN r.assignedAt  // Only have assignment date, not full history
```

**Workaround**: Separate audit log (but then you're duplicating data)

#### ❌ No Temporal Queries
Can't easily answer: "What roles did Sarah have on March 1, 2025?"

**Workaround**: Time-series audit table (but this gets complex)

#### ❌ Architectural Inconsistency
If work packages are event-sourced but users are CRUD, feels inconsistent.

**Counterargument**: Different bounded contexts have different needs

---

## 4. Hybrid Approach (Recommended)

### 4.1 Best of Both Worlds

**Current state for fast reads** + **Events for audit trail**

```cypher
// CURRENT STATE (for authorization checks)
(user:User {id: 'user-1', username: 'sarah'})
  -[:HAS_ROLE {scope: 'project', targetId: 'proj-1'}]->(role:Role {name: 'PM'})

// EVENT STREAM (for audit trail)
(event:UserEvent {
  eventId: 'evt-123',
  type: 'ProjectRoleAssigned',
  userId: 'user-1',
  projectId: 'proj-1',
  roleName: 'PM',
  assignedBy: 'admin-1',
  timestamp: datetime('2025-02-15')
})
```

### 4.2 Implementation

```typescript
// backend/services/userRoleService.ts
export class UserRoleService {
  async assignProjectRole(
    userId: string,
    projectId: string,
    roleName: string,
    assignedBy: string
  ): Promise<void> {
    const session = driver.session();
    
    try {
      await session.executeWrite(async (tx) => {
        // 1. UPDATE CURRENT STATE (for fast reads)
        await tx.run(`
          MATCH (u:User {id: $userId})
          MATCH (r:Role {name: $roleName})
          MERGE (u)-[rel:HAS_ROLE {
            scope: 'project',
            targetId: $projectId
          }]->(r)
          SET rel.assignedAt = datetime(),
              rel.assignedBy = $assignedBy
        `, { userId, projectId, roleName, assignedBy });
        
        // 2. APPEND EVENT (for audit trail)
        await tx.run(`
          CREATE (e:UserEvent {
            eventId: randomUUID(),
            type: 'ProjectRoleAssigned',
            userId: $userId,
            projectId: $projectId,
            roleName: $roleName,
            assignedBy: $assignedBy,
            timestamp: datetime(),
            metadata: $metadata
          })
        `, { 
          userId, 
          projectId, 
          roleName, 
          assignedBy,
          metadata: JSON.stringify({ reason: 'User promoted' })
        });
      });
    } finally {
      await session.close();
    }
  }
  
  // Authorization check (fast CRUD)
  async hasProjectRole(userId: string, projectId: string, roleName: string): Promise<boolean> {
    return await this.checkCurrentState(userId, projectId, roleName);
  }
  
  // Audit queries (use events)
  async getRoleHistory(userId: string, projectId: string): Promise<RoleEvent[]> {
    const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (e:UserEvent {userId: $userId})
        WHERE e.projectId = $projectId
          AND e.type IN ['ProjectRoleAssigned', 'ProjectRoleRevoked']
        RETURN e
        ORDER BY e.timestamp
      `, { userId, projectId });
      
      return result.records.map(r => mapNodeToEvent(r.get('e')));
    } finally {
      await session.close();
    }
  }
}
```

### 4.3 Pros of Hybrid Approach

#### ✅ Fast Authorization Checks
Uses current state (CRUD performance: 1-5ms)

#### ✅ Complete Audit Trail
Events provide full history for compliance/debugging

#### ✅ Temporal Queries Possible
```cypher
// "What roles did Sarah have on March 1?"
// Replay events up to that date
MATCH (e:UserEvent {userId: 'user-1'})
WHERE e.timestamp <= datetime('2025-03-01')
ORDER BY e.timestamp
RETURN e
// Reconstruct state as of March 1
```

#### ✅ Simple to Implement
No complex aggregate reconstruction for hot path (authorization checks)

### 4.4 Cons of Hybrid Approach

#### ⚠️ Dual Write Complexity
Must keep current state and events in sync:
```typescript
await tx.run('UPDATE current state');  // Must succeed
await tx.run('APPEND event');          // Must succeed
// If either fails, must rollback both
```

**Solution**: Use transaction (`session.executeWrite`)

#### ⚠️ Event Store Not Source of Truth
Current state is authoritative for authorization. Events are for audit only.

**Philosophical question**: Is this "true" event sourcing?  
**Pragmatic answer**: Who cares? It solves the problem.

---

## 5. Industry Patterns

### 5.1 What Do Others Do?

#### Auth0, Okta, AWS IAM (CRUD with Audit)
- Current state stored (users, roles, permissions)
- Audit log separate (CloudTrail, activity logs)
- **Not event-sourced**

#### Keycloak (CRUD with Events)
- Current state in database
- Events published for audit/integration
- **Hybrid approach**

#### Event Sourcing Frameworks (e.g., Axon, EventStoreDB)
- Demo projects often event-source users
- **But**: Production systems often use CRUD for auth + event sourcing for domain

### 5.2 Common Wisdom

**Martin Fowler / Greg Young / Vaughn Vernon**:
> "Event source your core domain, not your infrastructure."

**Auth is infrastructure**, not core domain (unless you're building an IAM system).

Your **core domain** is Work Package lifecycle, ETC tracking, variance analysis—event source this!

---

## 6. Recommendation for POC

### 6.1 For POC: **Hybrid Approach** ✅

**Phase 1-2: CRUD with Simple Audit**
```typescript
// Fast authorization (CRUD)
const hasRole = await checkCurrentState(userId, projectId, 'PM');

// Simple audit log (not full event sourcing)
await logRoleChange({
  userId,
  projectId,
  action: 'ASSIGNED',
  roleName: 'PM',
  timestamp: new Date()
});
```

**Phase 3-4: Add Event Stream for Advanced Audit**
```typescript
// Authorization still uses current state (fast)
const hasRole = await checkCurrentState(userId, projectId, 'PM');

// But also append to event stream (for compliance)
await userEventStore.append({
  type: 'ProjectRoleAssigned',
  userId,
  projectId,
  roleName: 'PM',
  timestamp: new Date()
});

// Enables temporal queries for audits
const rolesOnMarch1 = await getRolesAsOf(userId, new Date('2025-03-01'));
```

### 6.2 Decision Matrix

| Requirement | CRUD | Pure Event Sourcing | Hybrid |
|-------------|------|---------------------|--------|
| **Fast auth checks** | ✅ 1-5ms | ❌ 50-250ms (with cache: 1-5ms) | ✅ 1-5ms |
| **Complete audit trail** | ❌ Limited | ✅ Perfect | ✅ Perfect |
| **Temporal queries** | ❌ Hard | ✅ Easy | ✅ Possible |
| **Simple to implement** | ✅ Very | ❌ Complex | ⚠️ Medium |
| **Cache invalidation** | ✅ Simple | ❌ Complex | ✅ Simple |
| **Industry standard** | ✅ Yes | ❌ Rare | ✅ Common |

**Winner for POC**: **Hybrid**

### 6.3 Implementation Phases

#### Phase 1 (Week 1-4): CRUD Only
```typescript
// Just current state
(user)-[:HAS_ROLE]->(role)

// Simple audit log (optional)
await logRoleChange({ action: 'ASSIGNED', ... });
```

**Why**: Prove event sourcing for **work packages** (core domain)

#### Phase 2 (Week 5-6): Add Event Stream
```typescript
// Keep current state for auth
(user)-[:HAS_ROLE]->(role)

// Add event nodes
await tx.run(`
  CREATE (e:UserEvent {
    type: 'ProjectRoleAssigned',
    ...
  })
`);
```

**Why**: Compliance requirements emerge, need full audit

#### Phase 3 (Week 7-8): Temporal Queries
```typescript
// Implement "roles as of date" queries
const roles = await getUserRolesAsOf(userId, date);
```

**Why**: Business requests "show me historical permissions"

---

## 7. Reusing Existing Auth Infrastructure (Migration Strategy)

### 7.1 The Migration Plan

**Your project is migrating to a new architecture**:
1. Build POC alongside existing system
2. Refactor shared infrastructure (auth) to support both
3. Extract everything to new project
4. Remove old cost subsystem code

**Key Insight**: No need for wrappers or backward compatibility—just refactor directly.

---

### 7.2 What to Reuse from Existing System

#### ✅ Reuse: Authentication & Authorization Infrastructure

```typescript
// backend/services/authNService.ts
// ✅ KEEP & USE DIRECTLY - This is infrastructure, not domain-specific
export const authNService = {
  async verifyAccessTokenAndGetUser(token: string): Promise<UserContext> {
    // JWT verification logic
    // Used by both existing system AND POC
  },
  
  async login(username: string, password: string): Promise<Tokens> {
    // Login logic - shared
  }
};
```

```typescript
// backend/services/AuthorizationPolicyService.ts
// ✅ KEEP & REFACTOR AS NEEDED
// This service works for ANY domain (cost, work packages, etc.)
export class AuthorizationPolicyService {
  async authorize(
    userContext: UserContext,
    resourceType: ResourceType,      // 'Task', 'LineItem', 'WorkPackage'
    action: PolicyAction,
    resourceId: string | null,
    resourceDetails: any,
    driver: Driver
  ): Promise<void> {
    // Policy-based authorization
    // Add 'WorkPackage' resource type if needed
  }
}
```

**Why reuse**: These are infrastructure services, not coupled to the cost domain.

#### ✅ Reuse: User/Role Database Schema

```cypher
// ✅ SHARED ACROSS ENTIRE APP
(user:User {id: 'user-1', username: 'sarah', email: '...'})
  -[:HAS_ROLE {scope: 'project', targetId: 'proj-1'}]->(role:Role {name: 'PM'})
  
(user)-[:HAS_ACCESS_SCOPE]->(project:Project {id: 'proj-1'})

// Both cost subsystem AND work package POC use the same users/roles
```

#### ✅ Reuse: Frontend Auth Components

```tsx
// frontend/src/components/auth/LoginForm.tsx
// ✅ KEEP - Works for entire app
export function LoginForm() {
  // Login UI - not specific to cost or work packages
}

// frontend/src/hooks/useAuth.ts
// ✅ KEEP - Provides user context to all features
export function useAuth() {
  // Returns current user, roles, login/logout functions
}
```

#### ❌ Don't Reuse: Domain-Specific Code

```typescript
// ❌ OLD - Cost subsystem (will be removed)
backend/services/lineItemService.ts
backend/socket/handlers/lineItem/
backend/commands/lineItemCommandHandler.ts

// ✅ NEW - Work Package POC
backend/workPackageContext/domain/WorkPackageAggregate.ts
backend/workPackageContext/application/commandHandlers/
backend/workPackageContext/api/resolvers/
```

---

### 7.3 Implementation Strategy (No Wrappers)

#### Example 1: Use AuthorizationPolicyService Directly

```typescript
// backend/workPackageContext/api/resolvers/workPackageMutations.ts
import { AuthorizationPolicyService } from '../../../services/AuthorizationPolicyService';
import { PolicyAction, ResourceType } from '../../../types/auth';

const authService = new AuthorizationPolicyService();

export const workpackageMutations = {
  updateTaskProgress: async (_, { workPackageId, taskId, input }, context) => {
    // 1. Authentication check
    if (!context.isAuthenticated || !context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    }

    // 2. Authorization check - USE EXISTING SERVICE DIRECTLY
    await authService.authorize(
      context.user,
      'WorkPackage' as ResourceType,  // Add to existing enum if needed
      'UPDATE' as PolicyAction,
      workPackageId,
      { taskId },
      context.neo4jDriver
    );

    // 3. Execute command
    await commandHandler.handleUpdateTaskProgress({ 
      workPackageId, 
      taskId, 
      input, 
      userId: context.user.id 
    });

    return await context.dataSources.tasks.findById(taskId);
  }
};
```

**No wrapper needed!** Just use the existing service.

#### Example 2: Extend Existing Service If Needed

```typescript
// backend/services/AuthorizationPolicyService.ts
// ✅ REFACTOR IN PLACE - Add work package policies

import { workPackagePolicies } from '../workPackageContext/policies/workPackagePolicies';

export class AuthorizationPolicyService {
  private policies = new Map<string, PolicyMap>();
  
  constructor() {
    // Load existing policies
    this.loadPolicies('./policies/taskPolicies.json');
    this.loadPolicies('./policies/lineItemPolicies.json');
    
    // ✅ ADD: Work package policies
    this.loadPolicies('./workPackageContext/policies/workPackagePolicies.json');
  }
  
  // ... rest of service unchanged
}
```

**Refactor directly!** No need for backward compatibility wrappers.

#### Example 3: GraphQL Context Setup

```typescript
// backend/workPackageContext/api/context/createGraphQLContext.ts
import { authNService } from '../../../services/authNService';  // ✅ DIRECT IMPORT
import { AuthorizationPolicyService } from '../../../services/AuthorizationPolicyService';
import { getDriver } from '../../../dal/neo4jDriver';

export async function createGraphQLContext(req: Request): Promise<GraphQLContext> {
  const authHeader = req.headers.authorization;
  let userContext: UserContext | null = null;
  let isAuthenticated = false;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      // ✅ USE EXISTING SERVICE DIRECTLY
      userContext = await authNService.verifyAccessTokenAndGetUser(token);
      isAuthenticated = true;
    } catch (error) {
      console.error('[GraphQL Context] Token verification failed:', error);
    }
  }
  
  const driver = await getDriver();
  const authService = new AuthorizationPolicyService();  // ✅ DIRECT USAGE
  
  return {
    user: userContext,
    isAuthenticated,
    authService,
    neo4jDriver: driver,
    requestId: uuidv4()
  };
}
```

---

### 7.4 Migration Timeline

#### Phase 1: Build POC (Week 1-4)
```
✅ Use existing auth infrastructure directly
✅ Add WorkPackage policies to AuthorizationPolicyService
✅ Keep cost subsystem running (Socket.IO)
✅ POC runs on GraphQL alongside existing system
```

#### Phase 2: Validate POC (Week 5-8)
```
✅ Both systems coexist
✅ Same users, same roles, same auth
✅ Cost data in existing system
✅ Work package data in POC
```

#### Phase 3: Extract to New Project (Week 9-12)
```
✅ Create new repository
✅ Copy shared infrastructure (auth, user/role DB)
✅ Copy work package POC code
✅ Copy frontend auth components
❌ Leave behind: Old cost subsystem code
```

#### Phase 4: Remove Old System (Week 13+)
```
❌ Delete backend/services/lineItemService.ts
❌ Delete backend/socket/handlers/lineItem/
❌ Delete frontend/src/features/GridView/components/LineItemsPanel/
✅ Keep: Auth infrastructure, user/role management
```

---

### 7.5 File Structure During Migration

```
backend/
├── services/
│   ├── authNService.ts                    # ✅ SHARED (keep forever)
│   ├── AuthorizationPolicyService.ts      # ✅ SHARED (refactor as needed)
│   └── lineItemService.ts                 # ❌ OLD (delete in Phase 4)
│
├── dal/
│   └── userRoleDAL.ts                     # ✅ SHARED (keep forever)
│
├── socket/
│   └── handlers/lineItem/                 # ❌ OLD (delete in Phase 4)
│
└── workPackageContext/                     # ✅ NEW (extract in Phase 3)
    ├── domain/
    │   └── WorkPackageAggregate.ts
    ├── application/
    │   └── commandHandlers/
    ├── infrastructure/
    │   └── eventStore/
    ├── api/
    │   └── resolvers/
    └── policies/
        └── workPackagePolicies.json       # Added to AuthorizationPolicyService
```

```
frontend/src/
├── components/auth/                        # ✅ SHARED (keep forever)
│   ├── LoginForm.tsx
│   └── RoleAssignmentPanel.tsx
│
├── hooks/
│   └── useAuth.ts                          # ✅ SHARED (keep forever)
│
└── features/
    ├── GridView/                           # ❌ OLD (delete in Phase 4)
    │   └── components/LineItemsPanel/
    │
    └── WorkPackageETC/                     # ✅ NEW (extract in Phase 3)
        ├── components/
        └── hooks/
```

---

### 7.6 What Gets Extracted to New Project

```
new-project/
├── backend/
│   ├── services/
│   │   ├── authNService.ts                # ✅ COPIED from old project
│   │   └── AuthorizationPolicyService.ts  # ✅ COPIED (with WorkPackage policies)
│   │
│   ├── dal/
│   │   └── userRoleDAL.ts                 # ✅ COPIED
│   │
│   └── workPackageContext/                # ✅ COPIED
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       └── api/
│
└── frontend/src/
    ├── components/auth/                   # ✅ COPIED
    ├── hooks/useAuth.ts                   # ✅ COPIED
    └── features/WorkPackageETC/           # ✅ COPIED
```

**Left behind in old project** (eventually deleted):
- `backend/services/lineItemService.ts`
- `backend/socket/handlers/lineItem/`
- `frontend/src/features/GridView/`

---

### 7.7 Key Principles

#### 1. **No Wrappers or Abstraction Layers**
```typescript
// ❌ DON'T DO THIS (unnecessary wrapper)
class WorkPackageAuthService {
  constructor(private policyService: AuthorizationPolicyService) {}
  
  async authorize(...args) {
    return this.policyService.authorize(...args);
  }
}

// ✅ DO THIS (use directly)
import { AuthorizationPolicyService } from '../../../services/AuthorizationPolicyService';
const authService = new AuthorizationPolicyService();
await authService.authorize(user, 'WorkPackage', 'UPDATE', wpId, details, driver);
```

#### 2. **Refactor Existing Code Directly**
```typescript
// backend/services/AuthorizationPolicyService.ts
// ✅ Add WorkPackage resource type directly to existing enum

export type ResourceType = 
  | 'Task' 
  | 'LineItem' 
  | 'Project'
  | 'WorkPackage'  // ✅ ADDED - no backward compatibility issues
  | 'User';
```

#### 3. **Share Infrastructure, Separate Domain**
- ✅ Auth, users, roles → **SHARED** (same code serves both)
- ❌ Aggregates, events, projections → **SEPARATE** (different domains)

---

## 8. Architectural Principles

### 8.1 Bounded Contexts

```
┌──────────────────────────────────┐
│   Work Package Context           │
│   (PURE EVENT SOURCING)          │
│                                  │
│  - WorkPackageAggregate          │
│  - Events: TaskProgressUpdated   │
│  - Reconstruct from events       │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│   User/Auth Context              │
│   (CRUD + AUDIT EVENTS)          │
│                                  │
│  - Current state for auth checks │
│  - Events for audit trail        │
│  - No reconstruction needed      │
└──────────────────────────────────┘
```

**Key insight**: Different contexts have different needs!

### 7.2 Event Sourcing Decision Criteria

**Event source when**:
- ✅ Core business domain (work packages, tasks)
- ✅ Complex state transitions matter (ETC tracking)
- ✅ Temporal queries critical ("what was state on date X?")
- ✅ Audit trail is primary requirement
- ✅ Rebuilding projections is acceptable

**Use CRUD + audit events when**:
- ✅ Infrastructure/supporting domain (auth, config)
- ✅ Hot path performance critical (authorization checks on every request)
- ✅ Can be shared across multiple domains (users serve both cost and work packages)
- ✅ Current state is what matters (not full history reconstruction)

**Reuse existing infrastructure when**:
- ✅ It's domain-agnostic (JWT, user/role schema, `AuthorizationPolicyService`)
- ✅ Both old and new systems can use it
- ✅ You're planning to extract and migrate later (no backward compatibility needed)
- ✅ Can refactor directly without wrappers

---

## 8. Summary

### For POC: **Hybrid Approach + Reuse Existing Auth Infrastructure**

**Authorization (Hot Path)**:
- ✅ **Reuse existing `AuthorizationPolicyService`** (refactor to add WorkPackage policies)
- ✅ **Reuse existing `authNService`** for JWT verification
- ✅ Use CRUD for current state (fast reads: 1-5ms)
- ✅ Cache heavily (Redis, in-memory)

**User/Role Management**:
- ✅ **Reuse existing User/Role database schema**
- ✅ **Reuse existing frontend auth components** (login, role assignment)
- ✅ Same users, same roles across old cost system and new POC

**Audit Trail (Compliance)**:
- ✅ Append events for role changes (hybrid CRUD + events)
- ✅ Enable temporal queries when needed
- ✅ Satisfy compliance requirements

**Work Package Domain (Event-Sourced)**:
- ✅ **New**: `WorkPackageAggregate`, `TaskProgressUpdated` events
- ✅ **New**: ETC projections, variance analysis
- ✅ **New**: GraphQL API (separate from Socket.IO cost system)

**Why**: Reuse infrastructure, innovate on domain. No wrappers—refactor directly.

### Pure Event Sourcing for Auth?

**Use if**:
- Building an IAM system (auth IS your core domain)
- Compliance requires provable reconstruction
- Temporal queries are daily operations (not occasional)

**Skip if**:
- Auth is supporting infrastructure (not core domain)
- Performance matters more than perfect audit
- CRUD + audit log solves 95% of needs

### Your POC: Work Packages are Event-Sourced ✅

Authorization can be CRUD + events (hybrid). This is **architecturally sound** because:
- Different bounded contexts
- Different performance requirements
- Industry-standard pattern

---

## 9. Code Example: Hybrid Implementation

```typescript
// backend/authContext/services/UserRoleService.ts
export class UserRoleService {
  constructor(
    private driver: Driver,
    private eventBus: EventBus  // Publish to audit stream
  ) {}
  
  async assignProjectRole(command: AssignProjectRoleCommand): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.executeWrite(async (tx) => {
        // 1. Update current state (authoritative for auth checks)
        await tx.run(`
          MATCH (u:User {id: $userId})
          MATCH (r:Role {name: $roleName})
          MATCH (p:Project {id: $projectId})
          MERGE (u)-[rel:HAS_ROLE {
            scope: 'project',
            targetId: $projectId
          }]->(r)
          SET rel.assignedAt = datetime(),
              rel.assignedBy = $assignedBy,
              rel.version = COALESCE(rel.version, 0) + 1
          RETURN rel.version as version
        `, command);
        
        // 2. Append event (for audit trail)
        const event: ProjectRoleAssigned = {
          eventId: uuidv4(),
          type: 'ProjectRoleAssigned',
          timestamp: new Date(),
          userId: command.userId,
          projectId: command.projectId,
          roleName: command.roleName,
          assignedBy: command.assignedBy,
          metadata: {
            reason: command.reason,
            requestId: command.requestId
          }
        };
        
        await tx.run(`
          CREATE (e:UserEvent {
            eventId: $eventId,
            type: $type,
            timestamp: datetime($timestamp),
            userId: $userId,
            projectId: $projectId,
            roleName: $roleName,
            assignedBy: $assignedBy,
            metadata: $metadata
          })
        `, {
          eventId: event.eventId,
          type: event.type,
          timestamp: event.timestamp.toISOString(),
          userId: event.userId,
          projectId: event.projectId,
          roleName: event.roleName,
          assignedBy: event.assignedBy,
          metadata: JSON.stringify(event.metadata)
        });
      });
      
      // 3. Publish event for other systems (optional)
      await this.eventBus.publish('user.role.assigned', event);
      
    } finally {
      await session.close();
    }
  }
  
  // Authorization check (uses current state - FAST!)
  async hasProjectRole(
    userId: string,
    projectId: string,
    roleName: string
  ): Promise<boolean> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH (u:User {id: $userId})-[r:HAS_ROLE {
          scope: 'project',
          targetId: $projectId
        }]->(role:Role {name: $roleName})
        RETURN count(r) > 0 as hasRole
      `, { userId, projectId, roleName });
      
      return result.records[0]?.get('hasRole') || false;
    } finally {
      await session.close();
    }
  }
  
  // Audit query (uses events - for compliance)
  async getRoleHistory(userId: string): Promise<RoleEvent[]> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH (e:UserEvent {userId: $userId})
        WHERE e.type IN ['ProjectRoleAssigned', 'ProjectRoleRevoked']
        RETURN e
        ORDER BY e.timestamp DESC
      `, { userId });
      
      return result.records.map(r => this.mapToEvent(r.get('e')));
    } finally {
      await session.close();
    }
  }
  
  // Temporal query (reconstruct roles as of date)
  async getRolesAsOf(userId: string, asOfDate: Date): Promise<RoleAssignment[]> {
    const session = this.driver.session();
    
    try {
      // Get all events up to date
      const result = await session.run(`
        MATCH (e:UserEvent {userId: $userId})
        WHERE e.timestamp <= datetime($asOfDate)
          AND e.type IN ['ProjectRoleAssigned', 'ProjectRoleRevoked']
        RETURN e
        ORDER BY e.timestamp
      `, { userId, asOfDate: asOfDate.toISOString() });
      
      // Replay events to reconstruct state
      const roles = new Map<string, RoleAssignment>();
      
      for (const record of result.records) {
        const event = this.mapToEvent(record.get('e'));
        
        if (event.type === 'ProjectRoleAssigned') {
          const key = `${event.projectId}:${event.roleName}`;
          roles.set(key, {
            projectId: event.projectId,
            roleName: event.roleName,
            assignedAt: event.timestamp
          });
        } else if (event.type === 'ProjectRoleRevoked') {
          const key = `${event.projectId}:${event.roleName}`;
          roles.delete(key);
        }
      }
      
      return Array.from(roles.values());
    } finally {
      await session.close();
    }
  }
}
```

---

**Document Status**: Architectural Decision  
**Last Updated**: October 2025  
**Recommendation**: Hybrid approach (CRUD for auth checks + events for audit)

