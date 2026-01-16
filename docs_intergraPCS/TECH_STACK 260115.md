# Tech Stack


A Domain-Driven Design (DDD) monorepo implementing an event-sourced architecture with CQRS (Command Query Responsibility Segregation). The system uses GraphQL as the API layer, Neo4j for event storage and projections, and React for the frontend.

---

## Monorepo Architecture Overview

This repository implements a **Domain-Driven Design (DDD)** monorepo with **event sourcing** and **CQRS** patterns. The architecture is organized into distinct layers with enforced dependency rules.

### Workspace Structure (pnpm-workspace.yaml)

```yaml
packages:
  - apps/*           # Deployment targets (API gateway, background jobs)
  - contexts/*       # Bounded contexts (domain verticals)
  - platform/*       # Cross-cutting infrastructure services
  - shared/*         # DDD kernel and reusable building blocks
  - packages/*       # Publishable libraries (types, tokens)
  - spikes/*         # Non-production experiments
```

### Dependency Flow

```
┌─────────────────────────────────────────────────────────┐
│                      apps/*                              │
│              (API gateway, jobs, web)                    │
└───────────────────────┬─────────────────────────────────┘
                        │ imports
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   contexts/*                             │
│            (Bounded context interfaces)                  │
├─────────────────────────────────────────────────────────┤
│  interfaces → infrastructure → application → domain      │
└───────────────────────┬─────────────────────────────────┘
                        │ imports
          ┌─────────────┴─────────────┐
          ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐
│     platform/*      │    │      shared/*       │
│ (Runtime services)  │    │   (DDD primitives)  │
└─────────────────────┘    └─────────────────────┘
```

### Layer Rules (Enforced)

| Layer | Can Import |
|-------|------------|
| `domain` | `domain`, `shared/*` |
| `application` | `domain`, `shared/*`, `platform/*` |
| `infrastructure` | `application`, `domain`, `shared/*`, `platform/*` |
| `interfaces` | `application`, `shared/*`, `platform/*` |
| `platform/*` | `shared/*`, other `platform/*` |
| `shared/*` | only `shared/*` |

---

## Monorepo & Build Tools

### Package Management
- **pnpm** (v9.0.0) - Fast, disk space efficient package manager with workspace support

### Build Orchestration
- **Nx** (v19.8.4) - Monorepo build system providing:
  - Project graph and dependency analysis
  - Build caching and parallel execution
  - Module boundary enforcement
  - Affected project detection
  - Task orchestration
- **Nx Plugins**:
  - `@nx/eslint-plugin` (v19.8.4) - ESLint integration
  - `@nx/js` (v19.8.4) - JavaScript/TypeScript support
  - `@nx/node` (v19.8.4) - Node.js application support
  - `@nx/playwright` (v19.8.4) - Playwright E2E testing integration
  - `@nx/react` (v19.8.4) - React application support
  - `@nx/storybook` (v19.8.4) - Storybook integration
  - `@nx/vite` (v19.8.4) - Vite build tool integration

### TypeScript
- **TypeScript** (v5.9.3) - Primary language for both frontend and backend
- **tsconfig** - Strict mode enabled with comprehensive type checking
- **ts-node-dev** - Development server with hot reload for backend

## Backend Stack

### API Framework
- **Apollo Server** (v4.11.0) - GraphQL server implementation
- **Express** (v4.18.3) - HTTP server foundation
- **GraphQL** (v16.11.0) - Query language and runtime

### GraphQL Features
- **@graphql-tools/schema** (v10.0.19) - Schema composition utilities
- **graphql-subscriptions** (v2.0.0) - Real-time subscriptions support
- **graphql-ws** (v5.14.2) - WebSocket transport for subscriptions
- **graphql-redis-subscriptions** (v2.7.0) - Redis-backed PubSub for subscriptions

### Database & Storage
- **Neo4j** (v5-community) - Graph database for:
  - Event store (event sourcing)
  - Read model projections
  - Graph-based queries
