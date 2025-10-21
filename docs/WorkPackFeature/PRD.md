# Product Requirements Document - Work Package ETC System

**Version**: 1.0  
**Date**: October 2025  
**Status**: Approved for POC

---

## 1. Executive Summary

### 1.1 Vision
Enable construction teams to manage the **complete project lifecycle**—from initial planning and cost estimation through execution and control—in a unified, event-sourced system. Provide Excel-like work breakdown structure, collaborative cost estimation, and forward-looking ETC (Estimate-to-Complete) execution tracking with real-time variance alerts.

### 1.2 Problem Statement

**Current State**: Fragmented systems across project lifecycle
- **Planning Phase**: Estimators use Excel/spreadsheets (no version control, lost formulas, no audit trail)
- **Execution Phase**: Foremen use separate field reporting tools (disconnected from estimates, inaccurate percent-complete guesses)
- **Control Phase**: PMs manually consolidate data (late detection of overruns, no real-time visibility)
- **Integration**: Invoicing and procurement are separate systems (manual data entry, errors, delays)

**Pain Points**:
- PMs need early detection of overruns (current systems report variances too late)
- Estimators lose visibility into actual costs (no feedback loop for future estimates)
- Foremen waste time on complex reporting (one-size-fits-all forms)
- Percent-complete estimates are inaccurate ("we're 80% done" means nothing)
- No single source of truth (WP → Task → LineItem structure duplicated across systems)
- Audit requirements demand complete change history (Excel versions don't cut it)

### 1.3 Solution Overview

**Unified Work Package System** (Planning → Execution → Control)

**Planning & Estimation**:
- Excel-like grid for work breakdown (WP → Task → LineItem hierarchy)
- Drag-drop, inline editing, copy-paste from Excel
- Version-controlled estimates with complete audit trail
- Template library from historical projects

**Execution Tracking** *(POC Focus)*:
- **ETC Methodology**: Foremen estimate "hours remaining" (natural thinking)
- **Work Package Aggregate**: PM control boundary (right financial granularity)
- **Configurable Templates**: Minimal to detailed reporting per task
- **Real-Time Alerts**: Variance detection triggers immediate PM notification

**Control & Integration**:
- **Event Sourcing**: Complete audit trail with old/new values (every cell change recorded)
- **Variance Analysis**: Compare actuals to original estimates
- **Integration Foundation**: Events feed invoicing, contractual obligations, procurement

**POC Scope**: Vertical slice focusing on **Execution Phase** (ETC tracking) to prove event sourcing architecture

---

## 2. Business Context

### 2.1 Organizational Hierarchy

```
Client/Owner
    ↓ Approves budgets & milestones
Project Manager (PM)
    ↓ Plans & controls
Work Package (Financial Control Unit)
    ↓ Contains
Tasks (Value Delivery Units)
    ↓ Requires
Line Items (Calculation Details)
    ↓ Executed by
Field Crew (Foreman + Workers)
```

### 2.2 Domain Concepts

#### Work Package
- **Definition**: Group of related tasks representing deliverable scope
- **Size**: $20k-$200k, 2-6 weeks duration
- **Example**: "Install Electrical System - Floor 3"
- **Owner**: Project Manager
- **Purpose**: Budget control, schedule milestone, client billing

#### Task
- **Definition**: Smallest atomic unit of work creating value
- **Example**: "Install conduits and backboxes in north corridor"
- **Duration**: 0.5-5 days
- **Owner**: Site Foreman
- **Completion**: Binary (done/not done), verified by inspection

#### Line Item
- **Definition**: Material/labor resource calculation detail
- **Example**: "50m 25mm PVC conduit @ $8.50/m = $425"
- **Created by**: Estimator during planning
- **Purpose**: Cost calculation, material ordering, granular tracking

---

## 3. User Personas

### 3.1 Project Manager (Sarah)
**Role**: Controls multiple work packages, reports to client  
**Goals**:
- Detect cost overruns early (2+ weeks before completion)
- Review work package status quickly (<30 min per week)
- Maintain budget accuracy (<10% variance)

**Pain Points**:
- Current systems report problems too late
- Manual aggregation of foreman reports
- No trend visibility (is it improving or deteriorating?)

**Success Metrics**:
- Variance alerts arrive 2+ weeks early
- Dashboard review time <30 min per work package
- Final variance <10% of original estimate

### 3.2 Site Foreman (Carlos)
**Role**: Executes tasks, manages crew, reports daily  
**Goals**:
- Submit daily report quickly (<5 minutes)
- Accurate estimation without complex calculations
- Focus on work, not paperwork

**Pain Points**:
- Percent-complete estimates feel arbitrary
- Too many required fields in reports
- Forms don't match actual workflow

**Success Metrics**:
- Daily report completion in <5 minutes
- 90%+ daily report compliance
- Natural thinking ("how much work left?")

### 3.3 Estimator (John)
**Role**: Plans work packages, calculates initial costs, builds WBS  
**Goals**:
- Design accurate task breakdowns in Excel-like grid
- Build detailed line item estimates (material, labor, equipment)
- Learn from actual vs estimated for future projects
- Reuse templates from historical projects

**Pain Points**:
- Excel spreadsheets lose formulas when emailed/versioned
- No feedback loop from field actuals (lives in different system)
- Can't analyze productivity trends (data scattered)
- Unclear why estimates were wrong (no variance drill-down)
- Manual data entry to transfer estimates to execution system

**Success Metrics**:
- Excel-like grid for work breakdown (drag-drop, inline editing)
- Access to actual vs estimated data (within same system)
- Productivity analysis per task type
- Variance reasons captured during execution
- Template creation from completed projects

---

## 4. Functional Requirements

### 4.1 Work Package Planning (PM & Estimator)

#### FR-001: Create Work Package
**Actor**: Project Manager  
**Priority**: P0 (MVP)

**Flow**:
1. PM creates work package with name, budget, schedule
2. System generates `WorkPackageCreated` event
3. System sets phase to 'planning'

**Acceptance Criteria**:
- Work package persisted with unique ID
- Event stored in event store
- Status visible on PM dashboard

#### FR-002: Add Task to Work Package
**Actor**: Estimator  
**Priority**: P0 (MVP)

**Flow**:
1. Estimator adds task with name, estimated hours
2. System validates task doesn't duplicate
3. System generates `TaskAddedToWorkPackage` event

**Acceptance Criteria**:
- Task added to work package
- Original estimate recorded
- Task visible in work package plan

#### FR-003: Configure Task Reporting Template
**Actor**: Project Manager  
**Priority**: P1 (Post-MVP)

**Flow**:
1. PM selects reporting template (minimal/standard/detailed)
2. PM sets auto-alert threshold (default: 10%)
3. System generates `TaskReportingConfigured` event

**Acceptance Criteria**:
- Template saved to task configuration
- Foreman sees correct form based on template
- Alert threshold enforced

**Templates**:
- **Minimal**: Hours worked + hours remaining only
- **Standard**: + crew breakdown + material quick-check
- **Detailed**: + material consumption + photos + quality checks
- **Time-Only**: Labor tracking, no materials
- **Material-Critical**: Detailed per-item consumption

#### FR-004: Approve Work Package for Execution
**Actor**: Project Manager  
**Priority**: P0 (MVP)

**Flow**:
1. PM reviews total cost, task completeness
2. PM approves work package
3. System validates all tasks have estimates
4. System changes phase to 'approved'
5. System generates `WorkPackageApprovedForExecution` event

**Acceptance Criteria**:
- All tasks validated (have estimates)
- Phase changed to 'approved'
- Work package released to field

---

### 4.2 Field Execution (Foreman & Crew)

#### FR-005: Update Task Progress (ETC Method)
**Actor**: Site Foreman  
**Priority**: P0 (MVP)

**Flow**:
1. Foreman opens daily report form
2. Foreman enters:
   - Hours worked today (per crew member)
   - **Hours remaining estimate** (KEY!)
   - Brief work description
   - Issues (optional)
3. System calculates:
   - `hoursSpentToDate += hoursWorkedToday`
   - `estimateAtCompletion = hoursSpentToDate + hoursRemaining`
   - `variance = EAC - originalEstimate`
   - `status = variance > 15% ? 'over-budget' : variance > 5% ? 'at-risk' : 'on-track'`
4. System generates `TaskProgressUpdated` event
5. If variance > threshold, system generates `TaskVarianceAlert` event

**Acceptance Criteria**:
- Foreman completes report in <5 minutes
- EAC calculated correctly
- PM notified if variance exceeds threshold
- Real-time dashboard update

**Example**:
```
Day 1: Worked 16h, estimate remaining 48h → EAC = 64h (original: 64h, ✅ on-track)
Day 3: Worked 16h, estimate remaining 56h → EAC = 104h (original: 64h, 🔴 alert!)
```

#### FR-006: Check Material Status
**Actor**: Site Foreman  
**Priority**: P1 (Post-MVP)

**Flow**:
1. System shows each line item with planned, used, remaining
2. Foreman answers per item: "Does remaining look reasonable? (yes/no)"
3. If "no", foreman enters revised estimate
4. System checks if remaining < 10% of planned
5. System generates `MaterialStatusChecked` event
6. If low, system alerts procurement

**Acceptance Criteria**:
- Quick yes/no validation (<1 min per task)
- Procurement alerted if low
- Override estimates captured

#### FR-007: Complete Task
**Actor**: Site Foreman  
**Priority**: P0 (MVP)

**Flow**:
1. Foreman marks task complete
2. System validates all reports submitted
3. System calculates final cost
4. System generates `TaskCompleted` event
5. System checks if all WP tasks complete
6. If all complete, system generates `WorkPackageReadyForReview`

**Acceptance Criteria**:
- Task marked complete
- Final cost calculated
- Work package completion detected

---

### 4.3 Cost Control & Monitoring (PM)

#### FR-008: View Early Warning Dashboard
**Actor**: Project Manager  
**Priority**: P0 (MVP)

**Query**: `GET /graphql?query=workPackage(id)`

**Returns**:
- Work package summary (EAC, variance, status)
- Tasks requiring attention (sorted by severity)
- All tasks grid (ETC columns visible)
- Trend chart (EAC over time)

**Acceptance Criteria**:
- Dashboard loads in <1 second
- Variance alerts visible
- Trend shows improving/deteriorating
- Click task for details

#### FR-009: View Task ETC Trend
**Actor**: Project Manager  
**Priority**: P1 (Post-MVP)

**Query**: `GET /graphql?query=task(id) { etcTrend(days: 14) }`

**Returns**: Time series of EAC over past 14 days

**Purpose**: See if task is improving or worsening

**Acceptance Criteria**:
- Chart shows daily EAC
- Trend line visible
- Foreman notes accessible

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Dashboard query: <1 second (read from projection)
- Event append: <100ms p99
- Projection lag: <500ms (event → projection update)
- Mobile form: Loads in <1 second on 4G

### 5.2 Scalability
- Support 100 concurrent foremen (daily reporting)
- 1000 work packages per project
- 10,000 tasks per work package
- 1M events per year retention

### 5.3 Reliability
- Event store durability: No data loss
- Projection rebuild: <1 hour for 1M events
- Offline support: 8-hour shift without connectivity
- Sync queue: Auto-retry on reconnect

### 5.4 Security
- Role-based access: PM, Foreman, Estimator
- Event immutability: No delete/edit after commit
- Audit trail: All changes logged with user ID
- API authentication: JWT tokens

### 5.5 Usability
- Mobile-first design (80% of reporting on phone)
- Touch-friendly (large buttons, swipe gestures)
- Minimal typing (dropdowns, pre-filled values)
- Offline feedback (show "will sync" indicator)

---

## 6. Success Metrics

### 6.1 Business Metrics

| Metric | Baseline | Target | How Measured |
|--------|----------|--------|--------------|
| **Variance Alert Lead Time** | 0 days (none) | 14+ days | Days between first alert and task completion |
| **Daily Report Compliance** | 60% | 90% | Reports submitted / tasks in progress |
| **Report Time** | 15 min | <5 min | Average time tracked in mobile app |
| **Final Cost Accuracy** | ±20% | ±10% | \|(Actual - Estimate) / Estimate\| |
| **PM Review Time** | 2 hours/week | <30 min/week | Time in dashboard per work package |

### 6.2 Technical Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| **Event Append Latency** | <100ms p99 | APM monitoring |
| **Projection Lag** | <500ms | Event timestamp - projection update |
| **Dashboard Load Time** | <1 second | Browser performance API |
| **Concurrent Edit Conflicts** | <1% | ConcurrencyError rate |
| **Event Replay Speed** | <2s for 100-task WP | Aggregate reconstruction benchmark |

---

## 7. Out of Scope (for POC)

### Not Included in POC
The POC focuses on **Execution Phase (ETC tracking)** as a vertical slice. The following full-system features are planned for post-POC:

#### Planning & Estimation Features (Post-POC)
- ❌ Excel-like planning grid (drag-drop, inline editing, copy-paste)
- ❌ Cost estimation formulas and calculations
- ❌ Material takeoff integration
- ❌ Template library and historical project reuse
- ❌ Multi-estimator collaboration (real-time editing like Google Sheets)
- ❌ Version comparison ("Show me estimate v1 vs v2")

#### Integration Features (Post-POC)
- ❌ Invoicing integration (progress billing based on completed tasks)
- ❌ Contractual obligations tracking (link tasks to contract line items)
- ❌ Procurement integration (auto-generate material orders from line items)
- ❌ Accounting system sync (export to QuickBooks, Sage, etc.)
- ❌ Client portal (owner view of progress)

#### Advanced Features (Future)
- ❌ Multi-project aggregation (portfolio view)
- ❌ Mobile app native features (camera for photos, GPS for location)
- ❌ Advanced analytics (machine learning, forecasting)
- ❌ Historical data migration (import legacy projects)
- ❌ Mobile offline mode (full sync)
- ❌ Advanced earned value management (SPI, CPI, TCPI)
- ❌ Predictive variance detection (ML model)
- ❌ Resource optimization recommendations

---

## 8. Assumptions & Dependencies

### Assumptions
- Foremen have smartphones with 4G connectivity
- PMs have web browsers (Chrome/Edge/Firefox)
- Network connectivity sufficient for real-time updates (occasional drops OK)
- Users comfortable with mobile apps (basic digital literacy)
- Work packages follow standard structure (tasks → line items)

### Dependencies
- Neo4j 5+ database available
- RabbitMQ 3.12+ for event bus
- Existing authentication system (JWT tokens)
- Apollo Client compatible frontend (React 19)
- Node.js 20+ backend runtime

---

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Foremen resist new system** | High | Medium | Early involvement, simple UX, <5 min forms |
| **Network connectivity poor** | Medium | Medium | Offline mode, sync queue, visual feedback |
| **ETC estimates inaccurate** | High | Low | Training, examples, PM review capability |
| **PM dashboard too complex** | Medium | Low | User testing, iterative simplification |
| **Event store performance** | High | Low | Benchmark early, projection optimization |

---

## 10. Glossary

- **ETC**: Estimate-to-Complete, forward-looking work remaining
- **EAC**: Estimate-at-Completion, total work (spent + remaining)
- **Variance**: Difference between EAC and original estimate
- **Aggregate**: Transaction boundary in event sourcing
- **Projection**: Read-optimized view derived from events
- **Command**: User intent to change state
- **Query**: Request for current state
- **Work Package**: Financial control unit (PM responsibility)
- **Task**: Atomic work unit creating value (Foreman responsibility)

---

**Document Status**: Approved for POC  
**Next Review**: After Phase 1 completion  
**Approval**: PM Subject Matter Expert, Backend Lead

