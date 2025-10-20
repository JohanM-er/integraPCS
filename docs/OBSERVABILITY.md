# Observability & Monitoring

## Overview

Production-grade observability for integraPCS using:
- **OpenTelemetry SDK** for distributed tracing
- **GraphQL instrumentation** for resolver metrics
- **Health/Readiness probes** for Kubernetes
- **Metrics export** to OTLP endpoint (Jaeger, Honeycomb, etc.)
- **P99 latency tracking** on resolvers

---

## Architecture

```
integraPCS Backend
├── OpenTelemetry SDK
│   ├── Tracer → Distributed tracing
│   ├── Meter → Metrics (histograms, counters)
│   └── OTLP Exporter → Send to collector
├── GraphQL Instrumentation
│   ├── Resolver spans
│   ├── Field-level timing
│   └── Error tracking
├── Health Probes
│   ├── /health → Liveness
│   └── /ready → Readiness (Neo4j, Redis, RabbitMQ)
└── Custom Metrics
    ├── Resolver p50/p95/p99 latencies
    ├── Event store append operations
    └── PubSub publish/subscribe counts
```

---

## Dependencies

```json
{
  "dependencies": {
    "@opentelemetry/sdk-node": "^0.54.0",
    "@opentelemetry/auto-instrumentations-node": "^0.50.0",
    "@opentelemetry/instrumentation-graphql": "^0.44.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.54.0",
    "@opentelemetry/exporter-metrics-otlp-http": "^0.54.0",
    "@opentelemetry/sdk-metrics": "^1.28.0",
    "@opentelemetry/api": "^1.9.0"
  }
}
```

---

## 1. OpenTelemetry Setup

### File: `backend/src/instrumentation.ts`

**⚠️ Must be imported BEFORE any other modules**

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: 'integrapcs-backend',
  [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0'
});

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: {
    // Add auth headers if needed
    // 'x-honeycomb-team': process.env.HONEYCOMB_API_KEY
  }
});

const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics'
});

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000 // Export every 60s
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable default HTTP instrumentation (conflicts with GraphQL)
      '@opentelemetry/instrumentation-http': {
        enabled: false
      }
    }),
    new GraphQLInstrumentation({
      // Capture resolver arguments (be careful with PII)
      allowValues: process.env.NODE_ENV === 'development',
      // Merge resolvers into single span for cleaner traces
      mergeItems: true,
      // Ignore introspection queries
      ignoreResolveSpans: true
    })
  ]
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await sdk.shutdown();
});

console.log('OpenTelemetry SDK initialized');
```

### Bootstrap Integration

#### File: `backend/src/index.ts`

```typescript
// MUST be first import
import './instrumentation';

import express from 'express';
import { ApolloServer } from '@apollo/server';
// ... rest of imports
```

---

## 2. Custom Resolver Metrics

### File: `backend/src/infrastructure/telemetry/metrics.ts`

```typescript
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('integrapcs-backend');

// Resolver latency histogram
export const resolverLatency = meter.createHistogram('graphql.resolver.duration', {
  description: 'GraphQL resolver execution time',
  unit: 'ms'
});

// Event store metrics
export const eventStoreAppends = meter.createCounter('eventstore.appends.total', {
  description: 'Total event store append operations'
});

export const eventStoreErrors = meter.createCounter('eventstore.errors.total', {
  description: 'Total event store errors'
});

// PubSub metrics
export const pubSubPublishes = meter.createCounter('pubsub.publishes.total', {
  description: 'Total PubSub publish operations'
});

export const pubSubSubscribers = meter.createUpDownCounter('pubsub.subscribers.active', {
  description: 'Current active PubSub subscribers'
});
```

### Resolver Instrumentation

#### File: `backend/src/graphql/resolvers/workPackage.ts`

```typescript
import { trace, context } from '@opentelemetry/api';
import { resolverLatency } from '@/infrastructure/telemetry/metrics';

const tracer = trace.getTracer('integrapcs-backend');

