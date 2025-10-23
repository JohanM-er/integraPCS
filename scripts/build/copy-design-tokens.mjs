#!/usr/bin/env node

/**
 * Copies design tokens from packages/design-tokens/src into
 * dist/packages/design-tokens/src and also copies the package.json
 * for completeness. Ensures all directories exist and performs a
 * clean rebuild of the dist folder for this package.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function logInfo(msg) {
  console.log(`[copy-design-tokens] ${msg}`);
}

function logError(msg, err) {
  console.error(`[copy-design-tokens] ERROR: ${msg}${err ? `\n  → ${err.message || err}` : ''}`);
}

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const srcDir = path.join(REPO_ROOT, 'packages', 'design-tokens', 'src');
  const distRoot = path.join(REPO_ROOT, 'dist', 'packages', 'design-tokens');
  const distSrcDir = path.join(distRoot, 'src');
  const tokensSrc = path.join(srcDir, 'tokens.css');

  logInfo(`Repo root: ${REPO_ROOT}`);
  logInfo(`Source dir: ${srcDir}`);
  logInfo(`Dist root : ${distRoot}`);

  if (!(await exists(srcDir))) {
    throw new Error(`Source directory not found: ${srcDir}`);
  }
  if (!(await exists(tokensSrc))) {
    throw new Error(`Missing tokens.css at: ${tokensSrc}`);
  }

  // Clean previous dist contents for this package
  await fs.rm(distRoot, { recursive: true, force: true });
  await fs.mkdir(distSrcDir, { recursive: true });

  // Copy tokens.css
  const tokensDest = path.join(distSrcDir, 'tokens.css');
  await fs.copyFile(tokensSrc, tokensDest);
  logInfo(`Copied tokens.css → ${path.relative(REPO_ROOT, tokensDest)}`);

  // Optionally copy package.json for completeness
  const pkgSrc = path.join(REPO_ROOT, 'packages', 'design-tokens', 'package.json');
  if (await exists(pkgSrc)) {
    const pkgDest = path.join(distRoot, 'package.json');
    await fs.copyFile(pkgSrc, pkgDest);
    logInfo(`Copied package.json → ${path.relative(REPO_ROOT, pkgDest)}`);
  } else {
    logInfo('package.json not found in packages/design-tokens (skipping).');
  }

  logInfo('Success. Design tokens prepared in dist.');
  process.exit(0);
}

try {
  await main();
} catch (err) {
  logError('Failed to build design tokens.', err);
  process.exit(1);
}