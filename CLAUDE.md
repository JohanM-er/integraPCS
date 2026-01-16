# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

integraPCS is an Nx monorepo containing a GraphQL backend with event sourcing and a React frontend. The architecture follows Domain-Driven Design with vertical slice organization.

## Build Commands

```bash
# Install dependencies (pnpm required)
pnpm install

# Start infrastructure (Neo4j, Redis, RabbitMQ)
docker-compose up -d

# Development - serve all apps
pnpm nx run-many -t serve --projects=api,web --parallel
# Or use the script:
./dev-start.sh

# Build all projects
pnpm nx run-many -t build

# Build specific project
pnpm nx build api
pnpm nx build @integrapcs/shared-types

# Type checking
pnpm nx run-many -t typecheck
pnpm nx affected -t typecheck

# Linting
pnpm nx run-many -t lint
pnpm nx affected -t lint

# Format
pnpm run format        # Fix formatting
pnpm run format:check  # Check only

# Tailwind arbitrary value scan
pnpm run check:tailwind
```

## Testing Commands

```bash
# Unit tests (Vitest for frontend)
pnpm nx test web

# Single test file (frontend)
cd frontend && pnpm vitest run path/to/file.test.ts

# E2E tests (Playwright)
pnpm nx e2e web
cd frontend && pnpm test:e2e:ui   # Interactive mode

# Storybook
cd frontend && pnpm storybook
```

## Architecture

### Workspace Layout (pnpm + Nx)

```
apps/           # Deployable applications
  api/          # GraphQL API gateway (compiles to dist/apps/api/)
  jobs/         # Background job runners
contexts/       # Bounded contexts (DDD)
  work-package/ # WorkPackage aggregate with CQRS + Event Sourcing
platform/       # Cross-cutting infrastructure
  auth/         # Authentication
  db/           # Database adapters
  graphql/      # GraphQL utilities
  messaging/    # RabbitMQ adapters
  observability/# Logging/monitoring
  security/     # Security utilities
shared/         # Pure utilities
  kernel/       # Base domain primitives
  patterns/     # Shared patterns (ports)
  common/       # Common utilities
packages/       # Published packages
  design-tokens/# Tailwind v4 theme tokens (CSS)
  shared-types/ # TypeScript interfaces shared between frontend/backend
backend/        # Legacy backend (being migrated to apps/api)
frontend/       # React app (being migrated to apps/web)
```

### Path Aliases (tsconfig.base.json)

- `@platform/*` → `platform/*/src`
- `@shared/*` → `shared/*/src`
- `@contexts/*` → `contexts/*/src`
- `@integrapcs/shared-types` → `packages/shared-types/src`
- `@integrapcs/design-tokens` → `packages/design-tokens/src`

### Bounded Context Structure (contexts/work-package example)

```
domain/       # Aggregates, Events, Commands (pure, no I/O)
application/  # Command handlers, projection pipelines
infrastructure/# Event store adapters, projections
interfaces/graphql/# Schema and resolvers
```

Dependency rule: domain → application → infrastructure → interfaces

### Event Sourcing Pattern

- All state changes are immutable DomainEvent records appended to event streams
- Neo4j is the event store: `(:Aggregate { id })` with `(:Event)` linked by `[:HAS_EVENT]`
- Optimistic concurrency via expected version checks
- Outbox pattern: events published to RabbitMQ after successful append
- Projections build read models from events

### Frontend Stack

- React 19 + Vite 6
- Apollo Client (HTTP + WebSocket split for subscriptions)
- Tailwind CSS v4 with `@theme` CSS tokens
- Radix UI primitives
- React Hook Form + Zod

## Key Conventions

### Tailwind CSS

- Design tokens defined in `packages/design-tokens/src/tokens.css` using `@theme`
- **No arbitrary values allowed** (e.g., `p-[13px]`, `text-[#333]`) - blocked by pre-commit and CI
- Use design system utilities: `bg-brand-500`, `text-neutral-900`, spacing `{1-6}`, `rounded-2`, `shadow-1`

### Code Style

- Prettier: 2-space tabs, single quotes, no trailing commas
- Tailwind class ordering via `prettier-plugin-tailwindcss`
- ESLint enforces DDD layer boundaries via `@nx/enforce-module-boundaries`
- Naming: PascalCase for types/interfaces, camelCase for variables, UPPER_CASE for enum members

### Testing

- Co-locate specs as `*.test.ts` or `*.spec.ts`
- Husky blocks commits with `.only` or missing `describe`/`it`

## Infrastructure Services

Docker Compose provides:
- **Neo4j**: `bolt://localhost:7687` (neo4j/password123), Browser at `:7474`
- **Redis**: `localhost:6379`
- **RabbitMQ**: `localhost:5672`, Management UI at `:15672` (scheduler/password123)

## Environment Variables

Backend (`.env`):
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
- `RABBITMQ_URL`, `REDIS_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`

Frontend (`.env`):
- `VITE_GRAPHQL_HTTP=http://localhost:3000/graphql`
- `VITE_GRAPHQL_WS=ws://localhost:3000/graphql`

Node.js 20+ required.