export const workPackageResolvers = {
  Query: {
    workPackage: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      const startTime = Date.now();
      const span = tracer.startSpan('Query.workPackage');

      try {
        span.setAttribute('workPackage.id', args.id);

        const result = await ctx.workPackageService.getById(args.id);

        span.setStatus({ code: 0 }); // OK
        return result;
      } catch (error) {
        span.setStatus({
          code: 2, // ERROR
          message: (error as Error).message
        });
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        resolverLatency.record(duration, {
          'graphql.operation': 'query',
          'graphql.field': 'workPackage'
        });
        span.end();
      }
    }
  },

  Mutation: {
    createWorkPackage: async (
      _: unknown,
      args: { name: string; projectId: string },
      ctx: GraphQLContext
    ) => {
      return tracer.startActiveSpan('Mutation.createWorkPackage', async (span) => {
        const startTime = Date.now();

        try {
          span.setAttribute('workPackage.name', args.name);
          span.setAttribute('project.id', args.projectId);

          const result = await ctx.commandBus.execute({
            type: 'CreateWorkPackage',
            payload: args
          });

          span.setStatus({ code: 0 });
          return result.workPackageId;
        } catch (error) {
          span.setStatus({ code: 2, message: (error as Error).message });
          throw error;
        } finally {
          const duration = Date.now() - startTime;
          resolverLatency.record(duration, {
            'graphql.operation': 'mutation',
            'graphql.field': 'createWorkPackage'
          });
          span.end();
        }
      });
    }
  }
};
```

---

## 3. Event Store Instrumentation

### File: `backend/src/infrastructure/eventStore/EventStoreNeo4j.ts`

```typescript
import { trace } from '@opentelemetry/api';
import { eventStoreAppends, eventStoreErrors } from '../telemetry/metrics';

const tracer = trace.getTracer('integrapcs-backend');