- **neo4j-driver** (v5.28.1) - Official Neo4j JavaScript driver

### Message Queue & Event Bus
- **RabbitMQ** (v3.13-management-alpine) - Message broker for:
  - Event bus (inter-context communication)
  - Outbox pattern implementation
  - Asynchronous event processing
- **amqplib** (v0.10.9) - RabbitMQ client library

### Caching & PubSub
- **Redis** (v7-alpine) - In-memory data store for:
  - GraphQL subscription PubSub
  - Token blacklisting
  - Rate limiting
  - User activity tracking
- **ioredis** (v5.6.1) - Redis client

### Authentication & Security
- **jsonwebtoken** (v9.0.2) - JWT token generation and verification
- **bcrypt** (v6.0.0) - Password hashing
- **helmet** (v8.0.0) - Security headers middleware
- **cors** (v2.8.5) - Cross-Origin Resource Sharing
- **express-rate-limit** (v7.4.1) - Rate limiting middleware
- **rate-limit-redis** (v4.2.0) - Redis-backed rate limiting

### Logging & Observability
- **pino** (v9.8.0) - Fast, structured JSON logger

### Utilities
- **uuid** (v11.1.0) - UUID generation
- **dotenv** (v16.5.0) - Environment variable management
- **ws** (v8.18.1) - WebSocket implementation
- **tsconfig-paths** (v4.2.0) - TypeScript path mapping resolution (used in backend dev server)
- **chalk** (v5.4.1) - Terminal string styling for build scripts

### Testing
- **Jest** (v29.7.0) - Test framework
- **ts-jest** (v29.3.4) - TypeScript preprocessor for Jest

## Frontend Stack

### Core Framework
- **React** (v19.0.0) - UI library
- **React DOM** (v19.0.0) - React renderer

### Build Tool
- **Vite** (v6.3.1) - Next-generation frontend build tool
  - Fast HMR (Hot Module Replacement)
  - Optimized production builds
  - Code splitting and tree shaking

### Routing
- **react-router-dom** (v7.6.2) - Client-side routing

### State Management
- **Apollo Client** (v3.11.0) - GraphQL client with:
  - Caching
  - Subscriptions support
  - Optimistic updates
- **Zustand** (v4.5.4) - Lightweight state management
- **TanStack Query** (v5.51.1) - Server state management
- **TanStack Query Devtools** (v5.51.1) - Development tools

### UI Component Library
- **shadcn/ui** - Component architecture pattern (not a dependency, but a design system approach)
  - Built on top of Radix UI primitives
  - Uses Tailwind CSS for styling
  - Component variants managed via `class-variance-authority` (CVA)
  - Utility function `cn()` for conditional class merging (clsx + tailwind-merge)
  - Components are copied into the project (not installed as dependencies)
  - Custom components built following shadcn/ui patterns:
    - Button (with variants: primary, secondary, ghost, destructive, outline)
    - Badge (with variants: neutral, brand, inverse)
    - Card (with padding variants)
    - Input (with size and validation variants)
    - Table (with density, borders, and interaction variants)
    - Grid components (LineItemGrid, WorkPackageGrid)
- **Radix UI** - Headless, accessible component primitives (used as foundation for shadcn/ui components):
  - `@radix-ui/react-accordion` (v1.2.11)
  - `@radix-ui/react-alert-dialog` (v1.1.14)
  - `@radix-ui/react-avatar` (v1.1.10)
  - `@radix-ui/react-checkbox` (v1.3.2)
  - `@radix-ui/react-collapsible` (v1.1.11)
  - `@radix-ui/react-dialog` (v1.1.14)
  - `@radix-ui/react-dropdown-menu` (v2.1.15)
  - `@radix-ui/react-icons` (v1.3.2)
  - `@radix-ui/react-label` (v2.1.7)
  - `@radix-ui/react-popover` (v1.1.14)
  - `@radix-ui/react-progress` (v1.1.7)
  - `@radix-ui/react-radio-group` (v1.3.7)
  - `@radix-ui/react-scroll-area` (v1.2.9)
  - `@radix-ui/react-select` (v2.2.5)
  - `@radix-ui/react-separator` (v1.1.7)
  - `@radix-ui/react-slot` (v1.2.3)
  - `@radix-ui/react-switch` (v1.2.5)
  - `@radix-ui/react-tabs` (v1.1.12)
  - `@radix-ui/react-tooltip` (v1.2.7)

