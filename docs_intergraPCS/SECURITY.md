# Security Guide

## Overview

Production-grade security practices for integraPCS covering:
- **HTTP hardening** with Helmet, CORS allowlisting, and rate limiting
- **Dependency security** with npm audit gating and automated updates
- **Secrets management** with runtime injection and credential rotation
- **Network security** with TLS encryption for all services

---

## HTTP Hardening

### 1. Security Headers (Helmet)

Helmet sets secure HTTP headers to protect against common vulnerabilities.

#### Installation

```bash
npm install helmet express-rate-limit rate-limit-redis --save
```

#### Implementation

**File: `backend/src/middleware/security.ts`**

```typescript
import helmet from 'helmet';
import { Express } from 'express';

export function applySecurityHeaders(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // GraphQL Playground needs unsafe-inline
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'no-referrer' },
      xssFilter: true
    })
  );
}
```

**Headers Set**:
- `Content-Security-Policy` - Prevents XSS attacks
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Strict-Transport-Security` - Enforces HTTPS
- `Referrer-Policy: no-referrer` - Protects user privacy
- `X-XSS-Protection: 1; mode=block` - Enables XSS filter

---

### 2. CORS Allowlisting

**❌ Never use wildcard `*` in production**

```typescript
// File: backend/src/middleware/cors.ts
import cors from 'cors';
import { CorsOptions } from 'cors';

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  process.env.PRODUCTION_ORIGIN || 'https://integrapcs.com'
].filter(Boolean);

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Apollo-Require-Preflight'],
  exposedHeaders: ['Content-Length'],
  maxAge: 86400 // 24 hours
};
```

**Environment Variables**:
```bash
FRONTEND_ORIGIN=http://localhost:5173
PRODUCTION_ORIGIN=https://integrapcs.com
```

---

### 3. Body Size Limits

**Prevent DoS attacks with large payloads**

```typescript
// File: backend/src/index.ts
import express from 'express';

const app = express();

// Limit JSON body size
app.use(express.json({ limit: '1mb' }));

// Limit URL-encoded body size
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```

**For Apollo Server**:

```typescript
import { ApolloServer } from '@apollo/server';

const server = new ApolloServer({
  // ...
  plugins: [
    {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            // Limit query complexity
            const complexity = calculateComplexity(requestContext.operation);
            if (complexity > 1000) {
              throw new Error('Query too complex');
            }
          }
        };
      }
    }
  ]
});
```

---

### 4. Rate Limiting

**Protect against brute force and DoS attacks**

#### Redis-backed Rate Limiter

```typescript
// File: backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// General API rate limiter (100 requests per 15 minutes)
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false
});

// Strict rate limiter for login (5 attempts per 15 minutes)
export const loginLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:login:'
  }),
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
  message: 'Too many login attempts, please try again later.'
});

// Mutation rate limiter (30 requests per 5 minutes)
export const mutationLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:mutation:'
  }),
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Too many mutations, please slow down.'
});
```

#### Apply Rate Limiters

```typescript
// File: backend/src/index.ts
import { apiLimiter, loginLimiter, mutationLimiter } from './middleware/rateLimiter';

// General API rate limit
app.use('/graphql', apiLimiter);

// Stricter rate limit for authentication mutations
app.use('/graphql', (req, res, next) => {
  const operationName = req.body?.operationName;

  if (operationName === 'Login' || operationName === 'Register') {
    return loginLimiter(req, res, next);
  }

  // Check if operation is a mutation
  const query = req.body?.query || '';
  if (query.trim().startsWith('mutation')) {
    return mutationLimiter(req, res, next);
  }

  next();
});
```

**Rate Limit Headers** (returned to client):
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
Retry-After: 900
```

---

## Dependency Security

### 1. npm audit Gating

**Block builds with high/critical vulnerabilities**

#### CI Workflow Integration

```yaml
# .github/workflows/ci.yml
jobs:
  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - name: Run npm audit
        run: npm audit --audit-level=high
      - name: Check for outdated dependencies
        run: npm outdated || true
```

#### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
# npm audit check (only high/critical)
echo "🔒 Running npm audit..."
if npm audit --audit-level=high > /dev/null 2>&1; then
  echo "✅ No high/critical vulnerabilities found"
else
  echo "❌ High/critical vulnerabilities detected!"
  echo "Run: npm audit fix --force"
  exit 1
