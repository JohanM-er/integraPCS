# Authorization Implementation Phases - POC to Production

**Version**: 1.0  
**Date**: October 2025  
**Status**: Phased Approach

---

## Executive Summary

**Your existing authorization system is excellent** - it has:
- ✅ **Project-level role assignments** (users have different roles per project)
- ✅ **Permission matrix** (configurable role permissions)
- ✅ **Project role configuration** (overrides per project)
- ✅ **Scope hierarchy** (global → project → site)

**POC Strategy**: Build in phases, with architecture designed from Day 1 to accept full functionality.

### 🎯 Important: Reuse Infrastructure, Not Domain Code

**What the existing authorization system provides**:
- ✅ **Reuse auth infrastructure**: `authNService` (JWT), `AuthorizationPolicyService`, User/Role schema
- ✅ **Reuse frontend components**: Login UI, role assignment UI, `useAuth` hooks
- ✅ **Feature requirements spec**: How project-level roles, permission matrix should work
- ✅ **UX/business logic reference**: How role assignment should behave

**The POC will**:
- ✅ **Reuse existing `authNService`** directly for JWT verification (no wrappers)
- ✅ **Reuse existing `AuthorizationPolicyService`** and extend with WorkPackage policies
- ✅ **Reuse User/Role database schema** (same users across cost system and POC)
- ✅ **Build new domain logic**: `WorkPackageAggregate`, ETC events, projections
- ✅ **Match features progressively**: Phase 1 (simple) → Phase 4 (full sophistication)

**Migration Strategy**:
- No backward compatibility needed—refactor existing auth services directly
- Both old cost system and new POC use the same auth infrastructure
- Eventually extract to new project, leaving old cost domain code behind

