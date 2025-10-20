# integraPCS Backend (GraphQL + Event Sourcing)

Overview
- GraphQL API using Apollo Server 4 on Express
- Event-sourced domain with Neo4j-backed event store and outbox to RabbitMQ
- Real-time subscriptions powered by graphql-ws and Redis PubSub
- Vertical slice architecture centered on the Work Package context

Key Technologies
- GraphQL: Apollo Server 4, graphql-ws for subscriptions
- Database: Neo4j 5 (bolt)
- Messaging: RabbitMQ (AMQP 0-9-1)
- PubSub: Redis (ioredis + graphql-redis-subscriptions)
- Logging: Pino

Vertical Slice Architecture
- Focus on feature isolation and clear boundaries:
  backend/
    src/
      workPackageContext/
        domain/            # Aggregates, Events, Commands (pure domain)
        application/       # Command handlers, projections
        infrastructure/    # Event store adapters (Neo4j), outbox publisher (RabbitMQ)
        api/               # GraphQL schema and resolvers (SDL + resolvers)
      shared/              # Logger, common utilities
      index.ts             # Server bootstrap (HTTP + WS)

Event Sourcing Pattern
- All state changes are captured as immutable DomainEvent records appended to the event stream.
- Neo4j serves as the event store:
  - Nodes: (:Aggregate { id }) with (:Event { id, type, data, version, ts }) linked by [:HAS_EVENT].
  - Optimistic concurrency enforced via expected version checks during append.
- Outbox pattern:
  - After successful append, events are emitted to RabbitMQ for projections and cross-service communication.
- Projections:
  - Read models are built from events (either inline or via a consumer) and optimized for GraphQL queries.

GraphQL API
- HTTP endpoint: /graphql
- Subscriptions: ws://localhost:3000/graphql using the graphql-ws protocol
- CORS: Allows http://localhost:5173 during development
- Context:
  - Injects Neo4j driver/session, EventStore adapter, Redis PubSub, and logger.

Environment Configuration
- Copy .env.example to .env and adjust values as needed.
- Important variables:
  GRAPHQL_PORT=3000
  GRAPHQL_PATH=/graphql
  SUBSCRIPTIONS_PATH=/graphql
  FRONTEND_ORIGIN=http://localhost:5173
  NEO4J_URI=bolt://localhost:7687
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=password123
  RABBITMQ_URL=amqp://scheduler:password123@localhost:5672/
  REDIS_URL=redis://localhost:6379
  JWT_SECRET=your-secret-key-min-36-characters-change-in-production
  JWT_EXPIRES_IN=7d
  LOG_LEVEL=debug

Development Quick Start
- From repository root:
  1) Start infrastructure: docker-compose up -d
  2) Build shared types: cd packages/shared-types && npm run build
  3) Start backend: cd backend && npm run dev
  4) Start frontend: cd frontend && npm run dev
- Alternatively, run ./dev-start.sh from the repo root to orchestrate dev servers.

Notes
- Ensure Redis is running for subscription scalability. For local single-instance dev, you can still use Redis locally via docker-compose.
- Make sure the FRONTEND_ORIGIN matches your Vite dev server origin.
- Keep JWT secrets secure and rotate for production environments.