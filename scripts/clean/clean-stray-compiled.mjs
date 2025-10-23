/**
 * Repo-wide cleaner for stray compiled TS artifacts and dist outputs.
 * - Removes .js, .d.ts, .js.map, .d.ts.map files under src/ in:
 *   - platform/*, shared/*, contexts/*
 * - Removes *.tsbuildinfo files anywhere in the repo
 * - Removes dist/ directory (or dist/<projectRoot> if projectRoot is provided)
 *
 * Usage:
 *   node scripts/clean/clean-stray-compiled.mjs                # Global clean (src artifacts + dist)
 *   node scripts/clean/clean-stray-compiled.mjs --no-dist      # Clean src artifacts only
 *   node scripts/clean/clean-stray-compiled.mjs --only-dist    # Clean dist only
 *   node scripts/clean/clean-stray-compiled.mjs <projectRoot>      # Clean a specific project (src + its dist)
 *   node scripts/clean/clean-stray-compiled.mjs <projectRoot> --only-dist
 *   node scripts/clean/clean-stray-compiled.mjs --dry-run
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.nx',
  'storybook-static',
  'generated',
  'build',
  'tmp',
  '.turbo'
]);

const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  noDist: args.includes('--no-dist'),
  onlyDist: args.includes('--only-dist')
};

// Determine if the first non-flag argument is a projectRoot path
const projectArg = args.find(a => !a.startsWith('-')) || null;
const projectRoot = projectArg ? path.resolve(workspaceRoot, projectArg) : null;

function rel(p) {
  return path.relative(workspaceRoot, p) || '.';
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rm(targetPath) {
  if (!(await exists(targetPath))) return false;
  if (options.dryRun) {
    console.log(`[dry-run] rm -rf ${rel(targetPath)}`);
    return true;
  }
  await fs.rm(targetPath, { recursive: true, force: true });
  return true;
}

async function removeFile(filePath) {
  if (!(await exists(filePath))) return false;
  if (options.dryRun) {
    console.log(`[dry-run] rm ${rel(filePath)}`);
    return true;
  }
  await fs.unlink(filePath);
  return true;
}

function isCompiledFile(fileName) {
  // Remove only compiled artifacts:
  // - *.js
  // - *.d.ts
  // - *.js.map
  // - *.d.ts.map
  if (fileName.endsWith('.d.ts')) return true;
  if (fileName.endsWith('.d.ts.map')) return true;
  if (fileName.endsWith('.js.map')) return true;
  const ext = path.extname(fileName).toLowerCase();
  return ext === '.js';
}

async function walkDir(dir, onDir, onFile) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (onDir) await onDir(fullPath, entry);
      await walkDir(fullPath, onDir, onFile);
    } else if (entry.isFile()) {
      if (onFile) await onFile(fullPath, entry);
    }
  }
}

async function findSrcDirsUnder(baseDir) {
  const results = [];
  await walkDir(baseDir, async (dirPath) => {
    if (path.basename(dirPath) === 'src') {
      results.push(dirPath);
    }
  });
  return results;
}

async function cleanStrayCompiledUnderSrc(srcDir) {
  let removedCount = 0;
  await walkDir(srcDir, null, async (filePath) => {
    const name = path.basename(filePath);
    if (isCompiledFile(name)) {
      const removed = await removeFile(filePath);
      if (removed) removedCount += 1;
    }
  });
  return removedCount;
}

async function removeTsBuildInfoFiles(root) {
  let removedCount = 0;
  await walkDir(root, null, async (filePath) => {
    if (filePath.endsWith('.tsbuildinfo')) {
      const removed = await removeFile(filePath);
      if (removed) removedCount += 1;
    }
  });
  return removedCount;
}

async function cleanProject(projectRootPath) {
  let totalRemoved = 0;
  const srcPath = path.join(projectRootPath, 'src');

  if (!options.onlyDist) {
    if (await exists(srcPath)) {
      const removed = await cleanStrayCompiledUnderSrc(srcPath);
      totalRemoved += removed;
      console.log(`Cleaned ${removed} compiled files in ${rel(srcPath)}`);
    } else {
      console.log(`No src/ directory found in ${rel(projectRootPath)}, skipping compiled-file cleanup.`);
    }
    const tsbuildinfoRemoved = await removeTsBuildInfoFiles(projectRootPath);
    if (tsbuildinfoRemoved > 0) {
      console.log(`Removed ${tsbuildinfoRemoved} *.tsbuildinfo files in ${rel(projectRootPath)}`);
    }
  }

  if (!options.noDist) {
    const distTarget = path.join(workspaceRoot, 'dist', path.relative(workspaceRoot, projectRootPath));
    if (await rm(distTarget)) {
      console.log(`Removed dist for project: ${rel(distTarget)}`);
    }
  }

  return totalRemoved;
}

async function cleanGlobal() {
  let totalRemoved = 0;

  if (!options.onlyDist) {
    const bases = ['platform', 'shared', 'contexts'].map(b => path.join(workspaceRoot, b));
    for (const base of bases) {
      if (!(await exists(base))) continue;
      const srcDirs = await findSrcDirsUnder(base);
      for (const srcDir of srcDirs) {
        const removed = await cleanStrayCompiledUnderSrc(srcDir);
        totalRemoved += removed;
        if (removed > 0) {
          console.log(`Cleaned ${removed} compiled files in ${rel(srcDir)}`);
        }
      }
    }
    const tsbuildinfoRemoved = await removeTsBuildInfoFiles(workspaceRoot);
    if (tsbuildinfoRemoved > 0) {
      console.log(`Removed ${tsbuildinfoRemoved} *.tsbuildinfo files across workspace`);
    }
  }

  if (!options.noDist) {
    const distRoot = path.join(workspaceRoot, 'dist');
    if (await rm(distRoot)) {
      console.log(`Removed dist directory: ${rel(distRoot)}`);
    }
  }

  return totalRemoved;
}

(async function main() {
  console.log(`Workspace: ${workspaceRoot}`);
  if (projectRoot) {
    console.log(`Project clean for: ${rel(projectRoot)}${options.dryRun ? ' (dry-run)' : ''}`);
    await cleanProject(projectRoot);
  } else {
    console.log(`Global clean${options.dryRun ? ' (dry-run)' : ''}`);
    await cleanGlobal();
  }
  console.log('Cleanup complete.');
})().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});