**See**: [AUTH_AS_EVENT_SOURCED.md](./AUTH_AS_EVENT_SOURCED.md#7-reusing-existing-auth-infrastructure-migration-strategy) for complete reuse strategy.

---

## Table of Contents
1. [Understanding Your Current System](#1-understanding-your-current-system)
2. [Phase 1: MVP Auth (Week 1-4)](#phase-1-mvp-auth-week-1-4)
3. [Phase 2: Project-Level Roles (Week 5-6)](#phase-2-project-level-roles-week-5-6)
4. [Phase 3: Permission Matrix (Week 7-8)](#phase-3-permission-matrix-week-7-8)
5. [Phase 4: Project Configuration (Week 9-10)](#phase-4-project-configuration-week-9-10)
6. [Data Model Design (All Phases)](#data-model-design-all-phases)

---

## 1. Understanding Your Current System

### 1.1 Project-Level Role Assignment (Key Feature!)

```cypher
// Users have different roles in different projects
(user:User {id: 'user-123'})
  -[:HAS_ROLE {scope: 'project', targetId: 'proj-1'}]->(role:Role {name: 'ProjectManager'})
  
(user:User {id: 'user-123'})
  -[:HAS_ROLE {scope: 'project', targetId: 'proj-2'}]->(role:Role {name: 'Foreman'})
```

**Example**: Sarah is **PM** in Project A, but **Foreman** in Project B
```typescript
userContext.roles = [
  { roleName: 'ProjectManager', scope: 'project', projectId: 'proj-a' },
  { roleName: 'Foreman', scope: 'project', projectId: 'proj-b' }
]
```

### 1.2 Scope Hierarchy

```
global (SuperAdmin, Global PM)
  ↓ can create projects, assign roles globally
project (Project PM, Estimator, Foreman)
  ↓ can manage assigned project only
site (Site Foreman)
  ↓ can manage assigned site only
```

### 1.3 Permission Matrix System

```typescript
// Get permission matrix for all roles
const matrix = await permissionManagementService.getPermissionMatrix(driver);
// Returns:
{
  roles: ['SuperAdmin', 'ProjectManager', 'Foreman', 'Estimator', 'Viewer'],
  resources: [
    {
      type: 'WorkPackage',
      actions: [
        {
          action: 'CREATE',
          permissions: {
            'SuperAdmin': true,
            'ProjectManager': true,
            'Foreman': false,
            'Estimator': true,
            'Viewer': false
          }
        },
        { action: 'UPDATE', permissions: {...} }
      ]
    }
  ]
}
```

### 1.4 Project Role Configuration (Overrides)

```typescript
// Per-project permission overrides
// Example: In Project X, Foremen can also create work packages
const overrides = await getDatabasePermissionOverrides(driver);
// Returns:
{
  projectId: 'proj-x',
  overrides: {
    'Foreman': {
      'WorkPackage': {
        'CREATE': true  // Override: normally false
      }
    }
  }
}
```

---

## 2. Phase 1: MVP Auth (Week 1-4)

**Goal**: Prove event sourcing with minimal auth (just enough to demo)

### 2.1 What to Implement

**Simplified for POC**:
- ✅ JWT authentication (existing `authNService`)
- ✅ **Global roles only** (no project context yet)
- ✅ Simple role check: PM, Foreman, Estimator, Viewer
- ✅ GraphQL `@auth` directive

**What's missing** (intentionally deferred):
- ❌ Project-level role assignments
- ❌ Permission matrix
- ❌ Project overrides

### 2.2 Data Model (Phase 1)

```cypher
// Simplified: Users have ONE global role
(user:User {id: 'user-1', username: 'pm-sarah'})
  -[:HAS_ROLE {scope: 'global'}]->(role:Role {name: 'ProjectManager'})

// Work packages belong to projects (structure ready for Phase 2!)
(wp:WorkPackage {id: 'wp-1', name: 'Electrical Floor 3'})
  -[:BELONGS_TO]->(project:Project {id: 'proj-1', name: 'Office Building'})
```

**Key Design Decision**: Even though we only check global roles in Phase 1, the **data model supports project-level** assignments from Day 1.

### 2.3 Authorization Check (Phase 1)

```typescript
// backend/workPackageContext/api/resolvers/workpackageMutations.ts
export const workpackageMutations = {
  updateTaskProgress: async (_, { workPackageId, taskId, input }, context) => {
    // Phase 1: Simple role check (no project context)
    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    }
    
    // Phase 1: Check if user has PM or Foreman role (globally)
    const userRole = context.user.roles[0]?.roleName;  // Simplified
    const allowedRoles = ['ProjectManager', 'Foreman'];
    
    if (!allowedRoles.includes(userRole)) {
      throw new GraphQLError('Not authorized', {
        extensions: { code: 'FORBIDDEN', requiredRoles: allowedRoles }
      });
    }
    
    // Execute command
    await commandHandler.handleUpdateTaskProgress({ ... });
    
    return await context.dataSources.tasks.findById(taskId);
  }
};
```

### 2.4 GraphQL Schema (Phase 1)

```graphql
directive @auth(requires: [Role!]!) on FIELD_DEFINITION

enum Role {
  PROJECT_MANAGER
  FOREMAN
  ESTIMATOR
  VIEWER
  SUPER_ADMIN
}

type Mutation {
  updateTaskProgress(
    workPackageId: ID!
    taskId: ID!
    input: UpdateTaskProgressInput!
  ): Task! @auth(requires: [PROJECT_MANAGER, FOREMAN])
}
```

### 2.5 Test Users (Phase 1)

```typescript
// Seed data: Simple global roles
const testUsers = [
  { username: 'pm-sarah', role: 'ProjectManager' },
  { username: 'foreman-carlos', role: 'Foreman' },
  { username: 'estimator-john', role: 'Estimator' },
  { username: 'viewer-jane', role: 'Viewer' }
];
```

**Demo Scenario**: All users see all projects (no filtering yet)

---

## 3. Phase 2: Project-Level Roles (Week 5-6)

**Goal**: Users can have different roles in different projects

### 3.1 What to Implement

- ✅ Project-level role assignments (`HAS_ROLE` with `scope: 'project'`)
- ✅ Filter work packages by user's accessible projects
- ✅ Check role in context of specific project
- ✅ Implement patterns inspired by existing system (same data model, similar logic)

### 3.2 Data Model (Phase 2)

```cypher
// Phase 2: Project-scoped roles (your existing pattern!)
(user:User {id: 'user-1', username: 'sarah'})
  -[:HAS_ROLE {scope: 'project', targetId: 'proj-1'}]->(role:Role {name: 'ProjectManager'})

(user:User {id: 'user-1', username: 'sarah'})
  -[:HAS_ROLE {scope: 'project', targetId: 'proj-2'}]->(role:Role {name: 'Foreman'})

// User has access scope to projects
(user:User {id: 'user-1'})
  -[:HAS_ACCESS_SCOPE]->(project:Project {id: 'proj-1'})
```

### 3.3 JWT Token (Phase 2)

```typescript
// Token payload includes all project-role assignments
const token = jwt.sign({
  userId: user.id,
  username: user.username,
  roles: [
    { roleName: 'ProjectManager', scope: 'project', projectId: 'proj-1' },
    { roleName: 'Foreman', scope: 'project', projectId: 'proj-2' }
  ]
}, JWT_SECRET);
```

### 3.4 Authorization Check (Phase 2)

```typescript
export const workpackageMutations = {
  updateTaskProgress: async (_, { workPackageId, taskId, input }, context) => {
    if (!context.user) {
      throw new GraphQLError('Authentication required');
    }
    
    // Phase 2: Get work package's project
    const workPackage = await context.dataSources.workPackages.findById(workPackageId);
    const projectId = workPackage.projectId;
    
    // Phase 2: Check if user has PM or Foreman role IN THIS PROJECT
    const userRoleInProject = context.user.roles.find(
      role => role.projectId === projectId
    );
    
    if (!userRoleInProject) {
      throw new GraphQLError('No access to this project', {
        extensions: { code: 'FORBIDDEN', projectId }
      });
    }
    
    const allowedRoles = ['ProjectManager', 'Foreman'];
    if (!allowedRoles.includes(userRoleInProject.roleName)) {
      throw new GraphQLError('Not authorized', {
        extensions: { 
          code: 'FORBIDDEN',
          userRole: userRoleInProject.roleName,
          requiredRoles: allowedRoles
        }
      });
    }
    
    // Execute command
    await commandHandler.handleUpdateTaskProgress({ ... });
  }
};
```

### 3.5 Query Filtering (Phase 2)

```typescript
export const workpackageQueries = {
  workPackages: async (_, { phase, status }, context) => {
    if (!context.user) {
      throw new GraphQLError('Authentication required');
    }
    
    // Phase 2: Get projects user has access to
    const accessibleProjectIds = context.user.roles
      .filter(role => role.projectId)
      .map(role => role.projectId);
    
    // Filter by accessible projects
    return await context.dataSources.workPackages.findAll({
      phase,
      status,
      projectIds: accessibleProjectIds  // Only return user's projects
    });
  }
};
```

### 3.6 Test Scenario (Phase 2)

```typescript
// Seed data: Project-level roles
await assignProjectRole('proj-1', 'user-sarah', 'ProjectManager');
await assignProjectRole('proj-2', 'user-sarah', 'Foreman');
await assignProjectRole('proj-1', 'user-carlos', 'Foreman');

// Demo:
// - Sarah logs in
// - Sees 2 projects (proj-1, proj-2)
// - In proj-1: Can create WPs, approve, etc. (PM powers)
// - In proj-2: Can only update task progress (Foreman powers)
```

---

## 4. Phase 3: Permission Matrix (Week 7-8)

**Goal**: Configurable role permissions (not hardcoded)

### 4.1 What to Implement

- ✅ `PermissionMatrix` service (your existing pattern)
- ✅ Load permissions from database/config
- ✅ Check matrix instead of hardcoded role lists
- ✅ Admin UI to view/edit matrix (future)

### 4.2 Data Model (Phase 3)

```cypher
// Permission definitions (can be stored in Neo4j or JSON)
(role:Role {name: 'ProjectManager'})
  -[:HAS_PERMISSION {
    resourceType: 'WorkPackage',
    action: 'CREATE',
    granted: true
  }]->(perm:Permission)

(role:Role {name: 'Foreman'})
  -[:HAS_PERMISSION {
    resourceType: 'WorkPackage',
    action: 'UPDATE',
    granted: true,
    conditions: ['assignedToWorkPackage']  // Conditional
  }]->(perm:Permission)
```

### 4.3 Permission Matrix Service (Phase 3)

```typescript
// backend/workPackageContext/application/authorization/PermissionMatrixService.ts
export class PermissionMatrixService {
  /**
   * Check if role has permission for action on resource
   */
  async hasPermission(
    roleName: string,
    resourceType: string,
    action: string,
    context?: { projectId?: string; workPackageId?: string }
  ): Promise<boolean> {
    // Load permission matrix from database
    const matrix = await this.loadPermissionMatrix();
    
    // Check base permission
    const basePermission = matrix[roleName]?.[resourceType]?.[action];
    if (!basePermission) return false;
    
    // Check conditions (e.g., Foreman must be assigned to WP)
    if (basePermission.conditions) {
      return await this.checkConditions(
        basePermission.conditions,
        roleName,
        context
      );
    }
    
    return basePermission.granted;
  }
  
  private async loadPermissionMatrix(): Promise<PermissionMatrix> {
    // Phase 3: Load from Neo4j
    // Phase 4: Apply project-specific overrides
    return cachedMatrix;
  }
}
```

### 4.4 Authorization Check (Phase 3)

```typescript
export const workpackageMutations = {
  updateTaskProgress: async (_, { workPackageId, taskId, input }, context) => {
    if (!context.user) {
      throw new GraphQLError('Authentication required');
    }
    
    // Get user's role in this project
    const workPackage = await context.dataSources.workPackages.findById(workPackageId);
    const userRoleInProject = context.user.roles.find(
      role => role.projectId === workPackage.projectId
    );
    
    if (!userRoleInProject) {
      throw new GraphQLError('No access to this project');
    }
    
    // Phase 3: Check permission matrix (not hardcoded roles!)
    const hasPermission = await context.permissionMatrix.hasPermission(
      userRoleInProject.roleName,
      'WorkPackage',
      'UPDATE',
      { projectId: workPackage.projectId, workPackageId }
    );
    
    if (!hasPermission) {
      throw new GraphQLError('Not authorized');
    }
    
    // Execute command
    await commandHandler.handleUpdateTaskProgress({ ... });
  }
};
```

---

## 5. Phase 4: Project Configuration (Week 9-10)

**Goal**: Per-project permission overrides

### 5.1 What to Implement

- ✅ Project-specific role configuration
- ✅ Override default permissions per project
- ✅ Inherit + override pattern

### 5.2 Data Model (Phase 4)

```cypher
// Project-specific permission overrides
(project:Project {id: 'proj-x', name: 'Special Project'})
  -[:HAS_ROLE_CONFIG]->(config:ProjectRoleConfig {
    roleName: 'Foreman',
    overrides: '{
      "WorkPackage": {
        "CREATE": true,  // Override: normally false for Foremen
        "APPROVE": false
      }
    }'
  })
```

### 5.3 Permission Resolution (Phase 4)

```typescript
export class PermissionMatrixService {
  async hasPermission(
    roleName: string,
    resourceType: string,
    action: string,
    context: { projectId: string }
  ): Promise<boolean> {
    // 1. Load global permission matrix
    const globalMatrix = await this.loadGlobalPermissionMatrix();
    let basePermission = globalMatrix[roleName]?.[resourceType]?.[action];
    
    // 2. Load project-specific overrides
    const projectOverrides = await this.loadProjectOverrides(context.projectId);
    
    // 3. Apply override if exists
    if (projectOverrides[roleName]?.[resourceType]?.[action] !== undefined) {
      basePermission = projectOverrides[roleName][resourceType][action];
    }
    
    return basePermission?.granted || false;
  }
}
```

### 5.4 Example Use Case (Phase 4)

```typescript
// Default: Foremen cannot create work packages
// Global matrix: Foreman → WorkPackage → CREATE = false

// Special Project X: Foremen can create WPs (pilot program)
await setProjectRoleOverride('proj-x', 'Foreman', 'WorkPackage', 'CREATE', true);

// Result:
// - Foreman Carlos in Project A: Cannot create WPs (default)
// - Foreman Carlos in Project X: CAN create WPs (override)
```

---

## 6. Data Model Design (All Phases)

### 6.1 User & Roles (Designed for Full System from Day 1)

```cypher
// Users
(user:User {
  id: 'user-1',
  username: 'sarah',
  email: 'sarah@company.com',
  status: 'active',
  createdAt: datetime()
})

// Roles (global definitions)
(role:Role {
  name: 'ProjectManager',
  description: 'Manages projects, assigns resources',
  createdAt: datetime()
})

// Global role assignment (Phase 1)
(user)-[:HAS_ROLE {
  scope: 'global',
  assignedAt: datetime()
}]->(role)

// Project-scoped role assignment (Phase 2+)
(user)-[:HAS_ROLE {
  scope: 'project',
  targetId: 'proj-1',
  assignedAt: datetime(),
  assignedBy: 'user-admin'
}]->(role)

// Site-scoped role assignment (Phase 2+)
(user)-[:HAS_ROLE {
  scope: 'site',
  targetId: 'site-1',
  assignedAt: datetime()
}]->(role)

// Access scope (Phase 2+)
(user)-[:HAS_ACCESS_SCOPE]->(project:Project {id: 'proj-1'})
```

### 6.2 Work Package with Project Context

```cypher
// Work packages belong to projects (ALL phases)
(wp:WorkPackage {
  id: 'wp-1',
  name: 'Install Electrical System - Floor 3',
  phase: 'execution',
  approvedBudget: 50000,
  createdBy: 'user-1',
  createdAt: datetime()
})

(wp)-[:BELONGS_TO]->(project:Project {
  id: 'proj-1',
  name: 'Office Building Construction',
  clientName: 'ABC Corp'
})

// Tasks within work package
(task:Task {
  id: 'task-1',
  name: 'Install conduits',
  status: 'in-progress'
})

(wp)-[:CONTAINS]->(task)

// Foreman assignment (for conditional permissions in Phase 3)
(user:User {id: 'user-carlos'})-[:ASSIGNED_TO]->(wp)
```

### 6.3 Permission Matrix (Phase 3+)

```cypher
// Global permission definitions
(role:Role {name: 'ProjectManager'})
  -[:HAS_PERMISSION {
    resourceType: 'WorkPackage',
    action: 'CREATE',
    granted: true,
    conditions: []
  }]->(perm:Permission)

(role:Role {name: 'Foreman'})
  -[:HAS_PERMISSION {
    resourceType: 'WorkPackage',
    action: 'UPDATE',
    granted: true,
    conditions: ['assignedToWorkPackage']  // Must be assigned
  }]->(perm:Permission)
```

### 6.4 Project-Specific Overrides (Phase 4)

```cypher
// Project-specific role configuration
(project:Project {id: 'proj-x'})
  -[:HAS_ROLE_CONFIG]->(config:ProjectRoleConfig {
    id: 'config-1',
    roleName: 'Foreman',
    createdAt: datetime(),
    createdBy: 'user-admin'
  })

(config)-[:OVERRIDES_PERMISSION {
  resourceType: 'WorkPackage',
  action: 'CREATE',
  granted: true,  // Override: allow Foremen to create WPs in this project
  reason: 'Pilot program for self-organizing teams'
}]->(perm:Permission)
```

---

## 7. Migration Path Summary

### Phase 1 → Phase 2 (Project-Level Roles)

**Data Migration**:
```cypher
// Convert global roles to project-scoped
MATCH (u:User)-[r:HAS_ROLE {scope: 'global'}]->(role:Role)
MATCH (wp:WorkPackage)-[:BELONGS_TO]->(p:Project)
WHERE (u)-[:CREATED]->(wp) OR (u)-[:ASSIGNED_TO]->(wp)
MERGE (u)-[:HAS_ROLE {
  scope: 'project',
  targetId: p.id,
  assignedAt: r.assignedAt,
  migratedFrom: 'global'
}]->(role)
```

**Code Changes**:
- Update JWT token to include `projectId` in roles
- Add project context to authorization checks
- Filter queries by accessible projects

### Phase 2 → Phase 3 (Permission Matrix)

**Data Migration**:
```cypher
// Create permission nodes from hardcoded role checks
MATCH (r:Role)
UNWIND [
  {type: 'WorkPackage', action: 'CREATE', roles: ['ProjectManager', 'Estimator']},
  {type: 'WorkPackage', action: 'UPDATE', roles: ['ProjectManager', 'Foreman']}
] as perm
WHERE r.name IN perm.roles
CREATE (r)-[:HAS_PERMISSION {
  resourceType: perm.type,
  action: perm.action,
  granted: true
}]->(:Permission)
```

**Code Changes**:
- Replace hardcoded role lists with `PermissionMatrixService`
- Load permissions from database
- Cache permission matrix (LRU with TTL)

### Phase 3 → Phase 4 (Project Overrides)

**No Data Migration**: Just add new `ProjectRoleConfig` nodes as needed

**Code Changes**:
- Add override resolution in `PermissionMatrixService`
- Inherit + override pattern: `global permission → project override`

---

## 8. Summary & Recommendations

### Start with Phase 1 (Week 1-4) ✅

**What to build**:
- Simple JWT auth (global roles only)
- Basic role check in resolvers
- GraphQL `@auth` directive

**Why this works**:
- Proves event sourcing architecture
- Fast to implement
- Good enough for stakeholder demo

**But design for the future**:
- Data model supports project-scoped roles from Day 1
- Work packages have `BELONGS_TO` project relationship
- JWT token structure ready for multiple roles

### Expand to Phase 2 (Week 5-6) 🎯

**When**: After POC approved

**What to add**:
- Project-level role assignments (your existing pattern!)
- Filter queries by accessible projects
- Check role in project context

**Value**: Users can have different roles in different projects (key business requirement)

### Add Phase 3 (Week 7-8) 📊

**When**: After project-level roles proven

**What to add**:
- Permission matrix service
- Load permissions from database (not hardcoded)
- Conditional permissions (e.g., "assigned to work package")

**Value**: Configurable permissions without code changes

### Add Phase 4 (Week 9-10) ⚙️

**When**: After permission matrix stable

**What to add**:
- Project-specific role configuration
- Override default permissions per project
- Admin UI to manage overrides

**Value**: Flexibility for pilot programs, special projects

---

## 9. Key Design Principles

### ✅ DO: Design for Future

**Good**:
```cypher
// Work package has project relationship from Day 1
(wp:WorkPackage)-[:BELONGS_TO]->(project:Project)

// Even if Phase 1 doesn't use it
```

**Why**: Adding relationships later is hard; designing for them is free

### ✅ DO: Progressive Enhancement

**Phase 1**: Simple check
```typescript
if (!['PM', 'Foreman'].includes(userRole)) throw error;
```

**Phase 2**: Project context
```typescript
const roleInProject = user.roles.find(r => r.projectId === wp.projectId);
if (!['PM', 'Foreman'].includes(roleInProject.name)) throw error;
```

**Phase 3**: Permission matrix
```typescript
if (!await permissionMatrix.hasPermission(role, 'WorkPackage', 'UPDATE')) throw error;
```

**Why**: Each phase adds capability without breaking previous phase

### ✅ DO: Preserve Your Good Patterns

Your existing system has excellent patterns—reuse them:
- ✅ `HAS_ROLE` with `scope` and `targetId`
- ✅ `HAS_ACCESS_SCOPE` for project access
- ✅ `PermissionManagementService` interface
- ✅ Policy-based authorization

Don't reinvent—integrate!

---

**Document Status**: Phased Approach  
**Last Updated**: October 2025  
**Recommendation**: Start Phase 1, design for Phase 4

