/**
 * Pre-commit checker that scans only staged .ts/.tsx files for "require(" usage.
 * Excludes dist and other ignored paths intrinsically by selecting staged files
 * and filtering by extension.
 *
 * Hook:
 *   Add to .husky/pre-commit (example):
 *     node scripts/validate/check-staged-ts-require.mjs
 *
 * Exit codes:
 *   0 - OK
 *   1 - Violations found
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function getStagedFiles() {
  const out = execSync('git diff --name-only --cached --diff-filter=ACMRT', {
    encoding: 'utf8'
  });
  return out.split('\n').map(s => s.trim()).filter(Boolean);
}

function shouldScan(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.ts' && ext !== '.tsx') return false;
  if (file.includes('node_modules/')) return false;
  if (file.includes('/dist/')) return false;
  if (file.includes('/generated/')) return false;
  if (file.includes('/storybook-static/')) return false;
  if (file.includes('/coverage/')) return false;
  return true;
}

function findRequireUsages(content) {
  // Naive scan: flag lines containing "require(" that are not in comments
  const lines = content.split(/\r?\n/);
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines that are clearly comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('*/')) continue;

    if (/\brequire\s*\(/.test(line)) {
      matches.push({ line: i + 1, code: line });
    }
  }
  return matches;
}

function main() {
  const staged = getStagedFiles().filter(shouldScan);
  if (staged.length === 0) {
    process.exit(0);
  }

  const violations = [];
  for (const f of staged) {
    const content = fs.readFileSync(f, 'utf8');
    const found = findRequireUsages(content);
    if (found.length > 0) {
      violations.push({ file: f, occurrences: found });
    }
  }

  if (violations.length > 0) {
    console.error('Found require() usage in staged TypeScript files:');
    for (const v of violations) {
      console.error(`\n${v.file}`);
      for (const occ of v.occurrences) {
        console.error(`  ${occ.line}: ${occ.code}`);
      }
    }
    console.error('\nIf these are intended CommonJS uses, consider refactoring to ESM imports or update the pre-commit policy.');
    process.exit(1);
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error('check-staged-ts-require failed:', err);
  // Fail closed to keep hook strict
  process.exit(1);
}