### Styling
- **Tailwind CSS** (v4.0.0) - Utility-first CSS framework
- **@tailwindcss/postcss** (v4.0.0) - PostCSS plugin
- **tailwindcss-animate** (v1.0.7) - Animation utilities
- **tailwind-merge** (v3.3.0) - Merge Tailwind classes (used in `cn()` utility for shadcn/ui)
- **class-variance-authority** (v0.7.1) - Component variant management (CVA) for shadcn/ui-style components
- **clsx** (v2.1.1) - Conditional class names (used in `cn()` utility for shadcn/ui)
- **PostCSS** (v8.5.3) - CSS processing
- **Autoprefixer** (v10.4.21) - CSS vendor prefixing

**shadcn/ui Utilities:**
- `cn()` function (`frontend/src/lib/cn.ts`) - Combines clsx and tailwind-merge for conditional class merging
- `cva.ts` (`frontend/src/lib/cva.ts`) - Pre-defined component variants using CVA:
  - Button variants (primary, secondary, ghost, destructive, outline)
  - Badge variants (neutral, brand, inverse)
  - Card, Panel, Input, Table, Grid, Toolbar, Footer variants
  - All variants constrained to design token palette (no arbitrary values)

### Forms
- **react-hook-form** (v7.57.0) - Form state management
- **@hookform/resolvers** (v5.1.1) - Validation resolvers
- **zod** (v3.25.56) - Schema validation

### Data Visualization & Tables
- **TanStack Table** (v8.21.3) - Headless table library
- **vis-timeline** (v7.7.4) - Timeline visualization
- **vis-data** (v7.1.9) - Data utilities for vis.js
- **dagre** (v0.8.5) - Graph layout algorithm

### Date & Time
- **date-fns** (v4.1.0) - Date utility library (primary)
- **moment** (v2.30.1) - Legacy date library (being phased out in favor of date-fns)

### UI Utilities
- **prop-types** (v15.8.1) - Runtime type checking for React (TypeScript is primary, but prop-types used for additional validation)
- **lucide-react** (v0.513.0) - Icon library
- **cmdk** (v1.1.1) - Command menu component
- **react-toastify** (v11.0.5) - Toast notifications
- **lodash** (v4.17.21) - Utility functions

### Testing
- **Vitest** (v3.1.3) - Fast unit test framework
- **@vitest/ui** (v3.1.3) - Vitest UI
- **@vitest/coverage-v8** (v3.1.3) - Code coverage
- **Playwright** (v1.52.0) - End-to-end testing
- **@testing-library/react** (v16.0.0) - React testing utilities
- **@testing-library/dom** (v10.4.0) - DOM testing utilities (foundation for @testing-library/react)
- **@testing-library/jest-dom** (v6.4.8) - DOM matchers
- **@testing-library/user-event** (v14.6.1) - User interaction simulation
- **happy-dom** (v20.0.7) - DOM implementation for testing
- **jsdom** (v24.1.1) - Alternative DOM implementation

### Storybook
- **Storybook** (v8.3.0) - Component development environment
- **@storybook/react-vite** (v8.3.0) - Vite integration
- **@storybook/addon-essentials** (v8.3.0) - Essential addons
- **@storybook/addon-interactions** (v8.3.0) - Interaction testing
- **@storybook/test** (v8.3.0) - Testing utilities
- **Chromatic** (v11.5.5) - Visual regression testing

## Infrastructure & Services

### Containerization
- **Docker Compose** - Local development environment orchestration
### Services (via Docker Compose)
- **Neo4j** (v5-community) - Graph database
  - Ports: 7474 (Browser), 7687 (Bolt)
  - APOC plugin enabled
