# integraPCS Stack Upgrade Plan

**Created:** 2026-01-16
**Status:** Draft
**Author:** Claude Code

---

## Executive Summary

This document outlines the upgrade plan for integraPCS to resolve compatibility issues that required version locking of Node.js, and to bring the stack up to current stable versions.

### Root Cause Analysis

The project was locked to older versions due to:
1. **Nx 19.8.4** - Did not fully support React 19 (generators defaulted to React 18)
2. **Node 20.11.0** - Pinned to avoid Nx 20.x installation bugs with Node 20/22
3. **Storybook 8.3** - Had React 19 compatibility issues (manager bundle errors)

All these issues have been resolved in current ecosystem versions.

---

## Current vs Target Versions

| Package | Current | Target | Change Type |
|---------|---------|--------|-------------|
| Node.js | 20.11.0 (pinned) | 20.19.0+ | Patch bump |
| Nx | 19.8.4 | 22.3.3 | Major (3 versions) |
| Storybook | 8.3.0 | 9.x | Major |
| Vite | 6.3.1 | 6.x (keep) or 7.x | Optional major |
| React | 19.0.0 | 19.x | No change needed |
| TypeScript | 5.9.3 | 5.9.x | No change needed |
| Tailwind | 4.0.0 | 4.x | No change needed |

---

## Compatibility Matrix (Verified)

| Combination | Status | Source |
|-------------|--------|--------|
| Nx 22 + React 19 | ✅ Compatible | Nx 20.5+ added support |
| Nx 22 + Node 20.19 | ✅ Compatible | Fully supported |
| Nx 22 + Vite 6/7 | ✅ Compatible | @nx/vite supports both |
| Storybook 9 + React 19 | ✅ Compatible | Full support |
| Storybook 9 + Vite 5+ | ✅ Compatible | Vite 4 dropped |
| Storybook 9 + Node 20+ | ✅ Compatible | Required minimum |
| Apollo Client 3.x + React 19 | ✅ Compatible | Supports latest 2 majors |
| Radix UI + React 19 | ✅ Compatible | Fully supported |
| React Router 7 + React 19 | ✅ Compatible | Built for React 19 |
| TanStack Table 8 + React 19 | ⚠️ Partial | Works, React Compiler may have issues |
| Zustand 4 + React 19 | ✅ Compatible | Handles concurrency |
| React Hook Form 7 + React 19 | ✅ Compatible | Supported |
| Tailwind v4 + Vite 6/7 | ✅ Compatible | Use @tailwindcss/vite |
| TypeScript 5.9 + All | ✅ Compatible | Exceeds all minimums |

---

## Upgrade Phases

### Phase 1: Node.js Version Files (Low Risk)

**Objective:** Update pinned Node version to match current runtime.

**Files to update:**
- `.node-version` → `20.19.0`
- `.nvmrc` → `20.19.0`

**Steps:**
```bash
# Update version files
echo "20.19.0" > .node-version
echo "20.19.0" > .nvmrc

# Verify
cat .node-version .nvmrc
node --version  # Should show v20.19.0
```

**Verification:**
- [ ] `.node-version` updated
- [ ] `.nvmrc` updated
- [ ] `node --version` matches
- [ ] `pnpm install` succeeds
- [ ] `pnpm nx run-many -t build` succeeds

**Rollback:** Revert files to `20.11.0`

---

### Phase 2: Nx Upgrade 19.8.4 → 22.x (Medium Risk)

**Objective:** Upgrade Nx to latest stable with full React 19 support.

**Pre-requisites:**
- Phase 1 complete
- Clean git working tree
- All tests passing

**Steps:**
```bash
# 1. Create upgrade branch
git checkout -b chore/nx-upgrade-22

# 2. Run Nx migrate (will update package.json and create migrations.json)
npx nx migrate nx@latest

# 3. Install updated packages
pnpm install

# 4. Run migrations
npx nx migrate --run-migrations

# 5. Clean up
rm migrations.json

# 6. Verify build
pnpm nx run-many -t build

# 7. Run tests
pnpm nx run-many -t test

# 8. Run linting
pnpm nx run-many -t lint
```

**Breaking Changes to Watch:**
- Project graph changes
- New caching behavior
- Plugin API changes (if custom plugins exist)
- `@nrwl/*` packages renamed to `@nx/*` (should be automatic)

**Verification:**
- [ ] `nx --version` shows 22.x
- [ ] `pnpm nx graph` works
- [ ] All projects build successfully
- [ ] All tests pass
- [ ] Lint passes
- [ ] Dev server starts (`pnpm nx serve api` and `pnpm nx serve web`)

**Rollback:**
```bash
git checkout main
git branch -D chore/nx-upgrade-22
```

---

### Phase 3: Storybook Upgrade 8.3 → 9.x (Medium Risk)

