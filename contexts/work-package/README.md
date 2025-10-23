# Work Package Bounded Context

Purpose
- Manage Work Package lifecycle with a CQRS + Event Sourcing approach.
- This context defines the WorkPackage aggregate, commands, domain events, and read-side projection pipeline.

Layers
- domain/: Aggregate, Entities, Commands, Events (pure, no I/O).
- application/: Command handlers and projection pipelines (use ports).
- infrastructure/: Adapters implementing ports (event store, projections).
- interfaces/graphql/: GraphQL schema and resolvers (transport boundary).

Dependencies
- domain → application → infrastructure → interfaces
- domain imports only @shared/kernel and @shared/common (pure).
- application imports domain + @shared/patterns (ports).
- infrastructure imports application/domain/@shared/patterns and may import @platform/*.
- interfaces imports application/@shared/patterns/@platform/graphql, not domain directly.

Composition
- Exported GraphQL module (interfaces/graphql) provides:
  - `typeDefs`: SDL extending base Query and defining Mutation + types
  - `resolvers`: Field resolvers using in-memory event store and projection repo (POC)

Generated Code Policy
- All codegen output for this context must live under interfaces/graphql/generated/.
- Do not import generated code from domain or application layers.