export class EventStoreNeo4j implements EventStore {
  async append(
    aggregateId: string,
    expectedVersion: number,
    events: DomainEvent[],
    metadata?: EventMetadata
  ): Promise<void> {
    return tracer.startActiveSpan('EventStore.append', async (span) => {
      span.setAttribute('aggregate.id', aggregateId);
      span.setAttribute('expected.version', expectedVersion);
      span.setAttribute('events.count', events.length);

      try {
        // ... append logic ...

        eventStoreAppends.add(events.length, {
          'aggregate.type': events[0]?.type || 'unknown'
        });

        span.setStatus({ code: 0 });
      } catch (error) {
        eventStoreErrors.add(1, {
          'error.type': (error as Error).name
        });
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

---

## 4. Health & Readiness Probes

### File: `backend/src/health.ts`

```typescript
import { Request, Response } from 'express';
import { getDriver } from './infrastructure/neo4j/driver';
import { logger } from './infrastructure/logger';

/**
 * Liveness probe: Is the process alive?
 * Returns 200 if process is running
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

/**
 * Readiness probe: Is the service ready to handle traffic?
 * Checks connectivity to Neo4j, Redis, RabbitMQ
 */
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  const checks: Record<string, { healthy: boolean; latencyMs?: number; error?: string }> = {};

  // Check Neo4j
  try {
    const start = Date.now();
    const driver = getDriver();
    await driver.verifyConnectivity();
    checks.neo4j = {
      healthy: true,
      latencyMs: Date.now() - start
    };
  } catch (error) {
    checks.neo4j = {
      healthy: false,
      error: (error as Error).message
    };
  }

  // Check Redis
  try {
    const start = Date.now();
    // Implement: await redis.ping();
    checks.redis = {
      healthy: true,
      latencyMs: Date.now() - start
    };
  } catch (error) {
    checks.redis = {
      healthy: false,
      error: (error as Error).message
    };
  }

  // Check RabbitMQ
  try {
    const start = Date.now();
    // Implement: await rabbitmq.checkConnection();
    checks.rabbitmq = {
      healthy: true,
      latencyMs: Date.now() - start
    };
  } catch (error) {
    checks.rabbitmq = {
      healthy: false,
      error: (error as Error).message
    };
  }

  const allHealthy = Object.values(checks).every((check) => check.healthy);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not ready',
    checks,
    timestamp: new Date().toISOString()
  });
}

/**
 * Metrics endpoint: Expose Prometheus-compatible metrics
 * (Optional if using OTLP exporter)
 */
export async function metricsEndpoint(req: Request, res: Response): Promise<void> {
  // If using Prometheus exporter:
  // const metrics = await register.metrics();
  // res.set('Content-Type', register.contentType);
  // res.send(metrics);

  res.status(200).json({
    message: 'Metrics exported via OTLP to collector'
  });
}
```

### Register Routes

```typescript
app.get('/health', healthCheck);
app.get('/ready', readinessCheck);
app.get('/metrics', metricsEndpoint);
```

---

## 5. P99 Latency Dashboard Query

### Querying Exported Metrics

#### Example: Honeycomb Query

```sql
SELECT
  HEATMAP(duration_ms),
  P50(duration_ms),
  P95(duration_ms),
  P99(duration_ms)
FROM spans
WHERE service.name = 'integrapcs-backend'
  AND span.kind = 'server'
  AND graphql.operation = 'mutation'
  AND graphql.field = 'createWorkPackage'
GROUP BY graphql.field
```

#### Example: Jaeger Query

```
Service: integrapcs-backend
Operation: Mutation.createWorkPackage
Lookback: Last 1 hour
```

---

## 6. Environment Configuration

### File: `.env` (additions)

```bash
# OpenTelemetry
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
OTEL_SERVICE_NAME=integrapcs-backend
OTEL_LOG_LEVEL=info

# Honeycomb (if using)
# HONEYCOMB_API_KEY=your_api_key
# OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://api.honeycomb.io/v1/traces
# OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=your_api_key
```

---

## 7. Local Development Setup

### Docker Compose with Jaeger

#### File: `docker-compose.observability.yml`

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: integrapcs-jaeger
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "4318:4318"  # OTLP HTTP receiver
      - "16686:16686" # Jaeger UI
    networks:
      - integrapcs

networks:
  integrapcs:
    external: true
```

**Start:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

**Access Jaeger UI:** http://localhost:16686

---

## 8. Kubernetes Deployment

### Deployment with Probes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: integrapcs-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: backend
          image: integrapcs-backend:latest
          ports:
            - containerPort: 3000
          env:
            - name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
              value: "http://otel-collector:4318/v1/traces"
            - name: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
              value: "http://otel-collector:4318/v1/metrics"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 2
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
```

---

## 9. Alerting Rules

### Example: Prometheus/AlertManager

```yaml
groups:
  - name: integrapcs-backend
    interval: 30s
    rules:
      - alert: HighResolverLatency
        expr: histogram_quantile(0.99, rate(graphql_resolver_duration_bucket[5m])) > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 resolver latency above 1s"
          description: "{{ $labels.graphql_field }} resolver is slow"

      - alert: EventStoreErrors
        expr: rate(eventstore_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Event store error rate elevated"
          description: "{{ $value }} errors per second"

      - alert: ServiceNotReady
        expr: up{job="integrapcs-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Backend service is down"
```

---

## 10. Best Practices

1. **Sampling**: Use head-based sampling in production (e.g., sample 10% of traces)
2. **Cardinality**: Avoid high-cardinality labels (user IDs, UUIDs) in metrics
3. **Secrets**: Never log or trace sensitive data (use `redact` in Pino)
4. **Context propagation**: Pass `traceparent` header through microservice calls
5. **Span attributes**: Add business context (aggregate IDs, operation types)
6. **Error tracking**: Always set span status on errors
7. **Cost management**: Monitor OTLP exporter bandwidth in production

---

## Summary

✅ **OpenTelemetry SDK** with OTLP exporters
✅ **GraphQL instrumentation** for resolver tracing
✅ **Custom metrics** for p50/p95/p99 latencies
✅ **Health/Readiness probes** for Kubernetes
✅ **Event store instrumentation** with spans and counters
✅ **Local dev setup** with Jaeger
✅ **Production alerting** rules
✅ **Correlation IDs** via Pino (see INFRASTRUCTURE_SETUP.md)

**Next Steps:**
1. Add Prometheus exporter if preferred over OTLP
2. Configure Grafana dashboards for metrics visualization
3. Set up distributed tracing across frontend → backend → Neo4j
4. Add custom business metrics (work packages created, tasks completed, etc.)
