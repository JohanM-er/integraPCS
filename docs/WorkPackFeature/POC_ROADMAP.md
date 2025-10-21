# POC Roadmap - Work Package ETC System

**Version**: 1.0  
**Date**: October 2025  
**Status**: Planning Phase

---

## Executive Summary

**Vision**: Unified Work Package system for complete project lifecycle (planning → estimation → execution → control)

**POC Scope**: Vertical slice of **EXECUTION PHASE** (field progress tracking with ETC methodology) to prove event sourcing architecture

**Goal**: Build a minimal vertical slice (backend + frontend) to prove:
1. Event sourcing architecture supports full lifecycle events (even though POC focuses on execution)
2. ETC methodology works for construction field reporting (vs. percent-complete)
3. Real-time variance alerts arrive early enough to be actionable (14+ days)
4. Foreman can submit daily reports in <5 minutes (mobile-optimized UX)
5. GraphQL + Apollo Client provides good DX for real-time collaborative updates
6. Work Package aggregate correctly models the WP → Task → LineItem hierarchy

**Duration**: 4 weeks (2 sprints)  
**Team**: 1 Backend Dev + 1 Frontend Dev  
**Success Criteria**: PM sees variance alert within 1 second of foreman submission

**Post-POC**: Expand to planning/estimation phases (Excel-like grid, cost calculations, material takeoffs)

---

