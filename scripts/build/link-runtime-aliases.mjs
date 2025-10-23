#!/usr/bin/env node

/**
 * Link or copy compiled libraries into a built app's node_modules to satisfy
 * Node's runtime resolution for path aliases like:
 *   - @platform/*
 *   - @contexts/*
 *   - @shared/*
 *
 * Usage:
 *   node scripts/build/link-runtime-aliases.mjs apps/api
 *
 * Behavior:
 * - Resolves the app output directory at dist/<appPath> (e.g., dist/apps/api).
 * - For each scope (@platform, @contexts, @shared), inspects dist/<scope>/*.
 * - For each library under a scope:
 *     - If dist/<scope>/<lib>/src exists, link/copy that (flatten src).
 *     - Otherwise, link/copy dist/<scope>/<lib> directly.
 * - Creates dist/<appPath>/node_modules/@<scope>/<lib> as a symlink to payload.
 *   - Uses 'junction' on Windows, 'dir' elsewhere.
 *   - Falls back to recursive copy if symlink fails (or if FORCE_COPY is set).
 *
 * Notes:
 * - Set environment variable LINK_RUNTIME_ALIASES_COPY=1 to force copy mode.
 */

import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SCOPES = [
  { label: '@platform', distRoot: path.join(REPO_ROOT, 'dist', 'platform') },
  { label: '@contexts', distRoot: path.join(REPO_ROOT, 'dist', 'contexts') },
  { label: '@shared', distRoot: path.join(REPO_ROOT, 'dist', 'shared') }
];

const FORCE_COPY = String(process.env.LINK_RUNTIME_ALIASES_COPY || '').trim() === '1';

function logInfo(msg) {
  console.log(`[link-runtime-aliases] ${msg}`);
}

function logWarn(msg) {
  console.warn(`[link-runtime-aliases] WARN: ${msg}`);
}

function logError(msg, err) {
  console.error(`[link-runtime-aliases] ERROR: ${msg}${err ? `\n  → ${err.message || err}` : ''}`);
}

async function pathExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure parent directory exists and remove target if present.
 */
async function prepareDestination(destDir) {
  const parent = path.dirname(destDir);
  await fs.mkdir(parent, { recursive: true });
  // Remove any existing file/symlink/directory at destination
  await fs.rm(destDir, { recursive: true, force: true });
}

/**
 * Try to symlink payload -> destDir. Fall back to copyDir on failure.
 */
async function linkOrCopy(payload, destDir) {
  await prepareDestination(destDir);

  if (!FORCE_COPY) {
    try {
      const isWin = process.platform === 'win32';
      const type = isWin ? 'junction' : 'dir';
      await fs.symlink(payload, destDir, type);
      logInfo(`Linked ${destDir} → ${payload} (symlink: ${type})`);
      return 'symlink';
    } catch (err) {
      logWarn(`Symlink failed for ${destDir} → ${payload}. Falling back to copy. (${err?.code || 'unknown error'})`);
    }
  }

  // Fallback: recursive copy
  // Prefer fs.cp if available (Node 16.7+); otherwise implement simple copy.
  if (typeof fs.cp === 'function') {
    await fs.cp(payload, destDir, { recursive: true });
  } else {
    await copyDirRecursive(payload, destDir);
  }
  logInfo(`Copied  ${destDir} ← ${payload}`);
  return 'copy';
}

async function copyDirRecursive(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(s, d);
    } else if (entry.isSymbolicLink()) {
      // Resolve target and recreate symlink where possible; otherwise copy file contents
      const target = await fs.readlink(s).catch(() => null);
      if (target) {
        const linkType = process.platform === 'win32' ? 'junction' : 'file';
        try {
          await fs.symlink(target, d, linkType);
        } catch {
          await fs.copyFile(s, d);
        }
      } else {
        await fs.copyFile(s, d);
      }
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    } else {
      // Other types (FIFO, socket) are unexpected in dist; skip
    }
  }
}

/**
 * Returns the effective payload directory for a compiled library:
 * - Prefer <libRoot>/src if it exists (flattening src)
 * - Otherwise use <libRoot> itself
 */
async function resolvePayload(libRoot) {
  const srcDir = path.join(libRoot, 'src');
  if (await pathExists(srcDir)) {
    return srcDir;
  }
  return libRoot;
}

async function processScope(scopeLabel, scopeDistRoot, appNodeModulesRoot) {
  const scopeNameWithoutAt = scopeLabel.startsWith('@') ? scopeLabel.slice(1) : scopeLabel;
  const destScopeRoot = path.join(appNodeModulesRoot, scopeLabel);

  if (!(await pathExists(scopeDistRoot))) {
    logWarn(`Scope dist root not found: ${scopeDistRoot}. Skipping ${scopeLabel}.`);
    return { processed: 0, errors: 0 };
  }

  const entries = await fs.readdir(scopeDistRoot, { withFileTypes: true });
  const libs = entries.filter(e => e.isDirectory()).map(e => e.name);

  if (!libs.length) {
    logWarn(`No libraries found under ${scopeDistRoot}.`);
    return { processed: 0, errors: 0 };
  }

  await fs.mkdir(destScopeRoot, { recursive: true });

  let processed = 0;
  let errors = 0;

  for (const libName of libs) {
    const libRoot = path.join(scopeDistRoot, libName);
    const payload = await resolvePayload(libRoot);
    const destDir = path.join(destScopeRoot, libName);

    try {
      await linkOrCopy(payload, destDir);
      processed++;
    } catch (err) {
      errors++;
      logError(`Failed to link/copy ${scopeLabel}/${libName} (${payload} → ${destDir})`, err);
    }
  }

  logInfo(
    `Scope ${scopeLabel}: ${processed} libraries processed${errors ? `, ${errors} error(s)` : ''}.`
  );

  return { processed, errors };
}

function usage() {
  console.error('Usage: node scripts/build/link-runtime-aliases.mjs <appPath>');
  console.error('Example: node scripts/build/link-runtime-aliases.mjs apps/api');
}

async function main(argv) {
  const appPath = (argv[0] || '').trim();
  if (!appPath) {
    usage();
    process.exit(2);
    return;
  }

  const appDist = path.join(REPO_ROOT, 'dist', ...appPath.split(/[\\/]+/).filter(Boolean));
  const appNodeModulesRoot = path.join(appDist, 'node_modules');

  await fs.mkdir(appNodeModulesRoot, { recursive: true });

  logInfo(`App dist: ${appDist}`);
  logInfo(`Node modules root: ${appNodeModulesRoot}`);
  if (FORCE_COPY) {
    logInfo('FORCE_COPY enabled via LINK_RUNTIME_ALIASES_COPY=1');
  }

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const scope of SCOPES) {
    const { processed, errors } = await processScope(scope.label, scope.distRoot, appNodeModulesRoot);
    totalProcessed += processed;
    totalErrors += errors;
  }

  if (totalErrors > 0) {
    logWarn(`Completed with ${totalErrors} error(s); some aliases may not resolve at runtime.`);
    process.exit(1);
    return;
  }

  logInfo(`Success. Linked/copied ${totalProcessed} libraries for runtime alias resolution.`);
  process.exit(0);
}

try {
  // Drop first two argv entries (node, script)
  const args = process.argv.slice(2);
  await main(args);
} catch (err) {
  logError('Unhandled error during linking', err);
  process.exit(2);
}