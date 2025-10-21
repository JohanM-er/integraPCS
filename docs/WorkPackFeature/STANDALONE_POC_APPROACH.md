# Standalone POC Approach - Separate Project

**Version**: 1.0  
**Date**: October 2025  
**Status**: Alternative Approach

---

## Table of Contents
1. [Two Approaches Compared](#1-two-approaches-compared)
2. [Standalone Project Structure](#2-standalone-project-structure)
3. [Simplified Authorization](#3-simplified-authorization)
4. [Infrastructure Setup](#4-infrastructure-setup)
5. [Migration Path Back to Main Project](#5-migration-path-back-to-main-project)
6. [Recommendation](#6-recommendation)

---

## 1. Two Approaches Compared

### Approach A: POC Within Existing Project (Recommended - Refactor in Place)

```
schedNeoOrg/
├── backend/
│   ├── workPackageContext/        # 🆕 POC domain logic (vertical slice)
│   ├── services/
│   │   ├── authNService.ts         # ✅ REUSED (JWT verification)
│   │   └── AuthorizationPolicyService.ts  # ✅ REUSED (refactored with WP policies)
│   ├── dal/
│   │   └── userRoleDAL.ts         # ✅ REUSED (user/role queries)
│   └── server.graphql.ts          # 🆕 POC GraphQL server
└── frontend/
    ├── src/components/auth/       # ✅ REUSED (login, role assignment UI)
    └── src/features/WorkPackageETC/  # 🆕 POC UI
```

**Pros**:
- ✅ **Reuses existing auth infrastructure** (authNService, AuthorizationPolicyService, User/Role schema)
- ✅ **No wrappers needed** - refactor existing services directly (no backward compatibility constraints)
- ✅ **Shares infrastructure** - Neo4j, RabbitMQ, Redis instances
- ✅ **Same deployment pipeline** - deploy together, extract later
- ✅ **Easier adoption** - both old cost system and new POC coexist
- ✅ **Eventually extracts cleanly** - copy auth + POC, leave old cost code behind

**Cons**:
- ⚠️ Must understand existing authorization system (but you're reusing it, not rebuilding)
- ⚠️ Both systems coexist temporarily (old cost subsystem + new POC)
- ⚠️ Requires discipline to not couple POC domain logic with old cost domain

---

### Approach B: Standalone Separate Project (Greenfield)

```
workpackage-etc-poc/               # 🆕 Completely separate repo
├── backend/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── api/
│   └── server.ts
├── frontend/
│   └── src/
├── docker-compose.yml             # Self-contained infrastructure
└── README.md
```

**Pros**:
- ✅ **Much simpler** - no legacy dependencies
- ✅ **Easier to understand** - greenfield architecture
- ✅ **Faster iteration** - no risk of breaking existing system
- ✅ **Better demo** - can run completely standalone
- ✅ **Cleaner codebase** - only what's needed for POC
- ✅ **Easier onboarding** - new devs learn event sourcing without existing complexity

**Cons**:
- ❌ Must implement own (simpler) authorization
- ❌ Separate infrastructure setup (Neo4j, RabbitMQ)
- ❌ Migration work to integrate back later

---

## 2. Standalone Project Structure

### 2.1 Repository Structure

```
workpackage-etc-poc/
├── README.md
├── docker-compose.yml            # Neo4j + RabbitMQ
├── .env.example
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   │
│   ├── domain/                   # Pure domain logic
│   │   ├── WorkPackageAggregate.ts
│   │   ├── Task.ts
│   │   ├── events/
│   │   │   └── DomainEvents.ts
│   │   └── commands/
│   │       └── Commands.ts
│   │
│   ├── application/              # Use cases
│   │   ├── commandHandlers/
│   │   │   └── WorkPackageCommandHandler.ts
│   │   └── projections/
│   │       └── WorkPackageProjectionPipeline.ts
│   │
│   ├── infrastructure/           # Technical concerns
│   │   ├── persistence/
│   │   │   ├── Neo4jEventStore.ts
│   │   │   └── WorkPackageRepository.ts
│   │   ├── messaging/
│   │   │   └── RabbitMQService.ts
│   │   └── auth/
│   │       └── SimpleAuthService.ts   # 🆕 Simple JWT-only
│   │
│   ├── api/                      # GraphQL interface
│   │   ├── schema.graphql
│   │   ├── resolvers/
│   │   ├── context.ts
│   │   └── directives/
│   │       └── authDirective.ts      # 🆕 Simple role check
│   │
│   ├── server.ts                 # Main entry point
│   └── tests/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   │
│   └── src/
│       ├── components/
│       │   ├── DailyProgressForm/
│       │   └── PMDashboard/
│       ├── hooks/
│       │   └── useWorkPackage.ts
│       ├── graphql/
│       │   ├── queries.ts
│       │   └── mutations.ts
│       ├── lib/
│       │   └── apollo-client.ts
│       └── App.tsx
│
└── docs/                         # POC-specific docs
    ├── GETTING_STARTED.md
    ├── ARCHITECTURE.md
    └── EVENT_SOURCING_GUIDE.md
```

### 2.2 Package.json (Minimal Dependencies)

```json
{
  "name": "workpackage-etc-poc",
  "version": "1.0.0",
  "description": "Event-sourced Work Package ETC POC",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "test": "jest",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  },
  "dependencies": {
    "@apollo/server": "^4.10.0",
    "express": "^4.18.2",
    "neo4j-driver": "^5.15.0",
    "amqplib": "^0.10.3",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "jest": "^29.7.0"
  }
}
```

---

## 3. Simplified Authorization

### 3.1 Simple JWT-Based Auth (No Complex Policies)

**File**: `backend/infrastructure/auth/SimpleAuthService.ts`

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Simplified user model
export interface User {
  id: string;
  username: string;
  hashedPassword: string;
  role: 'pm' | 'foreman' | 'estimator' | 'viewer';  // Simple enum
}

// JWT payload
export interface AuthToken {
  userId: string;
  username: string;
  role: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'poc-secret-change-in-prod';

export class SimpleAuthService {
  /**
   * Login and generate JWT token
   */
  async login(username: string, password: string): Promise<string> {
    // In POC: hardcoded users or simple Neo4j query
    const user = await this.findUserByUsername(username);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }
    
    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    return token;
  }
  
  /**
   * Verify JWT token and extract user
   */
  verifyToken(token: string): AuthToken {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthToken;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
  
  /**
   * Simple role check (no complex policies)
   */
  hasPermission(userRole: string, requiredRoles: string[]): boolean {
    // PM can do everything
    if (userRole === 'pm') return true;
    
    return requiredRoles.includes(userRole);
  }
  
  private async findUserByUsername(username: string): Promise<User | null> {
    // POC: Simple Neo4j query or hardcoded test users
    // Production: Full user management
    return null; // Implement based on needs
  }
}
```

### 3.2 GraphQL Auth Directive (Simple)

**File**: `backend/api/directives/authDirective.ts`

```typescript
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';

/**
 * Simple @auth directive for role-based access
 * Usage: @auth(requires: [PM, FOREMAN])
 */
export function authDirective(directiveName = 'auth') {
  return (schema: any) => mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, directiveName)?.[0];
      
      if (authDirective) {
        const { requires } = authDirective;
        const { resolve = defaultFieldResolver } = fieldConfig;
        
        fieldConfig.resolve = async (source, args, context, info) => {
          // Check if user is authenticated
          if (!context.user) {
            throw new GraphQLError('Authentication required', {
              extensions: { code: 'UNAUTHENTICATED' }
            });
          }
          
          // Check if user has required role
          const userRole = context.user.role.toUpperCase();
          const requiredRoles = requires.map((r: string) => r.toUpperCase());
          
          // PM has access to everything
          if (userRole === 'PM' || requiredRoles.includes(userRole)) {
            return resolve(source, args, context, info);
          }
          
          throw new GraphQLError('Not authorized', {
            extensions: { 
              code: 'FORBIDDEN',
              userRole,
              requiredRoles
            }
          });
        };
      }
      
      return fieldConfig;
    }
  });
}
```

### 3.3 GraphQL Schema with Directives

**File**: `backend/api/schema.graphql`

```graphql
directive @auth(requires: [Role!]!) on FIELD_DEFINITION

enum Role {
  PM
  FOREMAN
  ESTIMATOR
  VIEWER
}

type Mutation {
  # Anyone can login
  login(username: String!, password: String!): AuthPayload!
  
  # Only PM and Estimators can create work packages
  createWorkPackage(input: CreateWorkPackageInput!): WorkPackage! 
    @auth(requires: [PM, ESTIMATOR])
  
  # PM and Foremen can update task progress
  updateTaskProgress(
    workPackageId: ID!
    taskId: ID!
    input: UpdateTaskProgressInput!
  ): Task! 
    @auth(requires: [PM, FOREMAN])
  
  # Only PM can approve
  approveWorkPackage(workPackageId: ID!): WorkPackage! 
    @auth(requires: [PM])
}

type Query {
  # All authenticated users can read
  workPackage(id: ID!): WorkPackage @auth(requires: [PM, FOREMAN, ESTIMATOR, VIEWER])
  workPackages: [WorkPackage!]! @auth(requires: [PM, FOREMAN, ESTIMATOR, VIEWER])
}

type AuthPayload {
  token: String!
  user: User!
}

type User {
  id: ID!
  username: String!
  role: Role!
}
```

### 3.4 Simple Context Factory

**File**: `backend/api/context.ts`

```typescript
import { Request } from 'express';
import { SimpleAuthService } from '../infrastructure/auth/SimpleAuthService';

const authService = new SimpleAuthService();

export async function createContext({ req }: { req: Request }) {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  let user = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      user = authService.verifyToken(token);
    } catch (error) {
      // Invalid token - user remains null, resolvers will check
      console.error('Token verification failed:', error);
    }
  }
  
  return {
    user,
    authService,
    neo4jDriver: global.neo4jDriver,  // Initialized at startup
    requestId: crypto.randomUUID()
  };
}
```

---

## 4. Infrastructure Setup

### 4.1 Docker Compose (Self-Contained)

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5-community
    ports:
      - "7474:7474"  # Browser
      - "7687:7687"  # Bolt
    environment:
      NEO4J_AUTH: neo4j/pocpassword
      NEO4J_PLUGINS: '["apoc"]'
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs

  rabbitmq:
    image: rabbitmq:3.12-management
    ports:
      - "5672:5672"   # AMQP
      - "15672:15672" # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: poc
      RABBITMQ_DEFAULT_PASS: pocpassword
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  neo4j_data:
  neo4j_logs:
  rabbitmq_data:
```

### 4.2 Environment Variables

**File**: `.env.example`

```bash
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=pocpassword

# RabbitMQ
RABBITMQ_URL=amqp://poc:pocpassword@localhost:5672

# JWT
JWT_SECRET=change-this-in-production

# Server
PORT=4000
NODE_ENV=development

# Frontend
VITE_GRAPHQL_URL=http://localhost:4000/graphql
```

### 4.3 Quick Start Script

**File**: `scripts/setup.sh`

```bash
#!/bin/bash

echo "🚀 Setting up Work Package ETC POC..."

# 1. Copy environment file
cp .env.example .env

# 2. Install dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install

echo "📦 Installing frontend dependencies..."
cd ../frontend && npm install

# 3. Start infrastructure
echo "🐳 Starting Docker containers..."
cd ..
docker-compose up -d

# 4. Wait for Neo4j to be ready
echo "⏳ Waiting for Neo4j to start..."
sleep 10

# 5. Initialize database schema
echo "🗄️  Initializing database..."
cd backend && npm run db:init

# 6. Seed test data
echo "🌱 Seeding test data..."
npm run db:seed

echo "✅ Setup complete!"
echo ""
echo "Start the servers:"
echo "  Backend:  cd backend && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Access points:"
echo "  Backend GraphQL: http://localhost:4000/graphql"
echo "  Frontend:        http://localhost:5173"
echo "  Neo4j Browser:   http://localhost:7474"
echo "  RabbitMQ UI:     http://localhost:15672"
```

### 4.4 Test Users Seed Data

**File**: `backend/scripts/seedTestUsers.ts`

```typescript
import bcrypt from 'bcrypt';
import { getDriver } from '../infrastructure/persistence/neo4jDriver';

const testUsers = [
  { 
    username: 'pm-sarah', 
    password: 'password', 
    role: 'pm',
    name: 'Sarah (Project Manager)'
  },
  { 
    username: 'foreman-carlos', 
    password: 'password', 
    role: 'foreman',
    name: 'Carlos (Foreman)'
  },
  { 
    username: 'estimator-john', 
    password: 'password', 
    role: 'estimator',
    name: 'John (Estimator)'
  },
  { 
    username: 'viewer-jane', 
    password: 'password', 
    role: 'viewer',
    name: 'Jane (Viewer)'
  }
];

async function seedUsers() {
  const driver = await getDriver();
  const session = driver.session();
  
  try {
    for (const user of testUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      await session.run(
        `CREATE (u:User {
          id: randomUUID(),
          username: $username,
          hashedPassword: $hashedPassword,
          role: $role,
          name: $name,
          createdAt: datetime()
        })`,
        {
          username: user.username,
          hashedPassword,
          role: user.role,
          name: user.name
        }
      );
    }
    
    console.log('✅ Test users created');
    console.log('Login credentials:');
    testUsers.forEach(u => {
      console.log(`  ${u.username} / password (${u.role})`);
    });
  } finally {
    await session.close();
  }
}

seedUsers().catch(console.error);
```

---

## 5. Migration Path Back to Main Project

**Note**: This section describes migrating the standalone POC **back to the main project** if approved for production. During this migration, you WOULD integrate with the existing `AuthorizationPolicyService`. The standalone POC itself builds authorization independently.

### 5.1 What to Keep from Standalone POC

**Domain Layer (100% portable)**:
```
✅ WorkPackageAggregate.ts
✅ Task.ts
✅ Value objects
✅ Commands
✅ Events
→ Copy directly to main project
```

**Application Layer (95% portable)**:
```
✅ Command handlers
✅ Projection pipeline
✅ Event mapping logic
→ Minor adjustments for authorization
```

**API Layer (80% portable)**:
```
⚠️ GraphQL schema (same)
⚠️ Resolvers (add AuthorizationPolicyService calls)
⚠️ Context factory (integrate with existing auth)
```

### 5.2 Migration Steps

1. **Copy Domain & Application Layers**
   ```bash
   # These are pure business logic, no dependencies
   cp -r workpackage-etc-poc/backend/domain/ \
         schedNeoOrg/backend/workPackageContext/domain/
   
   cp -r workpackage-etc-poc/backend/application/ \
         schedNeoOrg/backend/workPackageContext/application/
   ```

2. **Adapt Authorization**
   ```typescript
   // FROM: Simple directive
   @auth(requires: [PM, FOREMAN])
   
   // TO: AuthorizationPolicyService
   await context.authService.authorize(
     context.user,
     'WorkPackage',
     'UPDATE',
     workPackageId,
     { taskId },
     context.neo4jDriver
   );
   ```

3. **Integrate Infrastructure**
   - Use shared Neo4j driver
   - Use shared RabbitMQ service
   - Replace simple auth with `AuthorizationPolicyService`

4. **Update Context Factory**
   ```typescript
   // FROM: Simple token verification
   user = authService.verifyToken(token);
   
   // TO: Existing auth service
   user = await authNService.verifyAccessTokenAndGetUser(token);
   ```

### 5.3 Effort Estimate

| Component | Standalone | Migration Effort | Notes |
|-----------|------------|------------------|-------|
| **Domain** | ✅ Done | 0 hours | Copy directly |
| **Application** | ✅ Done | 2 hours | Minor auth adjustments |
| **Infrastructure** | ✅ Done | 4 hours | Integrate shared services |
| **API Resolvers** | ✅ Done | 8 hours | Add AuthorizationPolicyService |
| **Context Setup** | ✅ Done | 2 hours | Use existing auth |
| **Testing** | ✅ Done | 4 hours | Update auth mocks |
| **Total** | - | **~20 hours** | ~1 week |

---

## 6. Recommendation

### Choose Your Approach

#### **Approach A (Integrated)** - For Production Migration ✅ RECOMMENDED

**Use if**:
- ✅ Planning to migrate entire system to new architecture
- ✅ Want to reuse existing auth infrastructure (don't rebuild)
- ✅ Can refactor existing services (no backward compatibility constraints)
- ✅ Both old and new systems will coexist temporarily
- ✅ Eventually extract to new project (leave old cost code behind)

**Benefits**:
- Reuse mature authorization system (authNService, AuthorizationPolicyService)
- Share infrastructure (Neo4j, RabbitMQ, users/roles)
- No migration work later (already integrated)
- Cleaner extraction (copy what's needed, leave rest behind)

**Timeline**:
- Week 1-4: Build POC within existing project
- Week 5-8: Validate & enhance
- Week 9-12: Extract to new project (auth + POC)
- Week 13+: Delete old cost subsystem

---

#### **Approach B (Standalone)** - For Quick Proof-of-Concept

**Use if**:
- ✅ Just proving event sourcing concepts (not production-bound)
- ✅ Need standalone demos for stakeholders
- ✅ Want to learn without existing complexity
- ✅ No immediate plans to integrate with existing system

**Benefits**:
- Faster initial development (no existing system to learn)
- Easier to understand (greenfield)
- Better for demos (self-contained)
- Lower risk during POC phase

**Trade-off**:
- ~1 week migration work if POC approved (rebuild auth integration)

### Project Setup

```bash
# Create new repo
mkdir workpackage-etc-poc
cd workpackage-etc-poc
git init

# Use simplified docs from this guide
# Copy structure from section 2.1
```

### Key Simplifications vs. Main Project

| Aspect | Main Project | Standalone POC |
|--------|--------------|----------------|
| **Authorization** | Complex policy service | Simple JWT + directives |
| **Infrastructure** | Shared Neo4j/RabbitMQ | Docker Compose |
| **User Management** | Full RBAC system | 4 test users hardcoded |
| **Deployment** | Production pipeline | `npm run dev` |
| **Dependencies** | 100+ packages | ~20 packages |
| **Learning Curve** | High (existing complexity) | Low (greenfield) |
| **Demo Readiness** | Hard (needs full project) | Easy (standalone) |

### After POC Success

✅ **If POC approved**: Migrate domain/application layers to main project (1 week)  
❌ **If POC rejected**: No wasted effort in main project  
✅ **Lesson learned**: Standalone repo serves as documentation/reference

---

## 7. Simplified Documentation Structure

### For Standalone POC

```
workpackage-etc-poc/
└── docs/
    ├── README.md                      # Quick start
    ├── ARCHITECTURE.md                # Event sourcing 101
    ├── API.md                         # GraphQL schema
    ├── TESTING.md                     # Test strategy
    └── DEMO.md                        # Demo script for stakeholders
```

**Much simpler than main project docs** (no need to reference existing systems)

---

## 8. Updated Authorization Approach for Standalone

### Simple Role Matrix

| Role | Create WP | Update WP | Update Progress | Approve WP | View |
|------|-----------|-----------|-----------------|------------|------|
| **PM** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Foreman** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Estimator** | ✅ | ✅ (planning only) | ❌ | ❌ | ✅ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ | ✅ |

**Implementation**: Single `@auth` directive + 50 lines of code  
vs.  
**Main Project**: `AuthorizationPolicyService` + policies + 500+ lines

---

## Summary

### **Default Recommendation: Approach A (Integrated)**

For production migrations where you:
- ✅ Plan to replace old system eventually
- ✅ Can refactor existing code (no backward compatibility)
- ✅ Want to reuse mature infrastructure (auth, users, database)

**Result**: Refactor in place → Extract to new project → Delete old code

---

### **Alternative: Approach B (Standalone)**

For quick proof-of-concepts where you:
- ✅ Just need to prove event sourcing patterns
- ✅ Want isolated demos
- ✅ No immediate production plans

**Trade-off**: ~1 week migration work if later adopted

---

**This document covers Approach B details.** For Approach A (integrated), see main documentation.

---

**Document Status**: Alternative Approach  
**Last Updated**: October 2025  
**Recommendation**: Use for POC phase, migrate after approval

