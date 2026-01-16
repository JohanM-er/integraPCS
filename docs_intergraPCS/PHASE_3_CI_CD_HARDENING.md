# Phase 3: CI/CD Hardening & Production Readiness

**Status**: Not yet implemented  
**Prerequisites**: Phase 1 (Critical Blockers) and Phase 2 (Documentation & Consistency) completed  
**Last Updated**: 2025-10-20

---

## Overview

Phase 3 focuses on CI/CD hardening, production readiness validation, and remaining configuration refinements. This phase is **non-blocking** for initial development but should be completed before production deployment.

**Estimated Implementation Time**: 2-4 hours  
**Complexity**: Medium  
**Impact**: High (production readiness)

---

## Table of Contents

1. [CI/CD Workflow Improvements](#cicd-workflow-improvements)
2. [Renovate Dependency Management](#renovate-dependency-management)
3. [Playwright WebServer Configuration](#playwright-webserver-configuration)
4. [Environment Variable Validation](#environment-variable-validation)
5. [Docker Compose Alignment](#docker-compose-alignment)
6. [Build Verification](#build-verification)
7. [Implementation Checklist](#implementation-checklist)
8. [Testing & Validation](#testing--validation)

---

## 1. CI/CD Workflow Improvements

### 1.1 Gate Integration Tests Until Backend Implemented

**Problem**: The CI workflow includes an `integration-tests` job that expects:
- Backend integration test suite to exist
- Neo4j, Redis, and RabbitMQ services to be properly wired into backend code
- Test infrastructure (Testcontainers or similar) to be configured

**Current State**: Backend server scaffold exists but integration tests and infrastructure wiring are not yet implemented.

**Solution**: Temporarily gate the integration test job to prevent CI failures while development continues.

#### Option A: Conditional with `if: false` (Simplest)

**File**: `.github/workflows/ci.yml`

**Location**: Around line 85 (integration-tests job)

**Change**:
```yaml
integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    if: false  # Temporarily disabled until backend integration pipeline implemented
    needs: [security-audit, code-quality]
    # ... rest of job configuration
```

**Pros**:
- Simple one-line change
- Easy to re-enable (change to `true` or remove line)
- Clear intent

**Cons**:
- Job still shows as "skipped" in GitHub Actions UI
- Less flexible than label-based approach

#### Option B: Label-Based Gating (More Flexible)

**Change**:
```yaml
integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'run-integration-tests')
    needs: [security-audit, code-quality]
    # ... rest of job configuration
```

**Pros**:
- Can enable per-PR by adding label
- Useful for testing integration suite incrementally
- Production-ready pattern

**Cons**:
- Requires manual label application
- More complex than simple boolean flag

#### Option C: Path-Based Gating (Most Targeted)

**Change**:
```yaml
integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    if: |
      github.event_name != 'pull_request' ||
      contains(github.event.pull_request.labels.*.name, 'run-integration-tests') ||
      contains(github.event.pull_request.changed_files, 'backend/src/integration-tests/')
    needs: [security-audit, code-quality]
    # ... rest of job configuration
```

**Pros**:
- Automatically runs when integration test files are modified
- Combines flexibility of labels with path-based detection
- Production-ready

**Cons**:
- Most complex option
- Requires `changed_files` data (may need setup)

**Recommendation**: **Option A** for immediate unblocking, migrate to **Option C** before production.

### 1.2 Re-Enable Integration Tests (Future Step)

**When to re-enable**:
- After implementing `backend/src/__tests__/integration/` test suite
- After wiring Neo4j, Redis, RabbitMQ into backend context
- After setting up Testcontainers or equivalent

**Steps to re-enable**:
1. Remove `if: false` line (Option A) or adjust condition (Option B/C)
2. Verify services are properly configured in CI workflow:
   ```yaml
   services:
     neo4j:
       image: neo4j:5-community
       env:
         NEO4J_AUTH: neo4j/password123
         NEO4J_ACCEPT_LICENSE_AGREEMENT: "yes"
       options: >-
         --health-cmd "cypher-shell -u neo4j -p password123 'RETURN 1'"
         --health-interval 10s
         --health-timeout 5s
         --health-retries 5
       ports:
         - 7687:7687
     
     redis:
       image: redis:7-alpine
       options: >-
         --health-cmd "redis-cli ping"
         --health-interval 10s
         --health-timeout 5s
         --health-retries 5
       ports:
         - 6379:6379
     
     rabbitmq:
       image: rabbitmq:3.13-management-alpine
       env:
         RABBITMQ_DEFAULT_USER: scheduler
         RABBITMQ_DEFAULT_PASS: password123
       options: >-
         --health-cmd "rabbitmq-diagnostics -q ping"
         --health-interval 10s
         --health-timeout 5s
         --health-retries 5
       ports:
         - 5672:5672
   ```
3. Create `backend/.env.test` with test service endpoints:
   ```env
   NEO4J_URI=bolt://neo4j:7687
   REDIS_URL=redis://redis:6379
   RABBITMQ_URL=amqp://scheduler:password123@rabbitmq:5672/
   ```
4. Run integration tests locally first: `npm run test:integration`
5. Verify CI passes with integration tests enabled

---

## 2. Renovate Dependency Management

### 2.1 Add GraphQL Version Sync Rule

**Problem**: GraphQL runtime must be identical across all workspaces to prevent schema/introspection conflicts. Renovate's default behavior may update GraphQL independently in different packages.

**Solution**: Add a `packageRules` entry to group GraphQL updates across the monorepo.

**File**: `renovate.json`

**Location**: Inside `packageRules` array (after line 100)

**Change**:
```json
{
  "packageRules": [
    // ... existing rules ...
    {
      "description": "Sync GraphQL runtime across monorepo workspaces",
      "matchPackageNames": ["graphql"],
      "groupName": "graphql runtime",
      "rangeStrategy": "pin",
      "separateMajorMinor": false,
      "schedule": ["after 3am on monday"]
    }
  ]
}
```

**Explanation**:
- `matchPackageNames`: Targets only the `graphql` package
- `groupName`: Creates a single PR for all GraphQL updates
- `rangeStrategy: "pin"`: Maintains exact version pinning (no `^` or `~`)
- `separateMajorMinor: false`: Major and minor updates in same PR
- `schedule`: Runs once weekly to reduce PR noise

### 2.2 Add TypeScript Version Sync Rule (Optional)

**Benefit**: Prevents TypeScript API drift between workspaces

**Change**:
```json
{
  "description": "Sync TypeScript compiler across monorepo workspaces",
  "matchPackageNames": ["typescript"],
  "groupName": "typescript compiler",
  "rangeStrategy": "pin",
  "separateMajorMinor": false,
  "schedule": ["after 3am on monday"]
}
```

### 2.3 Verify Renovate GitHub App Installation

**Prerequisites**:
1. Renovate GitHub App must be installed on repository
2. Repository must have `renovate.json` in root (already present ✅)
3. Renovate must have read/write access to repository

**Verification Steps**:
1. Check GitHub App installations: `https://github.com/organizations/YOUR_ORG/settings/installations`
2. Ensure Renovate has repository access
3. Wait for initial Renovate run (usually within 24 hours)
4. Check for "Configure Renovate" PR from renovate bot

**Manual Trigger** (if needed):
```bash
# From repository settings
Settings → GitHub Apps → Renovate → Configure → Repository access
```

---

## 3. Playwright WebServer Configuration

### 3.1 Problem Statement

**Current State**: 
- CI E2E job runs `npm run test:e2e` in frontend workspace
- Playwright expects a running web server at `http://localhost:5173`
- No webServer configuration exists in `playwright.config.ts`

**Issue**: E2E tests will fail if no server is running

**Solutions**:

#### Option A: Add webServer to playwright.config.ts (Recommended)

**File**: `frontend/playwright.config.ts`

**Location**: Inside `defineConfig` object (after line 30)

**Change**:
```typescript
export default defineConfig({
  testDir: './e2e',
  // ... existing config ...
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes
    stdout: 'ignore',
    stderr: 'pipe'
  },
  
  // ... rest of config
});
```

**Explanation**:
- `command`: Starts Vite dev server
- `url`: Playwright waits for this URL to respond before running tests
- `reuseExistingServer`: Reuses server if already running (local dev only)
- `timeout`: Max wait time for server to start
- `stdout: 'ignore'`: Reduces log noise
- `stderr: 'pipe'`: Shows errors if server fails to start

**Pros**:
- Self-contained solution
- Works in both CI and local development
- Playwright manages server lifecycle

**Cons**:
- Adds ~10-30 seconds to test startup time

#### Option B: Manual Server Management in CI

**File**: `.github/workflows/ci.yml`

**Change** (e2e-tests job):
```yaml
e2e-tests:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: [security-audit, code-quality]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    # NEW: Build and start Vite preview server
    - name: Build frontend
      run: npm run build -w frontend
    
    - name: Start preview server
      run: npm run preview -w frontend &
      env:
        VITE_GRAPHQL_HTTP: http://localhost:3000/graphql
        VITE_GRAPHQL_WS: ws://localhost:3000/graphql
    
    - name: Wait for server
      run: npx wait-on http://localhost:4173 -t 30000
    
    # Existing: Install Playwright and run tests
    - name: Install Playwright
      run: npx playwright install --with-deps chromium
    
    - name: Run E2E tests
      run: npm run test:e2e -w frontend
      env:
        PLAYWRIGHT_BASE_URL: http://localhost:4173
```

**Pros**:
- More control over server configuration
- Tests against production build (not dev server)

**Cons**:
- More complex CI configuration
- Requires manual server management
- Different behavior in CI vs local

**Recommendation**: **Option A** (webServer in playwright.config.ts) for consistency and simplicity.

### 3.2 Backend Health Check Prerequisite

**Consideration**: If E2E tests depend on backend API:

**Option**: Add backend health check before running tests

**File**: `.github/workflows/ci.yml` (if using Option B above)

**Addition**:
```yaml
- name: Start backend server
  run: npm run dev -w backend &
  env:
    NEO4J_URI: bolt://localhost:7687
    REDIS_URL: redis://localhost:6379
    RABBITMQ_URL: amqp://scheduler:password123@localhost:5672/

- name: Wait for backend health
  run: npx wait-on http://localhost:3000/healthz -t 30000
```

**Note**: Requires Neo4j, Redis, RabbitMQ services (see section 1.2)

---

## 4. Environment Variable Validation

### 4.1 Validate All .env.example Files Are Documented

**Goal**: Ensure all environment variables referenced in code have corresponding entries in `.env.example` files.

**Validation Script** (run from repo root):

```bash
#!/bin/bash
# validate-env-vars.sh

echo "Validating backend environment variables..."

# Extract env vars from backend code
backend_vars=$(grep -rh "process\.env\." backend/src/ | \
  sed -E 's/.*process\.env\.([A-Z_]+).*/\1/' | \
  sort -u)

# Extract vars from backend/.env.example
example_vars=$(grep -v "^#" backend/.env.example | \
  grep "=" | \
  cut -d= -f1 | \
  sort -u)

# Find missing vars
missing=$(comm -23 <(echo "$backend_vars") <(echo "$example_vars"))

if [ -n "$missing" ]; then
  echo "❌ Missing from backend/.env.example:"
  echo "$missing"
  exit 1
else
  echo "✅ All backend env vars documented"
fi

echo ""
echo "Validating frontend environment variables..."

# Extract VITE_ prefixed vars from frontend code
frontend_vars=$(grep -rh "import\.meta\.env\.VITE_" frontend/src/ | \
  sed -E 's/.*import\.meta\.env\.(VITE_[A-Z_]+).*/\1/' | \
  sort -u)

# Extract vars from frontend/.env.example
example_vars=$(grep -v "^#" frontend/.env.example | \
  grep "VITE_" | \
  cut -d= -f1 | \
  sort -u)

# Find missing vars
missing=$(comm -23 <(echo "$frontend_vars") <(echo "$example_vars"))

if [ -n "$missing" ]; then
  echo "❌ Missing from frontend/.env.example:"
  echo "$missing"
  exit 1
else
  echo "✅ All frontend env vars documented"
fi
```

**Usage**:
```bash
chmod +x validate-env-vars.sh
./validate-env-vars.sh
```

**Integration**: Add to CI workflow as pre-check or to Husky pre-commit hook.

### 4.2 Current Environment Variable Inventory

**Backend** (`backend/.env.example`):
```
✅ NODE_ENV
✅ GRAPHQL_PORT
✅ GRAPHQL_PATH
✅ SUBSCRIPTIONS_PATH
✅ FRONTEND_ORIGIN
✅ NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
✅ NEO4J_ENCRYPTED, NEO4J_TRUST_STRATEGY
✅ RABBITMQ_URL, RABBITMQ_TLS_ENABLED
✅ REDIS_URL, REDIS_TLS_ENABLED
✅ JWT_SECRET, JWT_EXPIRES_IN
✅ LOG_LEVEL
```

**Frontend** (`frontend/.env.example`):
```
✅ VITE_GRAPHQL_HTTP
✅ VITE_GRAPHQL_WS
✅ VITE_APP_NAME
✅ VITE_APP_VERSION
✅ VITE_ENABLE_DEVTOOLS
✅ VITE_ENABLE_SUBSCRIPTIONS
⚠️  Optional: VITE_SENTRY_DSN, VITE_ANALYTICS_ID
```

**Status**: ✅ All currently-used variables are documented

---

## 5. Docker Compose Alignment

### 5.1 Validate Service Credentials Match CI and .env.example

**Problem**: Docker Compose, CI services, and .env.example may have divergent credentials.

**Current State**:

| Service | Docker Compose | .env.example | CI Workflow |
|---------|----------------|--------------|-------------|
| Neo4j | `neo4j/password123` | `neo4j/password123` | ✅ Match |
| Redis | (no auth) | (no auth) | ✅ Match |
| RabbitMQ | `scheduler/password123` | `scheduler/password123` | ✅ Match |

**Validation**: ✅ Credentials are currently aligned

**Monitoring**: Add note to `docker-compose.yml` header:

```yaml
# docker-compose.yml
# 
# IMPORTANT: Service credentials must match:
#   - backend/.env.example (local dev defaults)
#   - .github/workflows/ci.yml (CI service configuration)
#
# When changing credentials here, update both files.
```

### 5.2 Add Health Check Endpoints to docker-compose.yml

**Enhancement**: Add health checks to ensure services are ready before backend starts.

**File**: `docker-compose.yml`

**Current State**: Services already have `healthcheck` configurations ✅

**Validation**: Test that backend waits for services:

```bash
docker-compose up -d
docker-compose logs -f neo4j redis rabbitmq
# Wait for "healthy" status
npm run dev:backend
```

**Status**: ✅ Already properly configured

---

## 6. Build Verification

### 6.1 Verify TypeScript Compilation Succeeds

**Goal**: Ensure all workspaces compile without errors after Phase 1/2 changes.

**Test Commands**:
```bash
# From repo root
npm run typecheck

# Expected output:
# > typecheck
# > npm run typecheck --workspaces --if-present
# backend: no errors
# frontend: no errors
# shared-types: no errors
```

**Common Issues & Fixes**:

#### Issue: `Cannot find module '@integrapcs/shared-types'`

**Cause**: Shared types not built

**Fix**:
```bash
npm run build:shared
npm run typecheck
```

#### Issue: Frontend `Cannot find name 'process'`

**Cause**: Missing `@types/node`

**Fix**: Already in devDependencies ✅

#### Issue: Backend import errors

**Cause**: Missing `tsconfig-paths` registration

**Fix**: Already configured in `dev` script ✅

### 6.2 Verify Production Builds Succeed

**Test Commands**:
```bash
# Build all workspaces
npm run build

# Expected directory structure:
# packages/shared-types/dist/
# backend/dist/
# frontend/dist/
```

**Validation**:
```bash
# Check outputs exist
test -d packages/shared-types/dist && echo "✅ shared-types built"
test -d backend/dist && echo "✅ backend built"
test -d frontend/dist && echo "✅ frontend built"
```

### 6.3 Verify Backend Server Starts

**Test**:
```bash
# Start dependencies
docker-compose up -d

# Wait for healthy status
docker-compose ps

# Start backend
npm run dev:backend

# Expected output:
# {"level":30,"time":...,"msg":"GraphQL server ready","httpUrl":"http://localhost:3000/graphql","wsUrl":"ws://localhost:3000/graphql"}
```

**Health Check**:
```bash
curl http://localhost:3000/healthz
# Expected: {"status":"ok"}

curl http://localhost:3000/ready
# Expected: {"status":"ok"}
```

**GraphQL Health Check**:
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health }"}'

# Expected: {"data":{"health":"ok"}}
```

### 6.4 Verify WebSocket Subscriptions Work

**Test** (requires `wscat`):
```bash
npm install -g wscat

wscat -c ws://localhost:3000/graphql -s graphql-ws

# After connection, send:
{"type":"connection_init"}

# Then subscribe:
{"id":"1","type":"subscribe","payload":{"query":"subscription { serverTime }"}}

# Expected: Time updates every second
# {"id":"1","type":"next","payload":{"data":{"serverTime":"2025-10-20T12:34:56.789Z"}}}
```

**Alternative**: Use Apollo Studio Sandbox or GraphiQL

### 6.5 Verify Frontend Connects to Backend

**Test**:
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend

# Browser: http://localhost:5173
# Open DevTools → Network → WS
# Should see WebSocket connection to ws://localhost:3000/graphql
```

**Validation**:
- No CORS errors in browser console ✅
- WebSocket shows "connected" status ✅
- GraphQL queries return data ✅

---

## 7. Implementation Checklist

### Pre-Implementation

- [ ] Verify Phase 1 (Critical Blockers) is complete
- [ ] Verify Phase 2 (Documentation & Consistency) is complete
- [ ] Review this document thoroughly
- [ ] Schedule ~2-4 hour implementation window
- [ ] Backup current state: `git checkout -b phase3-backup`

### Implementation Order

#### Step 1: CI/CD Workflow (30 minutes)

- [ ] Gate integration tests with `if: false` in `.github/workflows/ci.yml`
- [ ] Commit change: `git commit -m "Gate integration tests until backend wiring complete"`
- [ ] Push and verify CI passes on GitHub

#### Step 2: Renovate Configuration (15 minutes)

- [ ] Add GraphQL sync rule to `renovate.json`
- [ ] Add TypeScript sync rule to `renovate.json`
- [ ] Commit change: `git commit -m "Add Renovate rules for GraphQL and TypeScript version sync"`
- [ ] Verify Renovate GitHub App is installed
- [ ] Wait for Renovate's next run (or trigger manually)

#### Step 3: Playwright WebServer (20 minutes)

- [ ] Add `webServer` configuration to `frontend/playwright.config.ts`
- [ ] Test locally: `npm run test:e2e -w frontend`
- [ ] Commit change: `git commit -m "Add Playwright webServer config for E2E tests"`
- [ ] Push and verify E2E tests pass in CI

#### Step 4: Environment Variable Validation (30 minutes)

- [ ] Create `scripts/validate-env-vars.sh` validation script
- [ ] Run script locally and fix any issues
- [ ] (Optional) Add to CI as a quality check job
- [ ] Commit: `git commit -m "Add environment variable validation script"`

#### Step 5: Docker Compose Documentation (10 minutes)

- [ ] Add credential alignment comment to `docker-compose.yml`
- [ ] Commit: `git commit -m "Document credential alignment requirements"`

#### Step 6: Build & Server Verification (45 minutes)

- [ ] Run `npm run typecheck` → Verify no errors
- [ ] Run `npm run build` → Verify all workspaces build
- [ ] Start backend: `npm run dev:backend` → Verify server starts
- [ ] Test health endpoints: `curl http://localhost:3000/healthz`
- [ ] Test GraphQL: `curl -X POST http://localhost:3000/graphql -d '{"query":"{ health }"}'`
- [ ] Test WebSocket: Use wscat or Apollo Studio
- [ ] Start frontend: `npm run dev:frontend` → Verify connects to backend
- [ ] Document any issues in `docs/TROUBLESHOOTING.md`

#### Step 7: Final Commit & Push (10 minutes)

- [ ] Create comprehensive commit message
- [ ] Push all Phase 3 changes
- [ ] Verify all CI jobs pass (except gated integration tests)
- [ ] Update `docs/PHASE_3_CI_CD_HARDENING.md` status to "Completed"

### Post-Implementation

- [ ] Run full test suite: `npm test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Verify CI passes on main branch
- [ ] Update team documentation
- [ ] Schedule follow-up for integration test implementation

---

## 8. Testing & Validation

### Automated Validation Script

Create `scripts/validate-phase3.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Phase 3 Validation Script"
echo "============================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# Test 1: CI workflow has integration tests gated
echo "1. Checking CI integration test gating..."
if grep -q "if: false" .github/workflows/ci.yml; then
  echo -e "${GREEN}✅ Integration tests gated${NC}"
elif grep -q "run-integration-tests" .github/workflows/ci.yml; then
  echo -e "${GREEN}✅ Integration tests label-gated${NC}"
else
  echo -e "${RED}❌ Integration tests not gated${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 2: Renovate has GraphQL sync rule
echo "2. Checking Renovate GraphQL rule..."
if grep -q "graphql runtime" renovate.json; then
  echo -e "${GREEN}✅ GraphQL sync rule configured${NC}"
else
  echo -e "${YELLOW}⚠️  GraphQL sync rule missing (optional)${NC}"
fi

# Test 3: Playwright has webServer config
echo "3. Checking Playwright webServer..."
if grep -q "webServer" frontend/playwright.config.ts; then
  echo -e "${GREEN}✅ Playwright webServer configured${NC}"
else
  echo -e "${YELLOW}⚠️  Playwright webServer not configured${NC}"
fi

# Test 4: Environment variable validation script exists
echo "4. Checking env var validation script..."
if [ -f "scripts/validate-env-vars.sh" ]; then
  echo -e "${GREEN}✅ Env validation script exists${NC}"
else
  echo -e "${YELLOW}⚠️  Env validation script missing (optional)${NC}"
fi

# Test 5: TypeScript compiles without errors
echo "5. Running TypeScript compilation..."
if npm run typecheck > /dev/null 2>&1; then
  echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
else
  echo -e "${RED}❌ TypeScript compilation failed${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 6: All workspaces build successfully
echo "6. Building all workspaces..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✅ All workspaces built successfully${NC}"
else
  echo -e "${RED}❌ Build failed${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 7: Backend dist exists
echo "7. Checking backend build output..."
if [ -d "backend/dist" ]; then
  echo -e "${GREEN}✅ Backend built${NC}"
else
  echo -e "${RED}❌ Backend build missing${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 8: Frontend dist exists
echo "8. Checking frontend build output..."
if [ -d "frontend/dist" ]; then
  echo -e "${GREEN}✅ Frontend built${NC}"
else
  echo -e "${RED}❌ Frontend build missing${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Summary
echo ""
echo "============================="
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 3 validation PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ Phase 3 validation FAILED ($FAILURES issues)${NC}"
  exit 1
fi
```

**Usage**:
```bash
chmod +x scripts/validate-phase3.sh
./scripts/validate-phase3.sh
```

---

## 9. Rollback Procedure

If issues arise during Phase 3 implementation:

### Quick Rollback
```bash
# Restore from backup branch
git checkout main
git reset --hard phase3-backup
git push origin main --force
```

### Selective Rollback

**Revert specific commits**:
```bash
# Find commit hash
git log --oneline

# Revert specific commit
git revert <commit-hash>
git push
```

**Revert CI changes only**:
```bash
git checkout HEAD~1 .github/workflows/ci.yml
git commit -m "Revert CI workflow changes"
```

---

## 10. Future Enhancements (Post-Phase 3)

### 10.1 Add CI Job for Environment Variable Validation

**File**: `.github/workflows/ci.yml`

**New job**:
```yaml
env-validation:
  name: Validate Environment Variables
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Validate env vars
      run: |
        chmod +x scripts/validate-env-vars.sh
        ./scripts/validate-env-vars.sh
```

### 10.2 Add Dependency Graph Visualization

**Tool**: `madge` or `dependency-cruiser`

**Purpose**: Visualize monorepo dependencies and detect circular imports

**Setup**:
```bash
npm install -D madge
npx madge --circular --extensions ts backend/src
npx madge --image graph.svg backend/src
```

### 10.3 Add Bundle Size Monitoring

**Tool**: `bundlesize` or `size-limit`

**Purpose**: Prevent bundle size regressions

**Frontend package.json**:
```json
{
  "bundlesize": [
    {
      "path": "./dist/**/*.js",
      "maxSize": "500 kB"
    }
  ]
}
```

### 10.4 Add Lighthouse CI

**Purpose**: Monitor performance, accessibility, SEO scores

**Setup**: Follow [Lighthouse CI docs](https://github.com/GoogleChrome/lighthouse-ci)

---

## 11. Success Criteria

Phase 3 is considered complete when:

- [ ] CI workflow runs without failures (integration tests gated)
- [ ] Renovate creates PRs for dependency updates
- [ ] E2E tests pass in CI with webServer config
- [ ] All workspaces compile and build successfully
- [ ] Backend server starts and responds to health checks
- [ ] Frontend connects to backend without CORS errors
- [ ] WebSocket subscriptions work end-to-end
- [ ] Documentation is updated and validated
- [ ] `scripts/validate-phase3.sh` passes

---

## 12. Estimated Timeline

| Task | Time | Cumulative |
|------|------|------------|
| CI workflow updates | 30 min | 30 min |
| Renovate configuration | 15 min | 45 min |
| Playwright webServer | 20 min | 1h 5min |
| Env var validation | 30 min | 1h 35min |
| Docker Compose docs | 10 min | 1h 45min |
| Build verification | 45 min | 2h 30min |
| Documentation updates | 30 min | 3h |
| Testing & validation | 30 min | 3h 30min |
| **Total** | **3.5 hours** | |

**Buffer for issues**: +30 minutes  
**Total estimated time**: **4 hours**

---

## 13. Contact & Support

**Questions about Phase 3?**
- Review this document thoroughly first
- Check `docs/TROUBLESHOOTING.md` for common issues
- Consult team lead or senior developer

**Reporting Issues**:
- Create GitHub issue with label `phase3`
- Include error messages, logs, and steps to reproduce
- Tag relevant team members

---

## Appendix A: Related Documentation

- [SECURITY.md](./SECURITY.md) - Security hardening patterns
- [FRONTEND_SETUP.md](./FRONTEND_SETUP.md) - Frontend configuration details
- [GRAPHQL_SUBSCRIPTIONS_SETUP.md](./GRAPHQL_SUBSCRIPTIONS_SETUP.md) - WebSocket setup
- [INFRASTRUCTURE_SETUP.md](./INFRASTRUCTURE_SETUP.md) - Backend infrastructure patterns
- [TESTING_INTEGRATION.md](./TESTING_INTEGRATION.md) - Integration testing guide
- [OBSERVABILITY.md](./OBSERVABILITY.md) - Monitoring and tracing

---

## Appendix B: Quick Reference Commands

```bash
# Phase 3 validation
./scripts/validate-phase3.sh

# Type check all workspaces
npm run typecheck

# Build all workspaces
npm run build

# Start backend (requires Docker services)
docker-compose up -d
npm run dev:backend

# Start frontend
npm run dev:frontend

# Run E2E tests
npm run test:e2e

# Run env var validation
./scripts/validate-env-vars.sh

# Check CI workflow syntax
npx yaml-lint .github/workflows/ci.yml
```

---

**Document Version**: 1.0  
**Last Reviewed**: 2025-10-20  
**Next Review**: After integration test implementation