- **Redis** (v7-alpine) - Caching and PubSub
  - Port: 6379
- **RabbitMQ** (v3.13-management-alpine) - Message broker
  - Ports: 5672 (AMQP), 15672 (Management UI)

---

## DDD Building Blocks

The `shared/` directory contains the DDD kernel and reusable patterns that all bounded contexts depend on.

### shared/kernel

Core DDD tactical patterns implemented as TypeScript base classes.

| Class | Purpose | Location |
|-------|---------|----------|
| `Entity<TProps>` | Base class for entities with identity | `shared/kernel/src/Entity.ts` |
| `AggregateRoot<TProps>` | Entity subclass managing domain events | `shared/kernel/src/AggregateRoot.ts` |
| `ValueObject<T>` | Immutable value objects with structural equality | `shared/kernel/src/ValueObject.ts` |

**Key Features:**
- `AggregateRoot` collects domain events via `addDomainEvent()` and exposes them via `domainEvents` getter
- `clearEvents()` for post-publish cleanup
- `Entity` provides identity-based equality via `equals()`
- `ValueObject` provides deep structural equality via JSON comparison

### shared/patterns

Port interfaces defining contracts for infrastructure adapters (hexagonal architecture).

| Interface | Purpose | Methods |
|-----------|---------|---------|
| `EventStorePort<TEvent>` | Event sourcing storage | `load(streamId)`, `append(streamId, events)` |
| `ProjectionSinkPort<TDoc>` | Read model persistence | `upsert(id, doc)` |
| `OutboxPort<TEvent, TMeta>` | Transactional outbox | `append(streamId, events, metadata?)` |
| `MessagingPort<TEvent>` | Event bus publishing | `publish(streamId, events)` |
| `PubSubPort<TPayload>` | Real-time subscriptions | `publish(topic, payload)` |

### shared/common

Pure utility functions (no I/O, no side effects).

| Module | Purpose |
|--------|---------|
| `id.ts` | UUID generation utilities |
| `dates.ts` | Date manipulation helpers |
| `errors.ts` | Base error classes |

---

## Platform Services

The `platform/` directory contains cross-cutting runtime services. **Platform never imports contexts** - contexts consume platform via dependency injection.

### platform/auth
- **Purpose:** JWT authentication and authorization
- **Exports:** `SimpleAuthService`
- **Used by:** GraphQL context, API middleware

### platform/config
- **Purpose:** Environment variable management
- **Exports:** `env` (typed environment configuration)
- **Pattern:** Centralized config with validation

### platform/db
- **Purpose:** Neo4j driver lifecycle management
- **Exports:** Driver initialization, health checks
- **Used by:** Event store adapters, projection repositories

### platform/graphql
- **Purpose:** Shared GraphQL utilities
- **Exports:** `baseSchema` (common scalars, directives)
- **Used by:** Context-specific GraphQL modules

### platform/messaging
- **Purpose:** RabbitMQ connection management
- **Exports:** `RabbitMQService`
- **Features:** Connection pooling, channel management, topology setup

### platform/observability
- **Purpose:** Structured logging
- **Exports:** `logger` (pino-based)
- **Features:** JSON logging, log levels, context tracking

### platform/security
- **Purpose:** HTTP security middleware
- **Exports:**
  - `corsMiddleware` / `corsOptions` - CORS configuration
  - `rateLimiter` - Rate limiting with Redis backend
  - `security` - Helmet-based security headers

---

## Bounded Contexts

Each bounded context is a vertical slice implementing DDD layers with strict dependency rules.

### contexts/work-package

The Work Package bounded context manages work package lifecycle (scheduling, tasks, progress tracking).