fi
```

#### Package Scripts

```json
{
  "scripts": {
    "audit": "npm audit --audit-level=moderate",
    "audit:fix": "npm audit fix",
    "audit:fix:force": "npm audit fix --force"
  }
}
```

---

### 2. Renovate Configuration

**Automated dependency updates with PR reviews**

#### File: `renovate.json`

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "timezone": "America/New_York",
  "schedule": ["before 6am on Monday"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "automergeType": "pr",
      "automergeStrategy": "squash"
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["major-update"]
    },
    {
      "matchPackagePatterns": ["^@types/"],
      "automerge": true
    },
    {
      "matchDepTypes": ["devDependencies"],
      "extends": ["schedule:weekly"]
    },
    {
      "matchPackageNames": ["typescript", "react", "@apollo/server"],
      "groupName": "critical dependencies",
      "automerge": false,
      "labels": ["critical-dependency"]
    }
  ],
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"]
  },
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 6am on the first day of the month"]
  },
  "prConcurrentLimit": 5,
  "prHourlyLimit": 2
}
```

**Features**:
- ✅ Auto-merge minor/patch updates
- ✅ Weekly schedule to reduce noise
- ✅ Group critical dependencies for manual review
- ✅ Vulnerability alerts with `security` label
- ✅ Monthly lockfile maintenance
- ✅ Rate limiting (5 concurrent PRs, 2 per hour)

---

### 3. Lockfile Management

**Always commit lockfiles**

```bash
# .gitignore - Do NOT ignore lockfiles
# package-lock.json  ❌ DON'T IGNORE
# pnpm-lock.yaml     ❌ DON'T IGNORE
# yarn.lock          ❌ DON'T IGNORE
```

**Benefits**:
- Reproducible builds across environments
- Prevents supply chain attacks
- Faster CI/CD (no resolution on every run)

---

### 4. Version Pinning

**Pin critical dependencies to exact versions**

```json
{
  "dependencies": {
    // Pin exact versions for critical packages
    "typescript": "5.9.3",
    "graphql": "16.11.0",
    "@apollo/server": "4.12.2",

    // Allow patch updates for non-critical
    "lodash": "~4.17.21",

    // Allow minor updates for dev tools
    "prettier": "^3.3.2"
  }
}
```

**Pinning Strategy**:
- **Exact (`5.9.3`)**: TypeScript, GraphQL, core framework versions
- **Tilde (`~4.17.21`)**: Utility libraries (allows patch: 4.17.x)
- **Caret (`^3.3.2`)**: Dev tools (allows minor: 3.x.x)

---

## Secrets Management

### 1. Runtime Environment Injection

**❌ Never bake secrets into Docker images**

```dockerfile
# ❌ BAD: Secrets in build
FROM node:20
ENV DATABASE_PASSWORD=supersecret  # ❌ DON'T DO THIS
COPY . .
RUN npm run build

# ✅ GOOD: Secrets at runtime
FROM node:20
COPY . .
RUN npm run build
# Secrets injected via --env-file or orchestrator
```

**Kubernetes Secrets**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: integrapcs-secrets
type: Opaque
stringData:
  NEO4J_PASSWORD: "changeme"
  REDIS_PASSWORD: "changeme"
  RABBITMQ_PASSWORD: "changeme"
  JWT_SECRET: "changeme"
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: backend
          envFrom:
            - secretRef:
                name: integrapcs-secrets
```

**Docker Compose (Development)**:

```yaml
services:
  backend:
    env_file:
      - .env.local  # Not committed to git
```

---

### 2. Credential Rotation

**Rotate secrets regularly and on suspected compromise**

#### Password Rotation Schedule

| Service | Rotation Frequency | Method |
|---------|-------------------|--------|
| Neo4j | 90 days | `ALTER CURRENT USER SET PASSWORD FROM 'old' TO 'new'` |
| Redis | 90 days | Update `requirepass` in redis.conf |
| RabbitMQ | 90 days | `rabbitmqctl change_password user new_password` |
| JWT Secret | 180 days | Generate new, support both old/new for 24h |

#### Automated Rotation Script

```bash
#!/bin/bash
# scripts/rotate-credentials.sh

# Generate new secrets
NEW_NEO4J_PASSWORD=$(openssl rand -base64 32)
NEW_REDIS_PASSWORD=$(openssl rand -base64 32)
NEW_JWT_SECRET=$(openssl rand -base64 64)

# Update Kubernetes secrets
kubectl create secret generic integrapcs-secrets \
  --from-literal=NEO4J_PASSWORD="$NEW_NEO4J_PASSWORD" \
  --from-literal=REDIS_PASSWORD="$NEW_REDIS_PASSWORD" \
  --from-literal=JWT_SECRET="$NEW_JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

# Trigger rolling restart
kubectl rollout restart deployment/integrapcs-backend

echo "✅ Credentials rotated successfully"
```

---

### 3. TLS Encryption

**Enable TLS for all service connections**

#### Redis TLS

```typescript
// File: backend/src/infrastructure/redis/client.ts
import Redis from 'ioredis';
import fs from 'fs';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS_ENABLED === 'true' ? {
    ca: fs.readFileSync(process.env.REDIS_TLS_CA_CERT || '/certs/ca.crt'),
    cert: fs.readFileSync(process.env.REDIS_TLS_CERT || '/certs/client.crt'),
    key: fs.readFileSync(process.env.REDIS_TLS_KEY || '/certs/client.key'),
    rejectUnauthorized: true
  } : undefined
});
```

#### RabbitMQ TLS

```typescript
// File: backend/src/infrastructure/rabbitmq/connection.ts
import amqp from 'amqplib';

