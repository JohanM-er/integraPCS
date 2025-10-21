# Work Package Event-Sourced System - POC Documentation

**Status**: Design Phase  
**Version**: 1.0  
**Date**: October 2025  
**Owner**: Backend Team  

## Overview

This POC demonstrates a pure event-sourced Work Package management system for the complete project lifecycle: **planning → estimation → execution → control**. The system provides an Excel-like interface for work breakdown (Work Package → Task → Line Item structure), cost calculations, and execution tracking using ETC (Estimate-to-Complete) methodology. It is designed to prove the architectural patterns that will be used in the production system while remaining completely isolated from the existing cost subsystem.

### Full System Scope (Beyond POC)
- **Planning Phase**: Work breakdown in Excel-like grid (WP → Task → LineItem hierarchy)
- **Estimation Phase**: Cost calculations, material takeoffs, labor estimates
- **Execution Phase**: Field progress tracking with ETC methodology *(POC Focus)*
- **Control Phase**: Variance analysis, earned value management
- **Integration Points**: Invoicing, contractual obligations, procurement *(Future)*

## Key Innovations

### 1. **Unified Lifecycle System** (Planning → Execution → Control)
   - Single source of truth: WP → Task → LineItem structure across all phases
   - Excel-like planning grid with version control and audit trail
   - Seamless transition from estimates to actuals (no data re-entry)

### 2. **ETC-Based Execution Tracking** *(POC Focus)*
   - Forward-looking estimates ("How much work remains?") instead of percent-complete guesses
   - Early warning variance detection (14+ days before completion)
   - Sub-5-minute daily reporting for foremen