**Structure:**
```
contexts/work-package/
├── src/
│   ├── domain/                    # Pure domain logic
│   │   ├── WorkPackageAggregate.ts
│   │   ├── Task.ts
│   │   ├── commands/              # Command DTOs
│   │   │   └── Commands.ts
│   │   └── events/                # Domain event types
│   │       └── DomainEvents.ts
│   │
│   ├── application/               # Use cases
│   │   ├── commandHandlers/
│   │   │   └── WorkPackageCommandHandler.ts
│   │   └── projections/
│   │       └── WorkPackageProjectionPipeline.ts
│   │
│   ├── infrastructure/            # Adapter implementations
│   │   └── persistence/
│   │       ├── event-store/
│   │       │   └── Neo4jEventStore.ts
│   │       └── projections/
│   │           └── WorkPackageRepository.ts
│   │
│   └── interfaces/                # External ports (GraphQL, consumers)
│       └── graphql/
│           └── index.ts
```

**Implements:**
- Event sourcing with Neo4j event store
- CQRS with separate command handlers and projections
- Ports and adapters (hexagonal architecture)

---

## Deployment Apps

The `apps/` directory contains deployable applications and background jobs.

### apps/api

**Purpose:** GraphQL API gateway
**Entry:** `apps/api/src/main.ts`
**Features:**
- Apollo Server with Express
- Composes GraphQL modules from all contexts
- HTTP + WebSocket (subscriptions) support
- Middleware: CORS, rate limiting, security headers

### apps/jobs/outbox-publisher

**Purpose:** Transactional outbox worker
**Entry:** `apps/jobs/outbox-publisher/src/main.ts`
**Flow:**
1. Polls outbox table for unpublished events
2. Publishes to RabbitMQ
3. Marks events as published

### apps/jobs/projection-consumer

**Purpose:** Event projection consumer
**Entry:** `apps/jobs/projection-consumer/src/main.ts`
**Flow:**
1. Consumes events from RabbitMQ
2. Updates read model projections (Neo4j)
3. Bridges to GraphQL PubSub for subscriptions

---

## TypeScript Path Aliases

Defined in `tsconfig.base.json` for clean imports across the monorepo.

| Alias | Target | Example Import |
|-------|--------|----------------|
| `@platform/*` | `platform/*/src` | `import { logger } from '@platform/observability'` |
| `@shared/*` | `shared/*/src` | `import { AggregateRoot } from '@shared/kernel'` |
| `@contexts/*` | `contexts/*/src` | `import { WorkPackageAggregate } from '@contexts/work-package'` |
| `@contexts/work-package/*` | `contexts/work-package/src/*` | `import { Commands } from '@contexts/work-package/domain/commands'` |
| `@integrapcs/shared-types` | `packages/shared-types/src/index.ts` | `import type { WorkPackageDTO } from '@integrapcs/shared-types'` |
| `@integrapcs/design-tokens` | `packages/design-tokens/src/index.ts` | CSS token imports |

**Note:** These aliases are resolved by:
- TypeScript compiler (`tsconfig.base.json`)
- Vite (`vite.config.ts` resolve.alias)
- Jest (`jest.config.js` moduleNameMapper)
- `tsconfig-paths` for runtime Node.js execution

## Code Quality & Linting

### Linting
- **ESLint** (v9.22.0) - JavaScript/TypeScript linter
- **@typescript-eslint/parser** (v8.34.0) - TypeScript parser
- **@typescript-eslint/eslint-plugin** (v8.34.0) - TypeScript rules
- **eslint-plugin-import** (v2.32.0) - Import/export linting
- **eslint-plugin-react-hooks** (v5.2.0) - React Hooks rules
- **eslint-plugin-react-refresh** (v0.4.19) - React Fast Refresh
- **eslint-plugin-jsx-a11y** (v6.8.0) - Accessibility linting
- **eslint-plugin-prettier** (v5.1.3) - Prettier integration
- **eslint-config-prettier** (v9.1.0) - Disable conflicting rules
- **eslint-import-resolver-node** (v0.3.9) - Node.js import resolution for eslint-plugin-import
- **eslint-import-resolver-typescript** (v4.4.4) - TypeScript import resolution for eslint-plugin-import
- **globals** (v16.0.0) - Global variable definitions for ESLint flat config