## Table of Contents
1. [Timeline Overview](#1-timeline-overview)
2. [Phase 1: Core Event Sourcing (2 weeks)](#phase-1-core-event-sourcing-2-weeks)
3. [Phase 2: GraphQL Integration (1 week)](#phase-2-graphql-integration-1-week)
4. [Phase 3: Frontend Components (1 week)](#phase-3-frontend-components-1-week)
5. [Verification & Demo](#verification--demo)
6. [Risk Mitigation](#risk-mitigation)
7. [Post-POC Decision Points](#post-poc-decision-points)

---

## 1. Timeline Overview

```
Week 1-2: Phase 1 - Core Event Sourcing
├─ Day 1-2:   Domain models, events, aggregate
├─ Day 3-4:   Event store, repository
├─ Day 5-6:   Command handlers, outbox
├─ Day 7-8:   Projections, unit tests
└─ Day 9-10:  Integration tests, manual testing

Week 3: Phase 2 - GraphQL Integration
├─ Day 1-2:   GraphQL schema, resolvers
├─ Day 3-4:   Subscriptions, PubSub bridge
└─ Day 5:     GraphQL E2E tests

Week 4: Phase 3 - Frontend Components
├─ Day 1-2:   Apollo Client setup, hooks
├─ Day 3-4:   Daily progress form, PM dashboard
└─ Day 5:     Real-time subscriptions, polish

Week 4 (continued): Verification & Demo
├─ Day 6:     E2E testing, performance benchmarks
└─ Day 7:     Demo preparation, stakeholder review
```

---

## Phase 1: Core Event Sourcing (2 weeks)

**Owner**: Backend Developer  
**Goal**: Implement aggregate, event store, and projection pipeline

### Week 1: Domain & Event Store

#### Day 1-2: Domain Models & Events

**Tasks**:
- [ ] Define event schemas (`DomainEvents.ts`)
- [ ] Implement `Task` entity with ETC calculation logic
- [ ] Implement `WorkPackageAggregate` with command methods
- [ ] Write unit tests for `Task.updateProgress()`
- [ ] Write unit tests for aggregate reconstruction

**Deliverables**:
- `backend/domain/workpackage/WorkPackageAggregate.ts`
- `backend/domain/workpackage/Task.ts`
- `backend/domain/workpackage/events/DomainEvents.ts`
- `backend/tests/unit/WorkPackageAggregate.test.ts` (95% coverage)

**Success Criteria**:
- ✅ Task calculates EAC correctly (16h + 48h = 64h)
- ✅ Variance alert generated when threshold exceeded
- ✅ Aggregate reconstructs from event stream
- ✅ All unit tests pass in <1 second

**Verification**:
```bash
cd backend
npm run test:unit -- WorkPackageAggregate.test.ts
# Expected: 15 tests passing, 95% coverage
```

#### Day 3-4: Event Store & Repository

**Tasks**:
- [ ] Implement `WorkPackageEventStore` (Neo4j)
- [ ] Add optimistic concurrency control (version check)
- [ ] Implement `WorkPackageRepository`
- [ ] Add outbox pattern (transactional event publishing)
- [ ] Write integration tests for event store

**Deliverables**:
- `backend/infrastructure/eventStore/WorkPackageEventStore.ts`
- `backend/infrastructure/eventStore/WorkPackageRepository.ts`
- `backend/infrastructure/outbox/OutboxRepository.ts`
- `backend/tests/integration/WorkPackageEventStore.test.ts`

**Success Criteria**:
- ✅ Events persisted to Neo4j with correct versioning
- ✅ Concurrent writes handled by optimistic locking
- ✅ Outbox entries created in same transaction
- ✅ Load 100 events in <500ms

**Verification**:
```bash
# Start Neo4j (docker-compose up -d neo4j)
npm run test:integration -- WorkPackageEventStore.test.ts
# Expected: All tests pass, <10s total
```

#### Day 5-6: Command Handlers & Outbox Publisher

**Tasks**:
- [ ] Implement `WorkPackageCommandHandler`
- [ ] Add command validation and authorization
- [ ] Implement `OutboxPublisher` (polling + RabbitMQ)
- [ ] Write unit tests for command handler
- [ ] Manual test: Create WP → Add task → Update progress

**Deliverables**:
- `backend/application/commandHandlers/WorkPackageCommandHandler.ts`
- `backend/infrastructure/outbox/OutboxPublisher.ts`
- `backend/tests/unit/WorkPackageCommandHandler.test.ts`

**Success Criteria**:
- ✅ Command handler loads aggregate, executes logic, saves events
- ✅ Outbox publisher polls every 1s and publishes to RabbitMQ
- ✅ Published events marked as processed

**Verification**:
```bash
# Manual test (Node.js script)
node backend/scripts/testCommandHandler.js
# Expected: 
# 1. WorkPackageCreated event in event store
# 2. TaskAdded event in event store
# 3. TaskProgressUpdated event in event store
# 4. All events published to RabbitMQ
```

#### Day 7-8: Projections

**Tasks**:
- [ ] Create Neo4j projection schema (`:WorkPackage`, `:Task` nodes)
- [ ] Implement `WorkPackageProjectionPipeline`
- [ ] Add RabbitMQ consumer (workpackage.projections queue)
- [ ] Implement projection handlers for each event type
- [ ] Add work package totals recalculation
- [ ] Write integration tests for projections

**Deliverables**:
- `backend/application/projections/WorkPackageProjectionPipeline.ts`
- `backend/scripts/setupProjectionSchema.cypher`
- `backend/tests/integration/WorkPackageProjection.test.ts`

**Success Criteria**:
- ✅ Task projection node created on `TaskAdded`
- ✅ Task ETC metrics updated on `TaskProgressUpdated`
- ✅ Work package totals recalculated correctly
- ✅ Projection lag <500ms (event → projection update)

**Verification**:
```bash
# Run projection consumer
npm run dev:projections

# Publish test event to RabbitMQ
node backend/scripts/publishTestEvent.js

# Query Neo4j
cypher-shell "MATCH (t:Task {id: 'task-1'}) RETURN t"
# Expected: Task node with updated ETC metrics
```

#### Day 9-10: Testing & Refinement

**Tasks**:
- [ ] Run full test suite (unit + integration)
- [ ] Add missing test coverage
- [ ] Performance benchmarks (event store, projections)
- [ ] Code review & refactoring
- [ ] Documentation updates

**Success Criteria**:
- ✅ 90%+ test coverage on domain and infrastructure
- ✅ All tests pass consistently
- ✅ Event append <100ms p99
- ✅ Aggregate reconstruction <2s for 100-event stream

**Verification**:
```bash
npm run test:coverage
# Expected: 
# - Statements: 90%+
# - Branches: 85%+
# - Functions: 90%+
# - Lines: 90%+
```

---

## Phase 2: GraphQL Integration (1 week)

**Owner**: Backend Developer  
**Goal**: Expose commands and queries via GraphQL with real-time subscriptions

### Week 3: GraphQL API

#### Day 1-2: Schema & Resolvers

**Tasks**:
- [ ] Define GraphQL schema (`workpackage.graphql`)
- [ ] Implement query resolvers (read from projections)
- [ ] Implement mutation resolvers (call command handlers)
- [ ] Add error handling and validation
- [ ] Write resolver unit tests

**Deliverables**:
- `backend/graphql/schema/workpackage.graphql`
- `backend/graphql/resolvers/workpackageQueries.ts`
- `backend/graphql/resolvers/workpackageMutations.ts`
- `backend/tests/unit/workpackageResolvers.test.ts`

**Success Criteria**:
- ✅ `workPackage(id)` query returns work package with metrics
- ✅ `updateTaskProgress` mutation executes command and returns updated task
- ✅ Mutations return data from projections (eventual consistency OK)
- ✅ GraphQL errors include proper error codes

**Verification**:
```bash
# Start GraphQL server
npm run dev

# Test query (curl)
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ workPackage(id: \"wp-1\") { id name metrics { status } } }"}'

# Expected: Work package data returned
```

#### Day 3-4: Subscriptions & PubSub Bridge

**Tasks**:
- [ ] Setup GraphQL PubSub (in-memory for POC)
- [ ] Implement subscription resolvers
- [ ] Bridge RabbitMQ → GraphQL PubSub (in projection pipeline)
- [ ] Add subscription filtering (by workPackageId, taskId)
- [ ] Test real-time updates (WebSocket)

**Deliverables**:
- `backend/graphql/resolvers/workpackageSubscriptions.ts`
- `backend/graphql/pubsub.ts`
- Updated `WorkPackageProjectionPipeline` with PubSub publishing

**Success Criteria**:
- ✅ `taskProgressUpdated` subscription receives events
- ✅ `taskVarianceAlert` subscription receives alerts
- ✅ Subscriptions filter correctly by workPackageId
- ✅ Real-time update latency <500ms (mutation → subscription)

**Verification**:
```bash
# Terminal 1: Subscribe (GraphQL Playground)
subscription {
  taskProgressUpdated(workPackageId: "wp-1") {
    taskId
    estimateAtCompletion
    variance
  }
}

# Terminal 2: Publish event
mutation {
  updateTaskProgress(workPackageId: "wp-1", taskId: "task-1", input: {...}) {
    id
  }
}

# Expected: Terminal 1 receives update within 500ms
```

#### Day 5: GraphQL E2E Tests

**Tasks**:
- [ ] Write E2E tests for complete flows
- [ ] Test concurrent mutations
- [ ] Test subscription delivery
- [ ] Load test (10 concurrent foremen)

**Deliverables**:
- `backend/tests/e2e/graphqlWorkPackageFlow.test.ts`
- `backend/tests/performance/graphqlLoadTest.test.ts`

**Success Criteria**:
- ✅ Complete flow works: Create WP → Add task → Update progress → Query result
- ✅ Subscription delivers update within 1s
- ✅ 10 concurrent progress updates succeed

**Verification**:
```bash
npm run test:e2e
# Expected: All E2E scenarios pass
```

---

## Phase 3: Frontend Components (1 week)

**Owner**: Frontend Developer  
**Goal**: Build mobile-first foreman form and PM dashboard

### Week 4: React + Apollo Components

#### Day 1-2: Apollo Client Setup & Hooks

**Tasks**:
- [ ] Setup Apollo Client with WebSocket link
- [ ] Create custom hooks (`useUpdateTaskProgress`, `useTaskProgressSubscription`)
- [ ] Implement optimistic UI updates
- [ ] Add error handling and retry logic

**Deliverables**:
- `frontend/src/lib/apollo/client.ts`
- `frontend/src/features/WorkPackageETC/hooks/useUpdateTaskProgress.ts`
- `frontend/src/features/WorkPackageETC/hooks/useTaskProgressSubscription.ts`

**Success Criteria**:
- ✅ Apollo Client connects to GraphQL server
- ✅ Mutations execute successfully
- ✅ Subscriptions receive real-time updates
- ✅ Optimistic UI updates render immediately

**Verification**:
```bash
cd frontend
npm run dev
# Open browser, check Apollo DevTools → connected
```

#### Day 3-4: Daily Progress Form & PM Dashboard

**Tasks**:
- [ ] Build `DailyProgressForm` component (mobile-optimized)
- [ ] Build `PMEarlyWarningDashboard` component
- [ ] Build `TaskETCTrend` chart component
- [ ] Add real-time variance alert notifications (toast)
- [ ] Write component tests (Vitest)

**Deliverables**:
- `frontend/src/features/WorkPackageETC/components/DailyProgressForm.tsx`
- `frontend/src/features/WorkPackageETC/components/PMDashboard.tsx`
- `frontend/src/features/WorkPackageETC/components/TaskETCTrend.tsx`
- `frontend/src/features/WorkPackageETC/components/VarianceAlertToast.tsx`

**Success Criteria**:
- ✅ Form has large touch targets (48px minimum)
- ✅ Form validates input (hours > 0)
- ✅ Dashboard shows work package metrics
- ✅ Dashboard displays at-risk tasks sorted by variance
- ✅ Trend chart shows EAC over past 14 days

**Verification**:
```bash
# Navigate to http://localhost:5173/foreman/wp-1/task-1
# Fill form, submit
# Expected: Success message, form clears, <5 seconds total
```

#### Day 5: Real-Time Subscriptions & Polish

**Tasks**:
- [ ] Wire up GraphQL subscriptions to components
- [ ] Add loading states and error boundaries
- [ ] Polish UI (spacing, colors, responsive)
- [ ] Add keyboard shortcuts (Enter to submit)
- [ ] Write E2E tests (Playwright)

**Deliverables**:
- `frontend/tests/e2e/dailyProgressReport.spec.ts`
- `frontend/tests/e2e/pmEarlyWarningDashboard.spec.ts`

**Success Criteria**:
- ✅ PM dashboard receives real-time task updates
- ✅ Variance alert toast appears within 1 second
- ✅ E2E test: Foreman submits report, PM sees alert
- ✅ Mobile viewport tested (375px width)

**Verification**:
```bash
npm run test:e2e
# Expected: 
# - "Foreman can submit daily report in <5 minutes" ✅
# - "PM sees real-time variance alert" ✅
```

---

## Verification & Demo

### Week 4, Day 6-7: Final Testing & Demo Prep

#### Day 6: E2E Testing & Benchmarks

**Tasks**:
- [ ] Run full test suite (backend + frontend)
- [ ] Performance benchmarks
- [ ] Load test: 10 foremen submitting simultaneously
- [ ] Network latency test (throttle to 4G)
- [ ] Security review (authentication, authorization)

**Success Metrics**:
| Metric | Target | Result |
|--------|--------|--------|
| **Foreman report time** | <5 minutes | ___s |
| **PM alert latency** | <1 second | ___ms |
| **Dashboard load time** | <1 second | ___ms |
| **Event append latency (p99)** | <100ms | ___ms |
| **Projection lag** | <500ms | ___ms |
| **Concurrent foremen** | 10 | ___ |

**Verification Commands**:
```bash
# Backend performance
cd backend
npm run test:performance

# Frontend E2E
cd frontend
npm run test:e2e

# Load test
cd backend
npm run test:load -- --concurrent 10
```

#### Day 7: Demo Preparation

**Tasks**:
- [ ] Prepare demo script (see below)
- [ ] Seed demo data (work package with 3 tasks)
- [ ] Record demo video (backup if live demo fails)
- [ ] Prepare slides (architecture diagram, metrics)
- [ ] Stakeholder review (PM SME, Foreman SME)

**Demo Script** (10 minutes):

1. **Context** (2 min)
   - Problem: Late detection of cost overruns
   - Solution: ETC methodology + event sourcing + real-time alerts

2. **Foreman Flow** (3 min)
   - Open mobile view of daily progress form
   - Submit report: 16h worked, 50h remaining (over estimate!)
   - Show success confirmation (<5 seconds)

3. **PM Flow** (3 min)
   - Switch to PM dashboard on desktop
   - Show variance alert toast (appeared <1s after submission)
   - Click task to see ETC trend chart (EAC increasing over time)
   - Show work package summary (over-budget status)

4. **Technical Deep Dive** (2 min)
   - Show event store (Neo4j Browser)
   - Show projection nodes (Task with ETC metrics)
   - Show RabbitMQ message flow

**Demo Data Seed**:
```bash
node backend/scripts/seedDemoData.js
# Creates:
# - Work Package: "Install Electrical System - Floor 3"
# - Task 1: "Install conduits" (64h estimate, 32h spent, 48h remaining → at-risk)
# - Task 2: "Pull wire" (32h estimate, 0h spent → not started)
# - Task 3: "Install fixtures" (48h estimate, 0h spent → not started)
```

---

## Risk Mitigation

### High-Risk Items

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Neo4j performance issues** | High | Medium | Benchmark early (Day 4), add indexes, consider snapshots |
| **Projection lag exceeds 500ms** | Medium | Medium | Optimize Cypher queries, batch updates, profile |
| **Concurrent edit conflicts** | Medium | Low | Implement optimistic locking, test thoroughly |
| **Frontend subscription flakiness** | Medium | Medium | Add reconnection logic, test network conditions |
| **GraphQL schema changes break client** | Low | Low | Use GraphQL Code Generator for type safety |

### Contingency Plans

**If projection lag exceeds 500ms**:
- Accept 1-2s lag for POC (still proves concept)
- Investigate: Neo4j query profiling, batch updates
- Future: Implement caching layer (Redis)

**If concurrent edits cause conflicts**:
- Implement client-side retry with exponential backoff
- Show user-friendly error: "Task was updated by another user. Retrying..."
- Add optimistic UI updates to hide latency

**If WebSocket subscriptions drop**:
- Implement auto-reconnect (Apollo default)
- Fall back to polling (refetch every 5 seconds)
- Show connection status indicator

---

## Post-POC Decision Points

### Success Criteria for Production Adoption

| Criteria | Target | Measured |
|----------|--------|----------|
| **Foreman adoption** | 80%+ daily reports | Survey + analytics |
| **PM satisfaction** | 8/10 rating | User interview |
| **Variance accuracy** | Alerts 14+ days early | Historical analysis |
| **System reliability** | 99.5% uptime | Monitoring |
| **Performance** | All metrics met | Benchmarks |
| **Architecture proof** | Event sourcing supports full lifecycle | Tech review |
| **Aggregate design** | WP → Task → LineItem structure validated | Code review |

### Go/No-Go Decision (End of Week 4)

**GO** if:
- ✅ All POC metrics achieved
- ✅ Stakeholder approval (PM + Foreman SMEs)
- ✅ No major technical blockers identified
- ✅ Team confident in scaling to production

**NO-GO** if:
- ❌ Performance targets missed by >50%
- ❌ Stakeholders reject UX/methodology
- ❌ Major architectural issues discovered
- ❌ Team lacks confidence

### Next Steps After POC

**If GO**:
1. **Phase 4: Production Hardening** (2 weeks)
   - ✅ Authentication & authorization (already integrated from existing system)
   - Enhance authorization with Phases 2-4 features (project-level roles, permission matrix, project overrides)
   - Implement snapshot pattern (performance optimization)
   - Add monitoring & alerting (Datadog/New Relic)
   - Load testing (100+ concurrent users)
   - Security audit

2. **Phase 5: Planning & Estimation Features** (6 weeks) *(Full Lifecycle Expansion)*
   - Excel-like planning grid (drag-drop, inline editing)
   - Cost estimation formulas and calculations
   - Material takeoff integration
   - Template library from historical projects
   - Multi-estimator collaboration (real-time editing)
   - Version comparison ("Show me estimate v1 vs v2")

3. **Phase 6: Execution Enhancements** (3 weeks)
   - Material tracking (quick-check flow)
   - Configurable reporting templates (beyond POC 3 templates)
   - Mobile offline mode (IndexedDB + sync queue)
   - Crew management and labor productivity tracking

4. **Phase 7: Control & Integration** (4 weeks)
   - Advanced variance analysis and earned value management
   - Invoicing integration (progress billing)
   - Contractual obligations tracking
   - Procurement integration (material ordering)
   - Integration with existing cost system (if needed)

5. **Phase 8: Rollout** (2 weeks)
   - Pilot with 1 project (5 foremen + 2 estimators)
   - Training & documentation
   - Feedback collection
   - Iterative improvements

**If NO-GO**:
- Document lessons learned
- Identify specific blockers
- Propose alternative approaches
- Re-evaluate in 3 months

---

## Communication Plan

### Weekly Status Updates

**Format**: Slack post to #poc-workpackage-etc channel

**Template**:
```
📊 **POC Week [N] Status**

✅ **Completed**:
- Task 1
- Task 2

🚧 **In Progress**:
- Task 3 (80% complete, on track)

⚠️ **Blockers**:
- None / [Describe blocker + mitigation]

📈 **Metrics**:
- Test coverage: 92%
- Performance: Event append 87ms p99 ✅

🎯 **Next Week**:
- Goal 1
- Goal 2
```

### Stakeholder Demos

| Week | Audience | Format | Focus |
|------|----------|--------|-------|
| **Week 2** | Backend Team | Lunch & Learn | Event sourcing architecture |
| **Week 3** | PM SME | 1-on-1 | Dashboard UX feedback |
| **Week 4** | Leadership | Formal Presentation | Business value, metrics |

---

## Budget & Resources

### Team Allocation

| Role | Allocation | Duration | Total Days |
|------|------------|----------|------------|
| **Backend Developer** | 100% | 4 weeks | 20 days |
| **Frontend Developer** | 100% | 2 weeks | 10 days |
| **PM Subject Matter Expert** | 10% (review) | 4 weeks | 2 days |
| **Foreman SME** | 10% (review) | 4 weeks | 2 days |

**Total Effort**: ~34 person-days (~7 person-weeks)

### Infrastructure Costs (POC)

| Resource | Cost | Notes |
|----------|------|-------|
| **Neo4j** | $0 | Docker local |
| **RabbitMQ** | $0 | Docker local |
| **Hosting** | $0 | Local dev |
| **Monitoring** | $0 | Console logs (prod: Datadog) |

**Total POC Cost**: $0 (infrastructure reuse)

---

## Appendix: Quick Reference

### Key Commands

```bash
# Backend
cd backend
npm run dev              # Start backend server
npm run dev:projections  # Start projection consumer
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only

# Frontend
cd frontend
npm run dev              # Start Vite dev server
npm test                 # Run Vitest unit tests
npm run test:e2e         # Run Playwright E2E tests

# Docker
docker-compose up -d              # Start Neo4j + RabbitMQ
docker-compose down -v            # Stop and remove volumes
docker-compose logs -f neo4j      # View Neo4j logs

# Neo4j
cypher-shell -u neo4j -p password
# Query: MATCH (n) RETURN n LIMIT 10

# RabbitMQ
# UI: http://localhost:15672 (guest/guest)
```

### Key URLs

- **Backend GraphQL**: http://localhost:3000/graphql
- **Frontend Dev**: http://localhost:5173
- **Neo4j Browser**: http://localhost:7474
- **RabbitMQ Management**: http://localhost:15672

---

**Document Status**: Planning Phase  
**Last Updated**: October 2025  
**Next Review**: End of Week 2 (Phase 1 completion)  
**Owner**: Backend Team Lead

---

**Ready to Start?** → Begin with Phase 1, Day 1: Domain Models & Events  
**Questions?** → Reach out to #poc-workpackage-etc Slack channel

