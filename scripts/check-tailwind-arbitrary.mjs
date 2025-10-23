#!/usr/bin/env node

// CI-time validation: Detect Tailwind arbitrary values in className props
// Scope: apps/web/src/**/*.{ts,tsx,js,jsx}
// Detection strategy:
// - Prefer: extract same-line className string value; scan for arbitrary tokens with brackets [...]
const SEARCH_GLOB = 'apps/web/src/**/*.{ts,tsx,js,jsx}';
// - Matches align with pre-commit guardrails (line-based heuristic)
//
// Allowlist:
// - Optional file at scripts/config/tailwind-arbitrary-allowlist.json
// - Schema: [{ "file": "frontend/src/...", "line": 123, "reason": "..." }, { "pattern": "data-\\[state=...", "flags": "i", "reason": "..." }]
//
// Exit codes:
// - 0: clean
// - 1: violations found
// - 2: runtime error

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SEARCH_GLOB = 'frontend/src/**/*.{ts,tsx,js,jsx}';
const DEFAULT_ALLOWLIST = path.join(REPO_ROOT, 'scripts/config/tailwind-arbitrary-allowlist.json');

// Regexes
// Match a same-line className string value: className="..." or className={'...'} or className={`...`}
const CLASSNAME_VALUE_RE = /className\s*=\s*{?\s*(['"`])([^'"`]*?)\1\s*}?/;
// Broadly flag a token that contains a bracket expression, e.g., p-[13px], text-[#333], data-[state=open]
const ARBITRARY_RE = /(^|\s)[!@]?(?:[\w-:/]*?)\[[^\]]+\]/g;
// Fallback: any non-escaped bracket expression [...] (used when we can't isolate the className value)
const ANY_BRACKETS_RE = /(?<!\\)\[[^\]]+\]/;

/**
 * Normalize to a POSIX-style repo-relative path.
 */
function toRepoRelativePosix(filePath) {
  const rel = path.relative(REPO_ROOT, filePath);
  return rel.split(path.sep).join('/');
}

/**
 * Load allowlist entries if present.
 */
async function loadAllowlist(allowlistPath) {
  try {
    const raw = await fs.readFile(allowlistPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Compile allowlist for efficient checks.
 */
function compileAllowlist(entries) {
  const byFileLine = new Map(); // Map<string, Set<number>>
  const regexes = []; // RegExp[]

  for (const e of entries) {
    if (e && typeof e.file === 'string' && typeof e.line === 'number') {
      const key = e.file.replace(/\\/g, '/');
      if (!byFileLine.has(key)) byFileLine.set(key, new Set());
      byFileLine.get(key).add(e.line);
    }
    if (e && typeof e.pattern === 'string') {
      try {
        regexes.push(new RegExp(e.pattern, e.flags || ''));
      } catch {
        // Ignore invalid regex entries
      }
    }
  }
  return { byFileLine, regexes };
}

/**
 * Check if a violation is allowed by the compiled allowlist.
 */
function isAllowed(fileRel, lineNum, fragment, allowlistCompiled) {
  const set = allowlistCompiled.byFileLine.get(fileRel);
  if (set && set.has(lineNum)) return true;

  if (fragment && allowlistCompiled.regexes.length) {
    for (const r of allowlistCompiled.regexes) {
      if (r.test(fragment)) return true;
    }
  }
  return false;
}

/**
 * Detect one or more arbitrary tokens in a single line.
 * Returns an array of { fragment, col } objects (1-based column).
 */
function detectArbitraryTokensInLine(line) {
  const results = [];
  if (!line.includes('className')) return results;

  // Preferred path: extract same-line className string value
  const valueMatch = CLASSNAME_VALUE_RE.exec(line);
  if (valueMatch) {
    const quoteChar = valueMatch[1];
    const valueStr = valueMatch[2];

    // Compute the starting column of the value content within the original line
    const openingQuoteIndexInMatch = valueMatch[0].indexOf(quoteChar);
    const valueStartInLine = valueMatch.index + openingQuoteIndexInMatch + 1; // 0-based index of first char inside quotes

    ARBITRARY_RE.lastIndex = 0;
    let inner;
    while ((inner = ARBITRARY_RE.exec(valueStr)) !== null) {
      const raw = inner[0];
      const token = raw.trim();
      const leadingWs = raw.length - token.length;
      const col = valueStartInLine + inner.index + leadingWs + 1; // 1-based column in original line
      results.push({ fragment: token, col });
      // Continue to find other tokens on the same line
    }
    return results;
  }

  // Fallback: scan for any bracketed tokens after "className"
  const classIdx = line.indexOf('className');
  let searchIdx = classIdx >= 0 ? classIdx : 0;

  while (true) {
    const bracketIdx = line.indexOf('[', searchIdx);
    if (bracketIdx === -1) break;

    const slice = line.slice(bracketIdx);
    if (!ANY_BRACKETS_RE.test(slice)) {
      // Move past this bracket and continue
      searchIdx = bracketIdx + 1;
      continue;
    }

    // Expand to token boundaries (whitespace or common delimiters)
    const delims = new Set([' ', '\t', '\r', '\n', '"', "'", '`', '(', ')', '{', '}', '<', '>', ',', ';']);
    let left = bracketIdx - 1;
    while (left >= 0 && !delims.has(line[left])) left--;
    let right = bracketIdx + 1;
    while (right < line.length && !delims.has(line[right])) right++;

    const fragment = line.slice(left + 1, right);
    const col = left + 2; // 1-based
    results.push({ fragment, col });

    searchIdx = right;
  }

  return results;
}

/**
 * Scan a file and return violations.
 */
async function scanFile(absPath, allowlistCompiled) {
  const fileRel = toRepoRelativePosix(absPath);
  const content = await fs.readFile(absPath, 'utf-8');
  const lines = content.split(/\r?\n/);

  /** @type {{file: string, line: number, column: number, snippet: string, fragment: string}[]} */
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tokens = detectArbitraryTokensInLine(line);
    if (!tokens.length) continue;

    for (const t of tokens) {
      if (!t || !t.fragment) continue;
      const lineNum = i + 1;
      if (isAllowed(fileRel, lineNum, t.fragment, allowlistCompiled)) continue;

      violations.push({
        file: fileRel,
        line: lineNum,
        column: t.col || 1,
        snippet: line,
        fragment: t.fragment,
      });
    }
  }

  return violations;
}

/**
 * Pretty-print violations with file:line:column and caret indicators.
 */
function printViolations(violations) {
  for (const v of violations) {
    const loc = `${v.file}:${v.line}:${v.column}`;
    console.error(`${loc} Tailwind arbitrary value detected: ${v.fragment}`);
    if (v.snippet != null) {
      // Do not trim left spaces; caret alignment depends on original indentation
      console.error(`  ${v.snippet}`);
      const caretPad = v.column > 1 ? ' '.repeat(v.column - 1) : '';
      console.error(`  ${caretPad}^`);
    }
  }
  if (violations.length) {
    console.error(`\nFound ${violations.length} Tailwind arbitrary value violation(s).`);
    console.error('This check mirrors the pre-commit hook and scans only className lines in apps/web/src.');
    console.error('For temporary exceptions, add an entry to scripts/config/tailwind-arbitrary-allowlist.json with a reason.');
  }
}

/**
 * Parse minimal CLI flags.
 */
function parseArgs(argv) {
  const args = { allowlist: DEFAULT_ALLOWLIST };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--allowlist' && i + 1 < argv.length) {
      args.allowlist = path.resolve(process.cwd(), argv[i + 1]);
      i++;
    }
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  const entries = await loadAllowlist(args.allowlist);
  const allowlistCompiled = compileAllowlist(entries);

  const files = await glob(SEARCH_GLOB, { cwd: REPO_ROOT, nodir: true });
  let allViolations = [];

  for (const rel of files) {
    const abs = path.join(REPO_ROOT, rel);
    const v = await scanFile(abs, allowlistCompiled);
    if (v.length) {
      allViolations = allViolations.concat(v);
    }
  }

  if (allViolations.length) {
    printViolations(allViolations);
    return 1;
  }

  console.log('✅ No Tailwind arbitrary values found in frontend/src');
  return 0;
}

try {
  const code = await main(process.argv.slice(2));
  process.exit(code);
} catch (err) {
  console.error('❌ Error running Tailwind arbitrary values check:', err?.message || err);
  process.exit(2);
}