# integraPCS – Monorepo Migration Summary (Nx + pnpm + DDD)

This document summarizes the migration from the legacy npm workspaces to an Nx + pnpm monorepo with a DDD-first structure. It includes a legacy cleanup checklist, validation commands, a high‑level directory overview, key changes, and suggested next steps.

## 1) Legacy Cleanup Checklist

Delete the following legacy artifacts from the repository (all functionality has been moved under apps/, contexts/, platform/, shared/, and packages/):

- backend/ (entire directory)
- frontend/ (entire directory)
- frontend/storybook-static/ (any checked-in Storybook builds)
- package-lock.json (replaced by pnpm-lock.yaml)
- Any other obsolete root or subproject artifacts tied to the old structure, for example:
  - Old build outputs under dist/ inside backend/ or frontend/
  - Old .eslintcache, .stylelintcache files under backend/ or frontend/
  - Any other temporary or cache folders under legacy paths

Tip: To remove in a single commit:
- git rm -r backend frontend
- git rm -r --cached frontend/storybook-static || true
- git rm package-lock.json || true

Confirm .gitignore includes:
- .nx/
- generated/
- **/generated/
- storybook-static/
- **/storybook-static/


## 2) Validation Checklist

Run these commands from the repository root to verify the workspace end-to-end:

- Install dependencies:
  - pnpm install

- Visualize dependencies:
  - pnpm nx graph

- Typecheck all projects:
  - pnpm nx run-many -t typecheck

- Build all projects:
  - pnpm nx run-many -t build

- Start API gateway (GraphQL):
  - pnpm nx serve api
  - Visit http://localhost:3000/graphql

- Start Web app (Vite):
  - pnpm nx serve web
  - Visit http://localhost:5173

- Run unit tests (web):
  - pnpm nx test web

- Run end-to-end tests (web):
  - pnpm nx e2e web

- Tailwind guard (scan apps/web/src for arbitrary values):
  - pnpm run check:tailwind

- Formatting check:
  - pnpm run format:check


## 3) New Workspace Structure Overview

High-level layout of the Nx + pnpm monorepo:

/
├─ apps/
│  ├─ api/                      # GraphQL API gateway (Apollo + graphql-ws)
│  │  ├─ src/
│  │  │  ├─ graphql/
│  │  │  └─ main.ts
│  │  ├─ project.json
│  │  └─ tsconfig*.json
│  ├─ web/                      # React 19 + Vite app (feature-sliced)
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ features/
│  │  │  │  └─ work-package/
│  │  │  ├─ lib/
│  │  │  └─ styles/
│  │  ├─ tests/  e2e/  .storybook/
│  │  ├─ project.json
│  │  └─ tsconfig*.json
│  └─ jobs/
│     ├─ outbox-publisher/      # Worker stub
│     └─ projection-consumer/   # Worker stub
│
├─ contexts/
│  └─ work-package/             # DDD bounded context (CQRS + ES)
│     ├─ domain/
│     ├─ application/
│     ├─ infrastructure/
│     └─ interfaces/
│        └─ graphql/
│           └─ generated/
│
├─ platform/                    # Runtime services (no domain logic)
│  ├─ auth/  ├─ config/  ├─ db/
│  ├─ graphql/  ├─ messaging/
│  ├─ observability/  └─ security/
│
├─ shared/                      # DDD building blocks + ports (pure)
│  ├─ kernel/    # Entity, AggregateRoot, ValueObject
│  ├─ patterns/  # Ports (EventStore, Outbox, ProjectionSink, etc.)
│  └─ common/    # Pure utilities (ids, dates, errors)
│
├─ packages/                    # Internal libs
│  ├─ design-tokens/            # Tailwind v4 tokens
│  └─ shared-types/             # Shared TypeScript DTOs
│
├─ spikes/                      # Non-production experiments/demos
│  └─ prototypes/
│
├─ scripts/                     # Repo tooling (e.g., Tailwind guard)
│
├─ .github/workflows/           # CI pipelines (pnpm + Nx)
├─ nx.json                      # Nx workspace config
├─ pnpm-workspace.yaml          # pnpm workspaces
├─ tsconfig.base.json           # Path aliases and TS base
├─ eslint.config.js             # Module boundary enforcement
├─ MIGRATION_SUMMARY.md         # This document
└─ docs/                        # Documentation (architecture, runbooks, etc.)


## 4) Key Changes Summary

- Package manager:
  - npm → pnpm
  - Lockfile: package-lock.json → pnpm-lock.yaml

- Orchestration:
  - npm workspaces → Nx
  - Use pnpm nx ... commands for build/test/lint/typecheck/serve

- Backend (GraphQL + CQRS/ES):
  - Old: backend/
  - New:
    - apps/api (gateway/bootstrap)
    - contexts/work-package (domain/application/infrastructure/interfaces)
    - platform/* (auth, config, db, graphql, messaging, observability, security)
    - shared/* (kernel primitives and ports)

- Frontend (React + Vite):
  - Old: frontend/
  - New: apps/web/ (feature-sliced; Work Package feature aligns with contexts/work-package)

- Commands:
  - npm run ... → pnpm nx ...
  - Examples:
    - pnpm nx serve api
    - pnpm nx serve web
    - pnpm nx run-many -t build
    - pnpm nx affected -t lint,typecheck,test,build


## 5) Next Steps

- Delete legacy folders:
  - Remove backend/ and frontend/, and any leftover artifacts (storybook-static/, package-lock.json).
  - Commit the cleanup.

- Commit the migration:
  - Ensure pnpm-lock.yaml is up to date.
  - Commit with a clear message noting Nx + pnpm migration and DDD structure adoption.

- Update internal documentation:
  - Share this MIGRATION_SUMMARY.md and Project_Structure.md with the team.
  - Update onboarding docs and runbooks to reference pnpm + Nx commands and new paths.
  - Confirm CI pipelines reference pnpm and Nx targets.

- Tighten quality gates:
  - Consider raising coverage thresholds after initial stabilization.
  - Add per-context integration tests (event store append, projections, resolvers) as you grow the bounded context.

- Use pnpm nx affected in CI:
  - For PRs, prefer: pnpm nx affected -t lint,typecheck,test,build to scope executions to changed projects.

If any discrepancies are found during validation, run pnpm install to refresh the lockfile, then re-run typecheck and builds across all projects.