---
title: DDD Monorepo Blueprint and Migration Plan
status: Adoptable
owners: Architecture + Work Package Team
lastUpdated: 2025-10-23
---

# Repository Structure and Rules (DDD Monorepo Blueprint)

This document replaces the previous draft. It defines a future-proof, bounded-context-first monorepo for this repository, grounded in the Work Package event-sourced design and ready for additional contexts (authorization, invoicing, cost-control, etc.).

Decisions (rooted in Work Package design and docs):
- Architecture: Event sourcing + CQRS, GraphQL API, Neo4j event store and projections, RabbitMQ outbox, React frontends
- Bounded contexts: Work Package lifecycle today; more to follow as domains are discovered
- Workspace tool: Nx with pnpm (pnpm as package manager, Nx for project graph, caching, module boundaries)
- Context alignment: Backend contexts and frontend feature slices align 1:1
- Shared vs platform: Keep shared/kernel minimal; put runtime infrastructure in platform; contexts consume via ports/adapters
- Generated code: Lives only under generated/ per context/package

See:
- Work Package docs: docs/WorkPackFeature/*
- Technical implementation: docs/WorkPackFeature/TECHNICAL_DESIGN.md, IMPLEMENTATION_GUIDE.md
- API: docs/WorkPackFeature/API_SPECIFICATION.md
- Auth evolution: docs/WorkPackFeature/AUTHORIZATION_PHASES.md

---

## Top-level Layout (Monorepo Root)

```
/
├─ README.md
├─ CONTRIBUTING.md
├─ CODEOWNERS
├─ LICENSE
├─ .editorconfig
├─ .gitignore
├─ package.json                      # pnpm workspace root + Nx executor scripts
├─ pnpm-workspace.yaml
├─ nx.json                           # Nx workspace config (projects, tags, boundaries)
├─ tsconfig.base.json
│
├─ docs/
│  ├─ adr/                           # Architectural Decision Records (single source of truth)
│  ├─ runbooks/                      # Operability & on-call runbooks
│  ├─ diagrams/                      # System diagrams (source-of-truth assets)
│  └─ contexts/                      # Context-facing docs (linked from each context README)
│
├─ apps/
│  ├─ api/                           # GraphQL API gateway (composes per-context GraphQL modules)
│  │  ├─ src/
│  │  │  ├─ main.ts                  # Server bootstrap (Apollo Server)
│  │  │  ├─ graphql/
│  │  │  │  ├─ server.ts             # Apollo/HTTP+WS setup
│  │  │  │  └─ context.ts            # GraphQL context factory (authN/authZ injection)
│  │  │  └─ middleware/              # CORS, rate limit, security headers
│  │  └─ project.json                # Nx project config (tags: ["scope:app","type:api"])
│  │
│  ├─ jobs/                          # Runtime workers (independent processes)
│  │  ├─ outbox-publisher/           # Publishes Outbox → RabbitMQ
│  │  └─ projection-consumer/        # Consumes RabbitMQ → updates projections, PubSub bridge
│  │
│  └─ web/                           # React app (PM dashboard + Foreman flows)
│     ├─ src/
│     │  ├─ app/                     # Entry composition (routing, layout, providers)
│     │  ├─ features/
│     │  │  └─ work-package/         # 1:1 with contexts/work-package
│     │  │     ├─ components/
│     │  │     ├─ graphql/           # queries/mutations/subscriptions for this feature
│     │  │     ├─ hooks/
│     │  │     ├─ pages/
│     │  │     └─ types/
│     │  └─ lib/                      # apollo client, ui helpers (non-domain)
│     └─ project.json                # Nx project config (tags: ["scope:app","type:web"])
│
├─ contexts/
│  └─ work-package/                  # Work Package bounded context (vertical slice)
│     ├─ domain/                     # Aggregates, Entities, Value Objects, Domain Events
│     ├─ application/                # Command & Query handlers, projection pipelines
│     ├─ infrastructure/             # Persistence, messaging adapters (ports implementations)
│     │  ├─ persistence/{event-store,projections,outbox}
│     │  └─ messaging/
│     ├─ interfaces/                 # GraphQL schema+resolvers, consumers, workers (ports)
│     │  └─ graphql/{schema,resolvers,subscriptions,dataSources,generated}
│     ├─ tests/{unit,integration,e2e}
│     └─ README.md                   # Context documentation (purpose, surface, ports)
│
├─ platform/                         # Cross-cutting runtime services (no domain logic)
│  ├─ db/                            # Neo4j driver init + health checks
│  ├─ messaging/                     # RabbitMQ connection, channel mgmt, topology builders
│  ├─ graphql/                       # Gateway composition utils, shared scalars, pubsub
│  ├─ auth/                          # AuthN service integration (JWT verify), policy engine wiring
│  ├─ observability/                 # Logger, metrics, tracing
│  ├─ security/                      # Threat models, security middleware helpers
│  └─ config/                        # env loader, configuration schema
│
├─ shared/                           # Minimal kernel and reusable building blocks
│  ├─ kernel/                        # Entity, ValueObject, AggregateRoot, Result, Guard
│  ├─ patterns/                      # Port interfaces (EventStore, Repository, Outbox)
│  └─ common/                        # Base errors, date utils, ids (pure, deterministic)
│
├─ packages/
│  ├─ design-tokens/                 # Existing CSS tokens (publishable)
│  └─ shared-types/                  # Existing TS types (publishable)
│
├─ spikes/                           # Non-production experiments and demos (no app deps)
│  └─ prototypes/                    # Temporary parking for Storybook and experimental components
│
├─ generated/                        # Codegen output only (by rule)
│
├─ ci/                               # CI workflow definitions and quality gates
│  ├─ workflows/
│  ├─ quality-gates/
│  └─ steps/
│
├─ local/                            # Local dev assets (compose files, seeds, scripts)
│  ├─ docker-compose.yml
│  └─ seeds/
│
└─ quality/
   ├─ static-analysis/
   ├─ mutation-testing/
   └─ testdata/
```

Key characteristics:
- contexts/* owns domain and use cases. No other folder contains business rules.
- apps/* are deployment targets (API, workers, web).
- platform/* is runtime infrastructure (authN, messaging, db, graphql server/gateway, observability).
- shared/* is a tiny kernel + pure building blocks. No I/O.
- packages/* are publishable libraries (design tokens, types, ui libs later).
- spikes/* is explicitly non-production, excluded from Nx graph/enforcement.
- generated/* is the only place where generated artifacts live (GraphQL, codegen) per-project.

---

## Per-context Template (Work Package as canonical example)

Aligns with Implementation Guide §1.2 and Technical Design §§1–5.

```
contexts/work-package/
├─ domain/
│  ├─ WorkPackageAggregate.ts
│  ├─ Task.ts
│  ├─ valueObjects/
│  ├─ commands/                     # intent types only (no I/O)
│  └─ events/                       # Domain event types (no persistence concerns)
│
├─ application/
│  ├─ commandHandlers/              # Orchestrate use cases, no transport logic
│  ├─ queryHandlers/                # Read-side orchestration (from projections)
│  └─ projections/
│     ├─ handlers/                  # Idempotent handlers per event type
│     └─ pipelines/                 # Compose handlers, publish to PubSub
│
├─ infrastructure/
│  ├─ persistence/
│  │  ├─ event-store/               # Neo4j event store adapter (ports from shared/patterns)
│  │  ├─ projections/               # Neo4j read models (WorkPackage, Task, History)
│  │  └─ outbox/                    # Outbox repository (transactional with event store)
│  └─ messaging/
│     └─ rabbitmq/                  # Event bus adapter (publish/consume)
│
├─ interfaces/
│  └─ graphql/
│     ├─ schema.graphql             # Schema per API_SPECIFICATION.md
│     ├─ resolvers/                 # Mutations call command handlers; queries read projections
│     ├─ subscriptions/             # PubSub bridging (platform/graphql pubsub)
│     ├─ dataSources/               # Read model access (Neo4j sessions)
│     └─ generated/                 # codegen outputs only
│
├─ tests/
│  ├─ unit/                         # domain/app unit tests
│  ├─ integration/                  # event store, projections, GraphQL module tests
│  └─ e2e/                          # end-to-end within context boundary
│
└─ README.md                        # Context README (see template below)
```

Dependency direction (enforced):
- domain → application → infrastructure → interfaces
- domain must not import application/infrastructure/interfaces
- application can depend on domain and ports (shared/patterns)
- infrastructure implements ports (from shared/patterns), may depend on platform runtime (db/messaging)
- interfaces depend on application + platform/graphql but never on domain directly

Communication:
- Inter-context via platform/messaging (RabbitMQ) and via API gateway composition
- No contexts/* → contexts/* imports

Authorization (evolves per phases):
- Phase 1: Simple role checks wired in interfaces/graphql resolvers using platform/auth
- Phase 2+: Project-scoped roles; permission matrix (context authorization may emerge as its own bounded context later)

---

## Frontend Alignment (Feature slices)

The web app aligns features to contexts.

```
apps/web/src/features/
└─ work-package/
   ├─ components/                   # DailyProgressForm, PMDashboard, TaskETCTrend, etc.
   ├─ graphql/                      # co-located documents for this feature
   ├─ hooks/
   ├─ pages/
   └─ types/
```

- Feature code depends on:
  - packages/design-tokens (styling tokens)
  - packages/shared-types (GraphQL types or shared TS contracts, if needed)
  - apps/web/src/lib/apollo for client setup
- Storybook demos and unstable experiments live under spikes/prototypes until we introduce a UI library package (packages/ui-components).

---

## Platform and Shared

- platform/db: Neo4j driver lifecycle; health probes
- platform/messaging: RabbitMQ connection pooling, topology declarations (exchanges/queues) for workpackage.events, workpackage.projections
- platform/graphql:
  - server.ts: Apollo server (HTTP + WebSocket) for apps/api
  - composition utilities: collect each context’s GraphQL module (schema + resolvers)
  - PubSub: in-memory for POC; pluggable (Redis) later
- platform/auth: JWT verification (reuse existing), authorization service wiring; export helpers to GraphQL context
- platform/observability: Logger (structured), metrics, tracing glue
- shared/kernel: DDD primitives (Entity, AggregateRoot, ValueObject)
- shared/patterns: Port interfaces (EventStore, Repository, Outbox)
- shared/common: Pure utilities (id generator, date utils), base errors

Rule: contexts import shared/* and platform/*; platform never imports contexts.

---

## Workspace Tooling and Enforcement

Chosen toolchain:
- Package manager: pnpm
- Orchestrator: Nx
- CI: GitHub Actions (ci/workflows)
- Test runners: Jest (backend), Vitest/Playwright (frontend)

Nx project tagging (example):
- scope: "context" | "platform" | "shared" | "app" | "package" | "spike"
- layer: "domain" | "application" | "infrastructure" | "interfaces" | "test"
- type: "api" | "web" | "job" | "lib"

Module boundaries (nx.json snippet):

```json
{
  "extends": "nx/presets/npm.json",
  "namedInputs": { "default": ["{projectRoot}/**/*", "!{projectRoot}/generated/**/*"] },
  "targetDefaults": {
    "build": { "cache": true },
    "test": { "cache": true },
    "lint": { "cache": true },
    "typecheck": { "cache": true }
  },
  "plugins": [],
  "workspaceLayout": { "appsDir": "apps", "libsDir": "." }
}
```

ESLint boundaries:

```json
{
  "overrides": [
    {
      "files": ["**/*.ts", "**/*.tsx"],
      "plugins": ["boundaries"],
      "settings": {
        "boundaries/elements": [
          { "type": "domain", "pattern": "contexts/*/domain/**" },
          { "type": "application", "pattern": "contexts/*/application/**" },
          { "type": "infrastructure", "pattern": "contexts/*/infrastructure/**" },
          { "type": "interfaces", "pattern": "contexts/*/interfaces/**" },
          { "type": "platform", "pattern": "platform/**" },
          { "type": "shared", "pattern": "shared/**" }
        ]
      },
      "rules": {
        "boundaries/element-types": [2, {
          "default": "allow",
          "message": "Violation of DDD dependency rule",
          "rules": [
            { "from": ["domain"], "allow": ["domain", "shared"] },
            { "from": ["application"], "allow": ["domain", "shared", "platform", "application"] },
            { "from": ["infrastructure"], "allow": ["application", "domain", "shared", "platform", "infrastructure"] },
            { "from": ["interfaces"], "allow": ["application", "shared", "platform", "interfaces"] },
            { "from": ["platform"], "allow": ["shared", "platform"] },
            { "from": ["shared"], "allow": ["shared"] }
          ]
        }]
      }
    }
  ]
}
```

Generated code policy:
- All generated assets (GraphQL codegen, schema types, client stubs) must live under generated/ folders and be ignored in PR reviews.
- Block direct edits to generated/ via CI quality gate.
- Example paths:
  - contexts/work-package/interfaces/graphql/generated/**
  - apps/web/src/features/work-package/generated/**
  - packages/shared-types/generated/**

Quality gates:
- Import boundaries check (ESLint).
- Typecheck all targets (strict TS).
- Coverage thresholds (backend + frontend).
- Event projection idempotency tests (integration).
- No compiled assets checked-in (e.g., storybook-static must not be versioned).
- Large file/glob checks: block changes under generated/ or storybook-static/.

---

## Documentation Expectations

Root README ToC:
1. Quickstart (pnpm install, pnpm nx run apps)
2. Repository layout (this document)
3. Workspace tooling (pnpm + Nx basics)
4. Development workflow (affected, caching, graph)
5. Architecture overview (CQRS, event sourcing, GraphQL)
6. Contracts and codegen policy
7. Testing strategy (unit/integration/e2e)
8. CI and quality gates
9. Release/versioning
10. Ownership and support

Per-context README ToC (contexts/<ctx>/README.md):
1. Purpose and boundaries
2. Public surface (APIs, events)
3. Model overview (aggregates, entities, events)
4. Ports and adapters (list of implementations)
5. Running locally (migrations, seeds if any)
6. Tests (how to run)
7. Projections and migrations
8. Ownership

ADR process:
- All architecture decisions logged in docs/adr/.
- Link relevant ADRs from context READMEs.

---

## Testing Strategy

- Unit: domain/application (fast, pure).
- Integration: event store appends, outbox behavior, projection updates (Neo4j test container).
- API module tests: GraphQL resolvers for each context (schema-first).
- E2E:
  - Backend flows (apps/jobs end-to-end: outbox → RabbitMQ → projections → PubSub).
  - Frontend flows (Playwright) for PM dashboard and foreman daily report.
- Performance: projection lag and event append latency tracked via metrics (platform/observability).

---

## Migration Plan (from current repo)

Goal: Move incrementally without breaking dev productivity. Use Nx project graph to track affected changes.

1) Tooling bootstrap
- Add pnpm-workspace.yaml and Nx (nx.json).
- Convert existing scripts to Nx targets where useful (build, test, lint, typecheck).
- Add ESLint boundaries rules above.

2) Create target layout
- Create apps/api and port backend/src/index.ts bootstrap to apps/api/src/main.ts.
- Create platform/* with:
  - platform/config: move backend/src/shared/env.ts → platform/config/env (merge with configuration schema).
  - platform/observability: move backend/src/shared/logger.ts → platform/observability/logger.
  - platform/graphql: migrate backend/src/api/context.ts → apps/api/src/graphql/context.ts; move server setup into platform/graphql/server.ts and compose in apps/api/src/main.ts.
  - platform/messaging: move backend/src/infrastructure/messaging/RabbitMQService.ts → platform/messaging/rabbitmq.
  - platform/auth: move backend/src/infrastructure/auth/SimpleAuthService.ts → platform/auth (or wire to existing authN service as per AUTHORIZATION_PHASES.md).
  - apps/api/src/middleware: move backend/src/middleware/{cors,rateLimiter,security}.ts.
  - apps/api/src/graphql/directives: move backend/src/api/directives/authDirective.ts.

3) Extract the Work Package context
- Create contexts/work-package/ with domain/application/infrastructure/interfaces as per template.
- Move files:
  - backend/src/domain/WorkPackageAggregate.ts → contexts/work-package/domain/WorkPackageAggregate.ts
  - backend/src/domain/Task.ts → contexts/work-package/domain/Task.ts
  - backend/src/domain/events/DomainEvents.ts → contexts/work-package/domain/events/DomainEvents.ts
  - backend/src/domain/commands/Commands.ts → contexts/work-package/domain/commands/ (split per command where possible).
  - backend/src/application/commandHandlers/WorkPackageCommandHandler.ts → contexts/work-package/application/commandHandlers/WorkPackageCommandHandler.ts
  - backend/src/application/projections/WorkPackageProjectionPipeline.ts → contexts/work-package/application/projections/pipelines/WorkPackageProjectionPipeline.ts
  - backend/src/infrastructure/persistence/Neo4jEventStore.ts → contexts/work-package/infrastructure/persistence/event-store/WorkPackageEventStore.ts
  - backend/src/infrastructure/persistence/WorkPackageRepository.ts → contexts/work-package/infrastructure/persistence/WorkPackageRepository.ts
  - backend/src/graphql/typeDefs.ts → contexts/work-package/interfaces/graphql/schema.graphql (schema-first).
  - backend/src/graphql/resolvers.ts → contexts/work-package/interfaces/graphql/resolvers/
- Replace direct driver imports in context code with platform/db provider imports; replace RabbitMQ usage with platform/messaging.

4) API composition
- In apps/api/src/graphql/server.ts: compose per-context GraphQL module by importing contexts/work-package/interfaces/graphql module (typeDefs + resolvers + subscriptions).
- Register auth directive and context creation using platform/auth service and AUTHORIZATION_PHASES.md Phase 1 rules.

5) Frontend realignment
- Create apps/web/src/features/work-package and move Work Package UI and GraphQL documents:
  - frontend/src/components/WorkPackageGrid.tsx (if production-worthy) → apps/web/src/features/work-package/components/
  - frontend/src/components/LineItemGrid.tsx (prototype) → spikes/prototypes/LineItemGrid/
  - frontend/src/components/TComp.tsx (prototype) → spikes/prototypes/TComp/
  - frontend/src/components/WorkPackageGrid.stories.tsx + all .stories.tsx → spikes/prototypes/[ComponentName]/.
  - frontend/src/graphql/{mutations,queries}.ts → apps/web/src/features/work-package/graphql/
  - frontend/src/hooks/useCounter.ts (non-domain) stays in apps/web/src/lib or move to feature if domain-related.
- Remove the versioned frontend/storybook-static directory from the repo; add storybook-static to .gitignore.

6) Documentation relocation
- Move docs/WorkPackFeature/* under contexts/work-package/docs (or cross-link from docs/contexts/work-package/).
- Keep ADRs in docs/adr/.

7) CI and quality gates
- Update .github/workflows to run Nx affected: lint, typecheck, test, build.
- Add guard to fail PRs with changes under generated/ (unless job is codegen update) and block storybook-static inclusion.
- Set coverage gates (e.g., 80% min for contexts/work-package/domain and application).

8) Decommission old folders
- backend/src/graphql/* (replaced by per-context interfaces).
- backend/src/index.ts (replaced by apps/api/src/main.ts).
- backend/src/infrastructure/messaging/* (moved to platform).
- backend/src/shared/* (moved to platform/shared equivalents).
- frontend/.storybook may remain if we plan Storybook for a UI library; otherwise park configs under spikes/prototypes/storybook/. All .stories.tsx move to spikes/prototypes.

9) Runbook
- local/docker-compose references apps/api, apps/jobs/*; update service names as needed.
- Seed scripts live under local/seeds/ (context-aware seeds in each context tests/seeds if necessary).

Interim allowances:
- During migration, allow apps/api to import legacy paths until all moves complete; remove after successful cutover.
- Keep a mapping doc in docs/contexts/work-package/migration.md for traceability.

---

## Enforceable Rules

- No contexts/* → contexts/* imports. Cross-context communication via platform/messaging or via API gateway.
- Layer rules (domain → application → infrastructure → interfaces), enforced by ESLint boundaries.
- Domain code is pure: no direct I/O, no platform imports.
- Generated code lives only in generated/ directories; do not import from generated/ in domain/application layers.
- platform/* never imports contexts/*.
- apps/* may import contexts/* interfaces only (e.g., GraphQL module). Apps never import domain or infrastructure directly.
- spikes/* excluded from builds and module boundaries; no production imports allowed from spikes.

---

## Onboarding Essentials

- Install: pnpm i
- Start dev:
  - API: pnpm nx serve api
  - Jobs: pnpm nx serve projection-consumer; pnpm nx serve outbox-publisher
  - Web: pnpm nx serve web
- Tests:
  - All: pnpm nx run-many -t test
  - Work Package integration: pnpm nx test work-package --testPathPattern=integration
- Lint/typecheck: pnpm nx run-many -t lint,typecheck
- Affected (PRs): pnpm nx affected -t lint,typecheck,test,build
- Docs: Read contexts/work-package/README.md for model overview and ports; read docs/adr for decisions

---

## Roadmap Notes

- Additional contexts (authorization, invoicing, procurement, cost-control) will follow the same template under contexts/*. Cost-control can be stubbed and added once domain discovery completes.
- GraphQL federation or subgraph composition can be introduced later (platform/graphql/gateway). For now, apps/api composes modules within the monolith gateway.
- Authorization evolves per AUTHORIZATION_PHASES.md; initial checks wired at interfaces layer using platform/auth service; project-scoped roles and permission matrices can become their own bounded context later.

---

## Appendix: What Goes Where (Cheat Sheet)

- Aggregate or entity? contexts/<ctx>/domain
- Command handler? contexts/<ctx>/application/commandHandlers
- Event store adapter? contexts/<ctx>/infrastructure/persistence/event-store
- Outbox repo? contexts/<ctx>/infrastructure/persistence/outbox
- RabbitMQ connection? platform/messaging
- GraphQL typeDefs + resolvers? contexts/<ctx>/interfaces/graphql
- Apollo server bootstrap? apps/api
- PM dashboard page? apps/web/src/features/<ctx>/pages
- Design tokens? packages/design-tokens
- Shared TS DTOs? packages/shared-types
- Storybook demos or experimental UI? spikes/prototypes
- Generated files? generated/ (under each project’s local generated/ directory)
