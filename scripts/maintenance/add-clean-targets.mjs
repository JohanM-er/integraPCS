/**
 * Automation to add an Nx "clean" target to all project.json files.
 *
 * It scans the repo for project.json (excluding node_modules, dist, etc.),
 * and injects:
 *   "clean": {
 *     "executor": "nx:run-commands",
 *     "options": {
 *       "command": "node scripts/clean/clean-stray-compiled.mjs {projectRoot}"
 *     }
 *   }
 *
 * Usage:
 *   node scripts/maintenance/add-clean-targets.mjs         # dry-run (prints planned changes)
 *   node scripts/maintenance/add-clean-targets.mjs --apply # writes changes
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const apply = process.argv.includes('--apply');

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

function rel(p) {
  return path.relative(workspaceRoot, p) || '.';
}

async function walkFindProjectJson(dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await walkFindProjectJson(fullPath, out);
    } else if (entry.isFile() && entry.name === 'project.json') {
      out.push(fullPath);
    }
  }
  return out;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function stringifyJson(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function ensureTargets(container) {
  if (!container.targets && container.architect) {
    // Normalize older "architect" to "targets"
    container.targets = container.architect;
    delete container.architect;
  }
  if (!container.targets) {
    container.targets = {};
  }
}

function hasCleanTarget(container) {
  return Boolean(container.targets && container.targets.clean);
}

function makeCleanTarget() {
  return {
    executor: 'nx:run-commands',
    options: {
      command: 'node scripts/clean/clean-stray-compiled.mjs {projectRoot}'
    }
  };
}

async function processProjectJson(p) {
  const json = await readJson(p);
  ensureTargets(json);

  if (hasCleanTarget(json)) {
    return { path: p, changed: false, reason: 'already_has_clean' };
  }

  json.targets.clean = makeCleanTarget();

  if (apply) {
    await fs.writeFile(p, stringifyJson(json), 'utf8');
    return { path: p, changed: true };
  } else {
    return { path: p, changed: false, preview: stringifyJson(json) };
  }
}

(async function main() {
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(apply ? 'Mode: APPLY' : 'Mode: DRY-RUN');

  const projectFiles = await walkFindProjectJson(workspaceRoot);
  if (projectFiles.length === 0) {
    console.log('No project.json files found.');
    return;
  }

  let changed = 0;
  for (const p of projectFiles) {
    try {
      const res = await processProjectJson(p);
      if (res.changed) {
        changed += 1;
        console.log(`Updated: ${rel(res.path)}`);
      } else if (res.reason === 'already_has_clean') {
        console.log(`Skipped (exists): ${rel(res.path)}`);
      } else if (res.preview) {
        console.log(`Would update: ${rel(res.path)}`);
      }
    } catch (err) {
      console.error(`Failed to process ${rel(p)}:`, err.message);
    }
  }

  if (apply) {
    console.log(`Done. Updated ${changed} project.json file(s).`);
  } else {
    console.log('Dry run complete. Re-run with --apply to write changes.');
  }
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});