### Formatting
- **Prettier** (v3.3.2) - Code formatter
- **prettier-plugin-tailwindcss** (v0.6.11) - Tailwind class sorting

### CSS Linting
- **Stylelint** (v16.9.0) - CSS linter
- **stylelint-config-recommended** (v14.0.0) - Recommended rules
- **stylelint-config-tailwindcss** (v1.0.0) - Tailwind-specific rules

### Git Hooks
- **Husky** (v9.1.4) - Git hooks manager
- **lint-staged** (v15.2.7) - Run linters on staged files

## Shared Packages

### Design System
- **@integrapcs/design-tokens** - CSS design tokens (Tailwind v4 compatible)
  - Color palette
  - Typography scale
  - Spacing system
  - Shadow definitions

### Type Definitions
- **@integrapcs/shared-types** - Shared TypeScript types
  - GraphQL types
  - Domain types
  - Event types
  - DTOs

## Architecture Patterns

### Domain-Driven Design (DDD)
- Bounded contexts
- Aggregates, entities, value objects
- Domain events
- Ports and adapters

### Event Sourcing
- Event store (Neo4j)
- Event replay
- Projection building

### CQRS (Command Query Responsibility Segregation)
- Separate command and query models
- Read model projections
- Command handlers

### GraphQL
- Schema-first development
- Resolvers per bounded context
- Subscriptions for real-time updates
- Code generation

---

## Development Workflow

### Node.js Version Management

- **Required Version:** Node.js 20.11.0+ (LTS)

**Version Specification Files:**

| File | Version | Purpose |
|------|---------|---------|
| `.nvmrc` | `20.11.0` | nvm version switching |
| `.node-version` | `20.11.0` | asdf/nodenv/mise |
| `package.json` engines | `>=20` | npm/pnpm enforcement |

**CI Versions:**

| Workflow | Version | Reason |
|----------|---------|--------|
| Main CI (`ci.yml`) | `20` (latest 20.x) | Uses matrix strategy, gets latest patch |
| Chromatic (`chromatic.yml`) | `20.19.0` | Pinned for visual regression consistency |

**Why 20.11.0+:**
- ES2023 library support
- Native `fetch` API (no polyfills needed)
- Stable Husky hooks
- Nx 19.8.4 compatibility (Node 21.x/22.x may have issues)
- `engine-strict=true` in `.npmrc` enforces version

**Corepack:** Used in CI for pnpm version management (`pnpm@9.1.0`)

### Package Manager
- **pnpm** (v9.0.0) - Primary package manager

### Development Commands
- `pnpm install` - Install dependencies
- `pnpm nx serve api` - Start API server
- `pnpm nx serve web` - Start web app
- `pnpm nx run-many -t serve --projects=api,web --parallel` - Start all apps
- `pnpm nx test web` - Run frontend tests
- `pnpm nx e2e web` - Run E2E tests
- `pnpm nx run web:storybook` - Start Storybook

### Quality Gates
- `pnpm nx affected -t lint` - Lint affected projects
- `pnpm nx affected -t typecheck` - Type check affected projects
- `pnpm run format:check` - Check code formatting
- `pnpm run check:tailwind` - Validate Tailwind usage

---

## CI/CD

### GitHub Actions Workflows

#### CI Workflow (`.github/workflows/ci.yml`)

Triggered on push/PR to `main` and `develop` branches.

| Job | Purpose | Strategy |
|-----|---------|----------|
| **security** | `pnpm audit --audit-level=high`, outdated check | Sequential |
| **quality** | Lint, format, typecheck, tailwind guard | Matrix: 4 parallel jobs |
| **unit-tests** | Vitest (web), Jest (api) | Matrix: `api`, `web` |
| **integration-tests** | Tests with Neo4j, Redis, RabbitMQ services | Sequential, service containers |
| **e2e-tests** | Playwright browser tests | Sequential |
| **build** | Production build verification | Depends on: quality, unit-tests |

**Job Details:**

