# integraPCS Frontend

React 19 + Vite 6 application using:
- Apollo Client (GraphQL HTTP + WebSocket subscriptions)
- Tailwind CSS v4 with design tokens defined via `@theme`
- ESLint (flat config) with Tailwind and a11y guardrails
- Vitest + Playwright for testing

## Quick Start

1) Install dependencies (from repo root):
   npm install

2) Start infrastructure (from repo root):
   docker-compose up -d

3) Build shared types (from repo root):
   npm run build:shared

4) Start dev servers (from repo root):
   ./dev-start.sh
   - Backend GraphQL: http://localhost:3000/graphql
   - Frontend Vite:   http://localhost:5173

5) Configure environment (optional):
   - Copy `.env.example` to `.env`
   - Ensure:
     - VITE_GRAPHQL_HTTP=http://localhost:3000/graphql
     - VITE_GRAPHQL_WS=ws://localhost:3000/graphql

## Apollo Client Setup (HTTP/WS Split)

Use an HTTP link for queries/mutations and a WebSocket link for subscriptions (graphql-ws protocol), then split based on operation type.

Example `src/lib/apollo.ts`:

import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_HTTP,
  credentials: 'include'
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: import.meta.env.VITE_GRAPHQL_WS
  })
);

function isSubscription(operation) {
  const def = getMainDefinition(operation.query);
  return def.kind === 'OperationDefinition' && def.operation === 'subscription';
}

const link = split(isSubscription, wsLink, httpLink);

export const apollo = new ApolloClient({
  link,
  cache: new InMemoryCache()
});

In your `src/main.tsx`, wrap your app:

import { ApolloProvider } from '@apollo/client';
import { apollo } from './lib/apollo';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={apollo}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);

## Tailwind v4 Design Tokens

Design tokens live in `src/styles/tokens.css` using Tailwind v4 `@theme`. This is the single source of truth for colors, spacing, typography, radius, and shadows.

File: `src/styles/tokens.css` (excerpt)

@import "tailwindcss";
@theme {
  --color-brand-500: oklch(0.6728 0.0888 232.28);
  --color-neutral-50:  oklch(0.98 0.01 95);
  --color-neutral-900: oklch(0.21 0.02 95);
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-4: 1rem;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  --text-scale-1: 1rem;
  --radius-2: 0.5rem;
  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.06);
}

Usage examples:
- OK: <button class="px-4 py-2 rounded-2 bg-brand-500 text-neutral-50 shadow-1">Save</button>
- BAD: <div class="mt-[3px] text-[#333]">...</div> (blocked by ESLint)

Ensure global styles are loaded by importing `./styles/globals.css` once in your app entry.

## Linting Guardrails

- eslint-plugin-tailwindcss:
  - tailwindcss/no-arbitrary-value: error
  - tailwindcss/no-custom-classname: error
  - tailwindcss/classnames-order: warn
- eslint-plugin-jsx-a11y: recommended rules enabled
- Prettier with Tailwind class sorting via prettier-plugin-tailwindcss

Run:
- npm run lint
- npm run lint:fix
- npm run test
- npm run test:e2e

## Project Structure

frontend/
├── src/
│   ├── lib/                # Apollo client, utilities
│   ├── styles/
│   │   ├── tokens.css      # Tailwind v4 tokens (@theme)
│   │   └── globals.css     # Imports tokens and minimal base
│   └── main.tsx            # App entry (wraps ApolloProvider)
├── index.html              # Vite entry
├── package.json
└── vite.config.js

## Notes

- The backend must be running (port 3000) for GraphQL requests and subscriptions.
- Tailwind v4 is configured via CSS tokens; no tailwind.config.js is required.
- Do not use inline styles or arbitrary Tailwind values; they will fail lint.