const connection = await amqp.connect(process.env.RABBITMQ_URL, {
  protocol: 'amqps',
  ca: [fs.readFileSync(process.env.RABBITMQ_TLS_CA_CERT || '/certs/ca.crt')],
  cert: fs.readFileSync(process.env.RABBITMQ_TLS_CERT || '/certs/client.crt'),
  key: fs.readFileSync(process.env.RABBITMQ_TLS_KEY || '/certs/client.key'),
  rejectUnauthorized: true
});
```

#### Neo4j TLS

```typescript
// File: backend/src/infrastructure/neo4j/driver.ts
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  ),
  {
    encrypted: process.env.NEO4J_ENCRYPTED === 'true' ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF',
    trust: process.env.NEO4J_TRUST_STRATEGY || 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
  }
);
```

#### Environment Variables

```bash
# Redis TLS
REDIS_TLS_ENABLED=true
REDIS_TLS_CA_CERT=/certs/redis-ca.crt
REDIS_TLS_CERT=/certs/redis-client.crt
REDIS_TLS_KEY=/certs/redis-client.key

# RabbitMQ TLS
RABBITMQ_URL=amqps://user:pass@rabbitmq.example.com:5671
RABBITMQ_TLS_CA_CERT=/certs/rabbitmq-ca.crt
RABBITMQ_TLS_CERT=/certs/rabbitmq-client.crt
RABBITMQ_TLS_KEY=/certs/rabbitmq-client.key

# Neo4j TLS
NEO4J_ENCRYPTED=true
NEO4J_TRUST_STRATEGY=TRUST_SYSTEM_CA_SIGNED_CERTIFICATES
```

---

## Additional Security Measures

### 1. Input Validation

**Use Zod for all user inputs**

```typescript
import { z } from 'zod';

const LoginInputSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128)
});

export const loginResolver = async (input: unknown) => {
  // Validate input
  const validated = LoginInputSchema.parse(input);
  // ... proceed with validated data
};
```

---

### 2. SQL/NoSQL Injection Prevention

**Use parameterized queries ALWAYS**

```typescript
// ✅ GOOD: Parameterized query
await session.run(
  'MATCH (u:User {email: $email}) RETURN u',
  { email: userInput }
);

// ❌ BAD: String concatenation
await session.run(
  `MATCH (u:User {email: "${userInput}"}) RETURN u`
);
```

---

### 3. Authentication & Authorization

**Implement JWT with short-lived tokens**

```typescript
// 15-minute access token, 7-day refresh token
const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
```

**Role-Based Access Control (RBAC)**:

```typescript
export const requireRole = (role: 'admin' | 'user') => {
  return (next: GraphQLFieldResolver) => async (parent, args, context, info) => {
    if (!context.user) {
      throw new Error('Unauthenticated');
    }

    if (context.user.role !== role && context.user.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    return next(parent, args, context, info);
  };
};
```

---

## Security Checklist

### Pre-Production

- [ ] Helmet headers configured
- [ ] CORS allowlist (no wildcard)
- [ ] Rate limiting on all mutations
- [ ] Body size limits enforced
- [ ] npm audit passing (no high/critical)
- [ ] Renovate configured
- [ ] Lockfiles committed
- [ ] Secrets via env injection (not baked)
- [ ] TLS enabled for Redis/RabbitMQ/Neo4j
- [ ] Input validation with Zod
- [ ] Parameterized queries everywhere
- [ ] Short-lived JWT tokens
- [ ] RBAC implemented
- [ ] Error messages don't leak sensitive info

### Production Monitoring

- [ ] Set up alerts for rate limit hits
- [ ] Monitor failed authentication attempts
- [ ] Track dependency vulnerabilities
- [ ] Audit logs for privileged operations
- [ ] Rotate credentials every 90 days
- [ ] Review CORS origins quarterly
- [ ] Scan Docker images for vulnerabilities

---

## Summary

✅ **HTTP Hardening**: Helmet, CORS allowlisting, rate limiting, body size limits
✅ **Dependency Security**: npm audit gating, Renovate, lockfiles, version pinning
✅ **Secrets Management**: Runtime injection, credential rotation, TLS encryption
✅ **Defense in Depth**: Input validation, parameterized queries, JWT auth, RBAC

**Next Steps**:
1. Install security dependencies (`helmet`, `express-rate-limit`, `rate-limit-redis`)
2. Implement middleware (security headers, CORS, rate limiting)
3. Configure Renovate for automated dependency updates
4. Enable TLS for all services in production
5. Set up credential rotation schedule
6. Add security monitoring and alerting