**Objective:** Upgrade Storybook for full React 19 compatibility.

**Pre-requisites:**
- Phase 2 complete
- Nx 22.x installed

**Steps:**
```bash
# 1. Create upgrade branch (or continue from Phase 2)
git checkout -b chore/storybook-upgrade-9

# 2. Run Storybook upgrade
cd frontend
npx storybook@latest upgrade

# 3. Follow prompts for automatic migrations

# 4. Install dependencies
pnpm install

# 5. Test Storybook
pnpm storybook

# 6. Build Storybook
pnpm storybook:build
```

**Breaking Changes (Storybook 9):**
- Requires Node.js 20+ ✓ (we have 20.19)
- Requires Vite 5+ ✓ (we have 6.x)
- Requires TypeScript 4.9+ ✓ (we have 5.9)
- Dropped Vite 4 support
- Package manager minimums: npm 10+, yarn 4+, pnpm 9+

**Verification:**
- [ ] `pnpm storybook` starts without errors
- [ ] All stories render correctly
- [ ] No React 19 manager bundle errors
- [ ] `pnpm storybook:build` succeeds
- [ ] Chromatic (if used) passes

**Rollback:**
```bash
git checkout main
git branch -D chore/storybook-upgrade-9
```

---

### Phase 4: Vite Upgrade 6 → 7 (Optional, Medium Risk)

**Objective:** Upgrade to Vite 7 for improved build performance with Rolldown.

**Note:** This phase is optional. Vite 6 is still supported and works well.

**Pre-requisites:**
- Phase 3 complete
- Node 20.19+ ✓

**Steps:**
```bash
# 1. Create upgrade branch
git checkout -b chore/vite-upgrade-7

# 2. Update Vite in frontend
cd frontend
pnpm add vite@latest @vitejs/plugin-react@latest

# 3. Update any Vite plugins
pnpm add -D @tailwindcss/vite@latest

# 4. Review vite.config.ts for deprecated options
# - Check for splitVendorChunkPlugin (removed)
# - Check for Sass legacy API usage (removed)

# 5. Test dev server
pnpm dev

# 6. Test build
pnpm build
```

**Breaking Changes (Vite 7):**
- Requires Node 20.19+ or 22.12+
- ESM-only distribution
- Dropped `splitVendorChunkPlugin`
- Dropped Sass legacy API
- Default browser target changed to Baseline Widely Available

**Verification:**
- [ ] `pnpm dev` starts without errors
- [ ] `pnpm build` succeeds
- [ ] HMR works correctly
- [ ] Production build runs correctly

**Rollback:**
```bash
pnpm add vite@6 @vitejs/plugin-react@4
```

---

## Risk Assessment Summary

| Phase | Risk | Impact | Mitigation |
|-------|------|--------|------------|
| 1. Node version | 🟢 Low | Minimal | Easy file revert |
| 2. Nx upgrade | 🟡 Medium | Build system | Branch + migrate tool |
| 3. Storybook | 🟡 Medium | Component dev | Branch + upgrade script |
| 4. Vite (optional) | 🟡 Medium | Build tooling | Can skip or revert |

---

## Testing Checklist

After all upgrades complete:

### Build & Compile
- [ ] `pnpm install` - no errors
- [ ] `pnpm nx run-many -t build` - all projects build
- [ ] `pnpm nx run-many -t typecheck` - no type errors

### Development
- [ ] `pnpm nx serve api` - API starts on :3000
- [ ] `pnpm nx serve web` - Web starts on :5173
- [ ] Hot reload works in frontend
- [ ] GraphQL playground accessible

### Testing
- [ ] `pnpm nx run-many -t test` - all unit tests pass
- [ ] `pnpm nx e2e web` - E2E tests pass (if configured)

### Storybook
- [ ] `pnpm storybook` - starts without errors
- [ ] All component stories render
- [ ] No console errors

### Infrastructure
- [ ] `docker-compose up -d` - services start
- [ ] Neo4j accessible at :7474
- [ ] RabbitMQ accessible at :15672
- [ ] Redis accessible at :6379

---

## Rollback Plan

If critical issues are found:

1. **Immediate:** `git checkout main` to return to working state
2. **Partial:** Cherry-pick successful phases from upgrade branches
3. **Investigation:** Create issue with error logs for debugging

---

## Post-Upgrade Tasks

After successful upgrade:

1. [ ] Update `CLAUDE.md` with new version requirements
2. [ ] Update CI/CD Node version if pinned
3. [ ] Remove any version override/resolution hacks
4. [ ] Update team documentation
5. [ ] Notify team of completed upgrade

---

## References

- [Nx Migration Guide](https://nx.dev/recipes/tips-n-tricks/advanced-update)
- [Storybook 9 Migration](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md)
- [Vite 7 Announcement](https://vite.dev/blog/announcing-vite7)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