1. **security** - Runs `pnpm audit --audit-level=high` and checks for outdated dependencies
2. **quality** - Matrix job running 4 checks in parallel:
   - `lint`: `pnpm nx affected -t lint --parallel`
   - `format`: `pnpm run format:check`
   - `typecheck`: `pnpm nx affected -t typecheck --parallel`
   - `tailwind`: `pnpm run check:tailwind`
3. **unit-tests** - Matrix job for `api` and `web` workspaces with coverage upload to Codecov
4. **integration-tests** - Runs tests matching `integration` pattern with service containers:
   - Neo4j 5-community (ports 7687, 7474)
   - Redis 7-alpine (port 6379)
   - RabbitMQ 3.13-management-alpine (ports 5672, 15672)
5. **e2e-tests** - Playwright tests with browser caching, uploads reports/traces on failure
6. **build** - Builds all projects, caches Vite output, uploads artifacts (7 days retention)

**Artifacts:**
- Coverage reports → Codecov
- Playwright reports/traces → GitHub artifacts (30 days)
- Build artifacts → GitHub artifacts (7 days)

#### Chromatic Workflow (`.github/workflows/chromatic.yml`)

**Purpose:** Visual regression testing for Storybook
- Triggered on push to `main` and all PRs
- Publishes Storybook to Chromatic
- Node.js 20.19.0 (pinned for consistency)
- Uses `onlyChanged: true` for incremental testing

### Renovate Bot

Automated dependency updates configured in `renovate.json`:

| Setting | Value |
|---------|-------|
| **Schedule** | Weekly (Mondays before 6am) |
| **Auto-merge** | Minor/patch after 3 days minimum age |
| **Manual review** | Major updates, critical dependencies |
| **Grouping** | DevDependencies, Radix UI, ESLint packages |
| **Vulnerability alerts** | Enabled |

**Critical Dependencies (manual review required):**
- TypeScript, React, React DOM
- Apollo Server, Apollo Client, GraphQL
- Neo4j driver, ioredis, amqplib

### Quality Checks (CI Pipeline)
- Type checking (`tsc --noEmit`)
- Linting (ESLint, Stylelint)
- Format checking (Prettier)
- Tailwind arbitrary value guard
- Unit tests (Vitest, Jest)
- Integration tests (with service containers)
- E2E tests (Playwright)
- Visual regression tests (Chromatic)

---

## Additional Tools

### Build & Development Scripts
- **glob** (v11.0.3) - File pattern matching utility (used in build scripts)
- **Custom Node.js scripts** (`scripts/` directory):
  - `check-tailwind-arbitrary.mjs` - Validates Tailwind usage (blocks arbitrary values)
  - `generate-token-demos.mjs` - Generates design token documentation
  - `copy-design-tokens.mjs` - Copies design tokens during build
  - `link-runtime-aliases.mjs` - Links runtime path aliases
  - `clean-stray-compiled.mjs` - Cleans stray compiled files
  - `check-staged-ts-require.mjs` - Validates TypeScript files (blocks `require()`)
  - `add-clean-targets.mjs` - Maintenance script for Nx clean targets

### Documentation
- Markdown files in `docs/`
- Architectural Decision Records (ADRs)
- Storybook for component documentation

### Monitoring & Observability
- Structured logging (Pino)
- Metrics (planned)
- Tracing (planned)

---

## Version Information

This document reflects the tech stack as of the current repository state. For specific version numbers, refer to:
- Root `package.json`
- `apps/*/package.json`
- `packages/*/package.json`
- `backend/package.json`
- `frontend/package.json`

---

## Notes

- The project is migrating from a traditional structure to a DDD monorepo architecture
- Some legacy dependencies may be present during the migration
- Tailwind CSS v4 is being used with design tokens
- The project enforces strict TypeScript configuration
- Module boundaries are enforced via Nx and ESLint rules
- **shadcn/ui** patterns are used for component architecture, but components are custom-built to enforce design token constraints (no arbitrary Tailwind values)
- Component variants are defined in `frontend/src/lib/cva.ts` using `class-variance-authority`