### 3. **Work Package as Aggregate Root**
   - Financial control boundary matching organizational structure
   - Prevents invalid states (e.g., can't add tasks after approval)
   - Complete transaction boundary for all lifecycle events

### 4. **Pure Event Sourcing Architecture**
   - All state changes captured as immutable events (every cell edit recorded)
   - Complete audit trail with old/new values
   - Event replay for debugging and analytics
   - Foundation for invoicing and contractual integrations

### 5. **CQRS with GraphQL**
   - Separate write (commands) and read (projections) models
   - Real-time subscriptions for collaborative editing
   - Optimized queries for different user roles (estimator, PM, foreman)

### 6. **Complete Business Isolation from Existing Systems**
   - Separate aggregate, events, and projections
   - Proves architecture for future migration
   - Can coexist with current cost subsystem

## Problem Statement

Construction projects need a **unified system** spanning the entire project lifecycle:

### Planning & Estimation (Project Initiation)
- Excel-like work breakdown (WP → Task → LineItem structure)
- Collaborative cost estimation and material takeoffs
- Version control and audit trail for estimate changes
- Template reuse from historical projects

### Execution & Control (Field Operations)
- Financial control at work package level (right granularity for PM control)
- Detailed execution tracking at task level (foreman daily reporting)
- Early warning of cost overruns (variance detection before completion)
- Flexible field reporting (not one-size-fits-all)

### Integration & Compliance (Business Operations)
- Foundation for invoicing (progress billing)
- Links to contractual obligations and change orders
- Procurement integration (material ordering)
- Complete audit trail (who changed what, when, why)

Current systems are fragmented (separate planning/execution tools), force inaccurate percent-complete estimates, and lack proper event sourcing for audit and replay capabilities.

## Solution Architecture

### Full System Lifecycle Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    PROJECT LIFECYCLE                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
   ┌────────────┬───────────────┬──────────────┬──────────────┐
   │  PLANNING  │  ESTIMATION   │  EXECUTION   │   CONTROL    │
   │            │               │  (POC Focus) │              │
   └────────────┴───────────────┴──────────────┴──────────────┘
        ↓              ↓              ↓              ↓
   Excel-like    Cost Calcs    ETC Tracking   Variance
   WBS Grid      Material       Daily Reports  Analysis
                 Takeoffs       Real-time      Earned Value
                                Alerts
```

### Event Sourcing Architecture (Technical)
```
React Client (Apollo)
    ↓ GraphQL (queries/mutations/subscriptions)
GraphQL API Layer
    ↓ Commands (CreateWP, AddTask, UpdateProgress)
Work Package Aggregate (domain logic)
    ↓ Events (WorkPackageCreated, TaskProgressUpdated, ...)
Event Store (Neo4j) + Outbox
    ↓ RabbitMQ (workpackage.events → workpackage.projections)
Projection Pipeline (consume events, update read models)
    ↓ Updates Neo4j Projections + GraphQL PubSub
Projections (Neo4j) - Read Models (WorkPackage, Task, LineItem)
    ↑ Query layer for GraphQL
```

## Code Organization

**Vertical Slice Structure** (Unlike existing horizontal backend):

```
backend/workPackageContext/        # 🎯 Complete bounded context
├── domain/                        # Aggregates, Events, Commands
├── application/                   # Command Handlers, Projections
├── infrastructure/                # Event Store, Repositories
└── api/                           # GraphQL Schema & Resolvers

frontend/src/features/WorkPackageETC/   # 🎯 Feature slice
├── components/                    # DailyProgressForm, PMDashboard
├── hooks/                         # useUpdateTaskProgress, useTaskProgressSubscription
└── graphql/                       # Queries, Mutations, Subscriptions
```

**Why Vertical Slicing?**
- ✅ Complete flow in one folder (domain → events → projections → API → UI)
- ✅ Easy to extract as microservice later
- ✅ Clear isolation from existing cost system
- ✅ DDD bounded context principles

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#11-folder-structure-philosophy) for complete structure.

---

## Documentation Structure

### Core Documentation
- **[PRD.md](./PRD.md)** - Product Requirements Document
  - Business context, user personas, functional requirements
- **[TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md)** - Technical Architecture
  - System design, patterns, technology choices, folder structure
- **[DATA_MODELS.md](./DATA_MODELS.md)** - Domain Models & Event Schemas
  - Aggregate structure, event definitions, database schema

### Implementation Guides

#### Architecture Decisions
- **[AUTH_AS_EVENT_SOURCED.md](./AUTH_AS_EVENT_SOURCED.md)** - 🏗️ **Architecture Decision: Should Authorization Be Event-Sourced?**
  - Pure event sourcing vs CRUD vs Hybrid approaches
  - Performance implications (hot path authorization checks)
  - Industry patterns (Auth0, Keycloak, AWS IAM)
  - **Recommendation**: Hybrid approach (CRUD for auth + events for audit)
  - **Reuse existing auth infrastructure**: `authNService`, `AuthorizationPolicyService`, User/Role schema
  - **No wrappers needed**: Refactor directly (no backward compatibility constraints)
  - Complete migration strategy and code examples

**Choose Your Path**:
- **[AUTHORIZATION_PHASES.md](./AUTHORIZATION_PHASES.md)** - 🌟 **START HERE**
  - **Phased approach**: MVP auth → project-level roles → permission matrix → project overrides
  - Designed from Day 1 to accept your existing sophisticated role system
  - Start simple (Week 1-4), expand progressively (Week 5-10)
  - **Recommended approach for POC**

- **[STANDALONE_POC_APPROACH.md](./STANDALONE_POC_APPROACH.md)** - Alternative: Separate Repository
  - Build POC as completely standalone project
  - Simplified auth (Phase 1 only, permanent)
  - Docker-based infrastructure setup
  - Migration path back to main project
  - **Use if**: Proving concepts only, no immediate adoption planned

**Implementation Details**:
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Step-by-Step Implementation
  - Phase-by-phase code patterns, file structure, verification steps
  - Works for both integrated and standalone approaches

**Both Approaches** (apply to either):
- **[API_SPECIFICATION.md](./API_SPECIFICATION.md)** - GraphQL API Reference
  - Complete schema, queries, mutations, subscriptions
- **[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)** - Testing Approach
  - Unit, integration, E2E test patterns

### Planning
- **[POC_ROADMAP.md](./POC_ROADMAP.md)** - Implementation Phases
  - Timeline, milestones, success criteria

## Two Implementation Approaches

### Phased Implementation (Recommended) 🎯

**Your existing authorization system is excellent** (used as feature reference):
- ✅ Project-level role assignments (users have different roles per project)
- ✅ Permission matrix (configurable role permissions)
- ✅ Project role configuration (overrides per project)
- ✅ Scope hierarchy (global → project → site)

**POC Strategy**: Build independently, but match features progressively. Start simple, design for full system from Day 1.

**Important**: The existing system serves as a **specification** for what features to build, not code to integrate.

1. **Phase 1 (Week 1-4)**: MVP Auth
   - Simple global roles (just PM, Foreman, Estimator, Viewer)
   - Prove event sourcing + ETC methodology
   - **Data model ready** for project-scoped roles

2. **Phase 2 (Week 5-6)**: Project-Level Roles
   - Users have different roles in different projects
   - Filter work packages by accessible projects
   - Reuse your `HAS_ROLE` with `scope: 'project'` pattern

3. **Phase 3 (Week 7-8)**: Permission Matrix
   - Load permissions from database (not hardcoded)
   - Conditional permissions (e.g., "assigned to work package")
   - Reuse your `PermissionManagementService` pattern

4. **Phase 4 (Week 9-10)**: Project Overrides
   - Per-project role configuration
   - Override default permissions per project
   - Reuse your project-specific override pattern

**👉 RECOMMENDED: Phase 1 for POC demo, expand after approval**

See [AUTHORIZATION_PHASES.md](./AUTHORIZATION_PHASES.md) for complete phased approach.

---

### Alternative: Standalone Separate Project 

Build POC as completely separate repository (no plan to adopt sophisticated auth):
- Use if: Proving concepts only, no sophisticated auth needed
- See [STANDALONE_POC_APPROACH.md](./STANDALONE_POC_APPROACH.md)

---

## Quick Start

### Prerequisites (Approach A - Integrated)
- Node.js 20+
- Neo4j 5+
- RabbitMQ 3.12+
- Existing schedNeoOrg project setup

### Prerequisites (Approach B - Standalone)
- Node.js 20+
- Docker & Docker Compose
- That's it! (Infrastructure runs in Docker)

### POC Scope (Minimal Vertical Slice)

**The POC focuses on the EXECUTION phase** (field progress tracking with ETC) as a vertical slice to prove the event sourcing architecture. The full planning/estimation capabilities will be added post-POC.

**Phase 1 (2 weeks)**: Core Event Sourcing
- Work Package aggregate with task/line item structure
- Event store + outbox + RabbitMQ
- Commands: `CreateWorkPackage`, `AddTask`, `UpdateTaskProgress`
- Basic projection: Work package with tasks and ETC metrics

**Phase 2 (1 week)**: GraphQL Integration
- Mutations for WP creation, task addition, progress updates
- Queries for dashboard and work package hierarchy
- Subscriptions for real-time updates

**Phase 3 (1 week)**: UI Components
- Daily progress form (mobile-optimized) *(Execution focus)*
- PM early warning dashboard *(Control focus)*
- Real-time variance alerts

**Post-POC Phases** *(Planned, not in POC)*:
- Excel-like planning grid (drag-drop, inline editing)
- Cost estimation formulas and material takeoffs
- Invoicing and contractual obligation links

### Key Success Metrics
- ✅ Foreman can submit daily report in <5 minutes
- ✅ PM sees variance alert within 1 second
- ✅ EAC calculation accurate (spent + remaining)
- ✅ Complete event replay reconstructs aggregate state

## Related Documentation

### Alignment with Existing Plans
This POC aligns with:
- [Event Sourcing Implementation Plan](../comArch/eventSourcingImplementationPlan251016.md) - Infrastructure patterns
- [GraphQL Migration Knowledge Base](../comArch/graphql-migration-knowledge-base.md) - API patterns

### Key Differences
- **Separate Aggregate**: `WorkPackage` vs `LineItem` (existing)
- **Separate Event Stream**: `:WorkPackageEvent` vs `:CostEvent`
- **ETC Methodology**: Hours remaining vs percent complete
- **Different Domain**: Work package execution vs cost tracking

## Shared Infrastructure vs Isolated Business Logic

### ✅ Shared (Infrastructure - Reused Directly)

**Database & Messaging**:
- Neo4j driver and connection
- RabbitMQ service and publisher
- Event store interface
- Outbox pattern implementation

**Authentication & Authorization** (refactor in place, no wrappers):
- `authNService` - JWT verification
- `AuthorizationPolicyService` - Extend with WorkPackage policies
- `userRoleDAL` - User/role database queries
- User/Role Neo4j schema - Same users across cost system and POC
- Frontend auth components - Login UI, role assignment UI, `useAuth` hook

**GraphQL Infrastructure**:
- GraphQL server setup
- Apollo Server configuration

### ❌ Separate (Business Logic - Build New)
- Different aggregate: `WorkPackageAggregate` (not `LineItem`)
- Different event types: `WorkPackageEvent`, `TaskProgressUpdated` (not `CostEvent`)
- Different projections: `WorkPackage`, `Task` nodes (lifecycle-focused, not cost-focused)
- Different command handlers
- Different GraphQL schema types

**Strategy**: Refactor shared infrastructure in place → Build POC domain logic → Extract to new project → Delete old cost code

## Team & Responsibilities

| Role | Responsibility |
|------|----------------|
| **Backend Lead** | Event sourcing implementation, command handlers |
| **Frontend Lead** | GraphQL integration, Apollo Client setup |
| **PM Subject Matter Expert** | Validate dashboard, ETC methodology |
| **Foreman Subject Matter Expert** | Validate mobile UX, reporting workflow |

## Next Steps

1. Review [PRD.md](./PRD.md) for business requirements
2. Review [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) for architecture
3. Follow [POC_ROADMAP.md](./POC_ROADMAP.md) for implementation phases
4. Start with [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) Phase 1

## Questions & Feedback

For questions, open an issue or contact the backend team lead.

---

**Last Updated**: October 2025  
**Contributors**: Backend Team, Frontend Team, PM/Foreman SMEs

