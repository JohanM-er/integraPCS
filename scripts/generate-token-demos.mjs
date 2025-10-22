#!/usr/bin/env node

/**
 * Generate HTML demo files from actual design tokens
 *
 * This script reads the design tokens from packages/design-tokens/src/tokens.css
 * and the button variants from frontend/src/lib/cva.ts, then generates
 * up-to-date HTML demo files.
 *
 * Usage:
 *   node scripts/generate-token-demos.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const TOKENS_FILE = path.join(REPO_ROOT, 'packages/design-tokens/src/tokens.css');
const CVA_FILE = path.join(REPO_ROOT, 'frontend/src/lib/cva.ts');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs/UI system/demos');

console.log('🎨 Generating token demo files...\n');

// Parse design tokens from CSS
function parseTokensFromCSS(cssContent) {
  const tokens = {};
  const themeMatch = cssContent.match(/@theme\s*{([^}]+)}/s);

  if (!themeMatch) {
    console.warn('⚠️  No @theme block found in tokens.css');
    return tokens;
  }

  const themeContent = themeMatch[1];
  const tokenRegex = /--([^:]+):\s*([^;]+);/g;
  let match;

  while ((match = tokenRegex.exec(themeContent)) !== null) {
    const [, name, value] = match;
    tokens[name.trim()] = value.trim();
  }

  return tokens;
}

// Parse button sizes from CVA config
function parseButtonSizesFromCVA(cvaContent) {
  const sizes = {};

  // Match the size variants block
  const sizeMatch = cvaContent.match(/size:\s*{([^}]+)}/s);

  if (!sizeMatch) {
    console.warn('⚠️  No size variants found in cva.ts');
    return sizes;
  }

  const sizeContent = sizeMatch[1];
  const sizeRegex = /(\w+):\s*'([^']+)'/g;
  let match;

  while ((match = sizeRegex.exec(sizeContent)) !== null) {
    const [, sizeName, classes] = match;
    sizes[sizeName] = classes;
  }

  return sizes;
}

// Generate limited-token-guidelines.html
function generateGuidelinesDemo(tokens, buttonSizes) {
  const cssVariables = Object.entries(tokens)
    .map(([name, value]) => `        --${name}: ${value};`)
    .join('\n');

  const buttonSizeStyles = Object.entries(buttonSizes)
    .map(([sizeName, classes]) => {
      // Parse Tailwind classes to CSS
      const paddingMatch = classes.match(/px-(\d+)\s+py-(\d+)/);
      const textMatch = classes.match(/text-(sm|base|lg|xl)/);

      const px = paddingMatch ? `var(--spacing-${paddingMatch[1]})` : 'var(--spacing-4)';
      const py = paddingMatch ? `var(--spacing-${paddingMatch[2]})` : 'var(--spacing-2)';
      const fontSize = textMatch ?
        (textMatch[1] === 'sm' ? 'var(--text-scale-0)' :
         textMatch[1] === 'base' ? 'var(--text-scale-1)' :
         textMatch[1] === 'lg' ? 'var(--text-scale-2)' : 'var(--text-scale-1)') :
        'var(--text-scale-1)';

      return `
      .button.${sizeName} {
        padding: ${py} ${px};
        font-size: ${fontSize};
      }`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Limited Token Guidance Demo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content="generate-token-demos.mjs" />
    <style>
      /* Auto-generated from packages/design-tokens/src/tokens.css */
      :root {
${cssVariables}
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--color-neutral-50);
        color: var(--color-neutral-900);
        font-family: var(--font-sans);
        font-size: var(--text-scale-1);
        line-height: 1.6;
      }

      main {
        max-width: 60rem;
        margin: 0 auto;
        padding: var(--spacing-6) var(--spacing-4);
        display: grid;
        gap: var(--spacing-6);
      }

      header {
        display: grid;
        gap: var(--spacing-3);
      }

      h1 {
        font-size: var(--text-scale-2);
        margin: 0;
        font-weight: 600;
      }

      p {
        margin: 0;
      }

      .badge-cluster {
        display: flex;
        gap: var(--spacing-2);
        flex-wrap: wrap;
      }

      .badge {
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-2);
        background: var(--color-brand-500);
        color: var(--color-neutral-50);
        font-size: var(--text-scale-0);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      section {
        background: white;
        border-radius: var(--radius-2);
        box-shadow: var(--shadow-1);
        padding: var(--spacing-6);
        display: grid;
        gap: var(--spacing-6);
      }

      .layout {
        display: grid;
        gap: var(--spacing-4);
      }

      .card-grid {
        display: grid;
        gap: var(--spacing-4);
      }

      @media (min-width: 48rem) {
        .card-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      .card {
        border: 1px solid oklch(0.85 0.02 95);
        border-radius: var(--radius-2);
        padding: var(--spacing-4);
        display: grid;
        gap: var(--spacing-3);
      }

      .card h2 {
        margin: 0;
        font-size: var(--text-scale-2);
      }

      .paragraph-stack {
        display: grid;
        gap: var(--spacing-3);
      }

      .cta {
        display: flex;
        gap: var(--spacing-3);
        flex-wrap: wrap;
        align-items: center;
      }

      /* Button base styles */
      .button {
        border-radius: var(--radius-2);
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      /* Auto-generated button sizes from frontend/src/lib/cva.ts */
${buttonSizeStyles}

      .button.primary {
        background: var(--color-brand-500);
        color: var(--color-neutral-50);
      }

      .button.primary:hover {
        opacity: 0.9;
      }

      .button.secondary {
        background: white;
        color: var(--color-brand-500);
        border: 1px solid oklch(0.85 0.02 95);
      }

      .button.secondary:hover {
        background: oklch(0.96 0.01 95);
      }

      .meta-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-scale-0);
      }

      .meta-table th,
      .meta-table td {
        padding: var(--spacing-2);
        text-align: left;
        border-bottom: 1px solid oklch(0.90 0.02 95);
      }

      .meta-table th {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }

      .limits {
        border: 1px dashed oklch(0.90 0.02 95);
        padding: var(--spacing-4);
        border-radius: var(--radius-2);
        display: grid;
        gap: var(--spacing-2);
        background: oklch(0.96 0.01 95);
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        background: oklch(0.96 0.01 95);
        padding: 0 var(--spacing-1);
        border-radius: calc(var(--radius-2) / 2);
        font-size: var(--text-scale-0);
      }

      .size-showcase {
        display: flex;
        gap: var(--spacing-3);
        flex-wrap: wrap;
        align-items: center;
        padding: var(--spacing-4);
        background: oklch(0.96 0.01 95);
        border-radius: var(--radius-2);
      }

      .size-label {
        font-size: var(--text-scale-0);
        color: oklch(0.5 0.02 95);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="badge-cluster">
          <span class="badge">Auto-generated</span>
          <span class="badge">Live tokens</span>
          <span class="badge">Typography 0-2</span>
        </div>
        <h1>Visual System Built From the Design Token Set</h1>
        <p>
          This page is <strong>automatically generated</strong> from <code>packages/design-tokens/src/tokens.css</code>
          and <code>frontend/src/lib/cva.ts</code>. When you change your design tokens or button sizes,
          run <code>npm run generate:demos</code> to update this file.
        </p>
      </header>

      <section>
        <div class="layout">
          <div class="paragraph-stack">
            <h2>Button Sizes (Auto-generated)</h2>
            <p>
              These button sizes are automatically synced from your CVA configuration in
              <code>frontend/src/lib/cva.ts</code>. Currently you have <strong>${Object.keys(buttonSizes).length} sizes</strong> defined.
            </p>
          </div>
          <div class="size-showcase">
            ${Object.keys(buttonSizes).map(size =>
              `<button class="button primary ${size}">${size.toUpperCase()}</button>`
            ).join('\n            ')}
          </div>
          <div class="cta">
            <button class="button primary md">Primary Action</button>
            <button class="button secondary md">Secondary</button>
          </div>
        </div>

        <div class="card-grid">
          <article class="card">
            <h2>Cadence</h2>
            <p>
              Vertical spacing steps create consistent stacks. These values come directly from
              your design tokens.
            </p>
            <table class="meta-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>--spacing-3</code></td>
                  <td>${tokens['spacing-3'] || '0.1875rem'}</td>
                </tr>
                <tr>
                  <td><code>--spacing-4</code></td>
                  <td>${tokens['spacing-4'] || '0.5rem'}</td>
                </tr>
                <tr>
                  <td><code>--spacing-6</code></td>
                  <td>${tokens['spacing-6'] || '1.125rem'}</td>
                </tr>
              </tbody>
            </table>
          </article>
          <article class="card">
            <h2>Typography</h2>
            <p>
              The system uses a limited type scale. Current scale:
            </p>
            <table class="meta-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>--text-scale-0</code></td>
                  <td>${tokens['text-scale-0'] || '0.75rem'}</td>
                </tr>
                <tr>
                  <td><code>--text-scale-1</code></td>
                  <td>${tokens['text-scale-1'] || '0.875rem'}</td>
                </tr>
                <tr>
                  <td><code>--text-scale-2</code></td>
                  <td>${tokens['text-scale-2'] || '1rem'}</td>
                </tr>
              </tbody>
            </table>
          </article>
          <article class="card">
            <h2>Color usage</h2>
            <p>
              Brand color: <code>${tokens['color-brand-500'] || 'oklch(0.6728 0.0888 232.28)'}</code>
            </p>
            <p>
              The neutral palette uses high contrast for readability. All values are pulled
              from the live token file.
            </p>
          </article>
        </div>
      </section>

      <section class="limits">
        <strong>About this demo:</strong>
        <ul>
          <li>✅ Auto-generated from actual design tokens</li>
          <li>✅ Button sizes sync with <code>frontend/src/lib/cva.ts</code></li>
          <li>✅ Run <code>npm run generate:demos</code> to regenerate after token changes</li>
          <li>⚠️  This replaces manual HTML edits - edit the source tokens instead</li>
        </ul>
      </section>
    </main>
  </body>
</html>
`;
}

// Main execution
try {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('📖 Reading design tokens from:', TOKENS_FILE);
  const tokensCSS = fs.readFileSync(TOKENS_FILE, 'utf-8');
  const tokens = parseTokensFromCSS(tokensCSS);
  console.log(`✅ Parsed ${Object.keys(tokens).length} design tokens\n`);

  console.log('📖 Reading button sizes from:', CVA_FILE);
  const cvaContent = fs.readFileSync(CVA_FILE, 'utf-8');
  const buttonSizes = parseButtonSizesFromCVA(cvaContent);
  console.log(`✅ Parsed ${Object.keys(buttonSizes).length} button sizes:`, Object.keys(buttonSizes).join(', '), '\n');

  console.log('🏗️  Generating limited-token-guidelines.html...');
  const guidelinesHTML = generateGuidelinesDemo(tokens, buttonSizes);
  const guidelinesPath = path.join(OUTPUT_DIR, 'limited-token-guidelines.html');
  fs.writeFileSync(guidelinesPath, guidelinesHTML, 'utf-8');
  console.log('✅ Generated:', guidelinesPath, '\n');

  console.log('🎉 All demo files generated successfully!');
  console.log('\n💡 To regenerate: npm run generate:demos');

} catch (error) {
  console.error('❌ Error generating demos:', error.message);
  process.exit(1);
}
