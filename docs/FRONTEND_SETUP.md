# Frontend Setup Guide

## Overview

Production-grade React 19 + Apollo Client + Tailwind v4 frontend for integraPCS using:
- **Vite 6** for blazing-fast dev server and optimized builds
- **React 19** with new JSX transform and Suspense APIs
- **Apollo Client 3.14** with HTTP/WS split links for GraphQL subscriptions
- **Tailwind v4** configless setup with @theme tokens
- **TypeScript 5.9** with strict mode
- **Vitest 3** + Testing Library for unit/component tests
- **Playwright 1.56** for e2e tests

---

## Tech Stack

### Core Dependencies
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@apollo/client": "^3.14.0",
    "graphql": "^16.11.0",
    "graphql-ws": "^5.16.2",
    "tailwindcss": "^4.1.15",
    "tailwind-merge": "^3.3.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "vite": "^6.4.1",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.6.1",
    "@testing-library/jest-dom": "^6.4.8",
    "happy-dom": "^20.0.7",
    "@playwright/test": "^1.56.1"
  }
}
```

### Installation Commands

```bash
# Already installed in integraPCS monorepo
# If starting fresh:
npm install @apollo/client graphql graphql-ws
npm install -D @vitejs/plugin-react vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom happy-dom tailwind-merge class-variance-authority
```

---

## 1. Vite Configuration

### File: `frontend/vite.config.ts`

**Key Features:**
- React plugin with fast refresh and automatic JSX transform
- Path aliases for `@/` (src) and `@integrapcs/shared-types`
- Environment variable loading with `VITE_*` prefix
- Optional GraphQL proxy for dev server
- ES2022 build target for modern browsers
- Source maps in dev/staging, disabled in production

```typescript
/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react({
        // Fast refresh enabled by default
        // React 19 JSX transform handled automatically
        fastRefresh: true
      })
    ],

    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Optional: proxy GraphQL in dev to avoid CORS
        '/graphql': {
          target: env.VITE_GRAPHQL_HTTP || 'http://localhost:3000',
          ws: true, // Enable WebSocket proxy for subscriptions
          changeOrigin: true
        }
      }
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@integrapcs/shared-types': path.resolve(__dirname, '../packages/shared-types/src')
      }
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
    },

    build: {
      sourcemap: mode !== 'production',
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-apollo': ['@apollo/client', 'graphql'],
            'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
          }
        }
      }
    },

    optimizeDeps: {
      include: ['@apollo/client', 'graphql']
    },

    preview: {
      port: 5173
    }
  };
});
```

**Important Notes:**
- **JSX Transform**: React 19 uses automatic JSX transform (no need for `import React`)
- **Fast Refresh**: Preserves component state during HMR
- **Environment Variables**: Only `VITE_*` prefixed vars are exposed to client code

---

## 2. Vitest Configuration

### File: `frontend/vitest.config.ts`

**Separate from vite.config.ts for test-specific settings:**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  test: {
    environment: 'happy-dom', // Faster than jsdom
    globals: true, // Use describe/it/expect without imports
    setupFiles: ['./tests/setup.ts'],
    css: true, // Process CSS imports
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types.ts'
      ]
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e']
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@integrapcs/shared-types': path.resolve(__dirname, '../packages/shared-types/src')
    }
  }
});
```

**Test Setup File:**

#### File: `frontend/tests/setup.ts`

```typescript
import '@testing-library/jest-dom/vitest';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
vi.stubEnv('VITE_GRAPHQL_HTTP', 'http://localhost:3000/graphql');
vi.stubEnv('VITE_GRAPHQL_WS', 'ws://localhost:3000/graphql');

// Extend matchers (already done by @testing-library/jest-dom/vitest)
// expect.extend(...);
```

---

## 3. Apollo Client Setup

### File: `frontend/src/lib/apollo.ts`

**Features:**
- HTTP link for queries/mutations
- GraphQL-WS link for subscriptions
- Split link based on operation type
- Normalized cache with type policies
- Retry logic for WebSocket reconnection
- Dev tools integration

```typescript
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
  from,
  type TypePolicy,
  type NormalizedCacheObject
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient as createWsClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';

const httpUri = import.meta.env.VITE_GRAPHQL_HTTP as string;
const wsUri = import.meta.env.VITE_GRAPHQL_WS as string;

// HTTP link for queries and mutations
const httpLink = new HttpLink({
  uri: httpUri,
  credentials: 'include', // Send cookies for auth
  headers: {
    'Apollo-Require-Preflight': 'true' // CSRF protection
  }
});

// WebSocket link for subscriptions
const wsLink =
  typeof window !== 'undefined' && wsUri
    ? new GraphQLWsLink(
        createWsClient({
          url: wsUri,
          connectionParams: async () => {
            // Add auth token if needed
            const token = localStorage.getItem('auth_token');
            return token ? { authorization: `Bearer ${token}` } : {};
          },
          retryAttempts: Infinity,
          shouldRetry: () => true,
          on: {
            connected: () => console.log('[WS] Connected'),
            closed: () => console.log('[WS] Closed')
          }
        })
      )
    : null;

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        extensions
      );

      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Redirect to login or refresh token
        window.location.href = '/login';
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError.message}`);
  }
});

// Split link: subscriptions via WS, queries/mutations via HTTP
const splitLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLink
    )
  : httpLink;

// Type policies for normalized cache
const typePolicies: Record<string, TypePolicy> = {
  Query: {
    fields: {
      // Cursor-based pagination example
      workPackages: {
        keyArgs: ['filter', 'orderBy'],
        merge(existing = { edges: [] as any[] }, incoming) {
          if (!existing?.edges?.length) return incoming;
          return {
            ...incoming,
            edges: [...existing.edges, ...incoming.edges]
          };
        }
      }
    }
  },
  // Entity normalization (ensure __typename and id in queries)
  WorkPackage: { keyFields: ['id'] },
  Task: { keyFields: ['id'] },
  Project: { keyFields: ['id'] },
  User: { keyFields: ['id'] }
};

// Create Apollo Client instance
export const apolloClient = new ApolloClient<NormalizedCacheObject>({
  link: from([errorLink, splitLink]),
  cache: new InMemoryCache({
    typePolicies,
    addTypename: true
  }),
  connectToDevTools: import.meta.env.DEV,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all'
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all'
    },
    mutate: {
      errorPolicy: 'all'
    }
  }
});

// Export for testing
export { httpLink, wsLink, splitLink, typePolicies };
```

**Usage in App:**

#### File: `frontend/src/main.tsx`

```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './lib/apollo';
import App from './App';
import './styles/index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
```

---

## 4. Tailwind v4 Setup

### Configless Approach (No tailwind.config.js)

Tailwind v4 uses `@theme` directive in CSS for configuration.

#### File: `frontend/src/styles/tokens.css`

```css
@import "tailwindcss";

@theme {
  /* Colors - using OKLCH for better perceptual uniformity */
  --color-brand-50:  oklch(0.97 0.01 178);
  --color-brand-100: oklch(0.94 0.03 178);
  --color-brand-200: oklch(0.88 0.06 178);
  --color-brand-300: oklch(0.81 0.08 178);
  --color-brand-400: oklch(0.76 0.10 178);
  --color-brand-500: oklch(0.72 0.11 178); /* Primary */
  --color-brand-600: oklch(0.65 0.10 178);
  --color-brand-700: oklch(0.56 0.09 178);
  --color-brand-800: oklch(0.45 0.07 178);
  --color-brand-900: oklch(0.35 0.05 178);

  --color-neutral-50:  oklch(0.98 0.01 95);
  --color-neutral-100: oklch(0.96 0.01 95);
  --color-neutral-200: oklch(0.92 0.01 95);
  --color-neutral-300: oklch(0.85 0.02 95);
  --color-neutral-400: oklch(0.70 0.02 95);
  --color-neutral-500: oklch(0.55 0.02 95);
  --color-neutral-600: oklch(0.45 0.02 95);
  --color-neutral-700: oklch(0.35 0.02 95);
  --color-neutral-800: oklch(0.27 0.02 95);
  --color-neutral-900: oklch(0.21 0.02 95);

  --color-success-500: oklch(0.68 0.14 145);
  --color-warning-500: oklch(0.78 0.14 65);
  --color-error-500:   oklch(0.62 0.22 25);

  /* Spacing */
  --spacing-1: 0.25rem;  /* 4px */
  --spacing-2: 0.5rem;   /* 8px */
  --spacing-3: 0.75rem;  /* 12px */
  --spacing-4: 1rem;     /* 16px */
  --spacing-6: 1.5rem;   /* 24px */
  --spacing-8: 2rem;     /* 32px */
  --spacing-12: 3rem;    /* 48px */
  --spacing-16: 4rem;    /* 64px */

  /* Typography */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "Cascadia Code", "Source Code Pro", monospace;

  --font-size-xs:   0.75rem;   /* 12px */
  --font-size-sm:   0.875rem;  /* 14px */
  --font-size-base: 1rem;      /* 16px */
  --font-size-lg:   1.125rem;  /* 18px */
  --font-size-xl:   1.25rem;   /* 20px */
  --font-size-2xl:  1.5rem;    /* 24px */
  --font-size-3xl:  1.875rem;  /* 30px */

  /* Border Radius */
  --radius-sm:  0.25rem;  /* 4px */
  --radius-md:  0.5rem;   /* 8px */
  --radius-lg:  0.75rem;  /* 12px */
  --radius-xl:  1rem;     /* 16px */
  --radius-2xl: 1.5rem;   /* 24px */
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px oklch(0 0 0 / 0.1);
}
```

#### File: `frontend/src/styles/index.css`

```css
@import "./tokens.css";

@layer base {
  * {
    @apply border-neutral-200;
  }

  body {
    @apply bg-neutral-50 text-neutral-900 font-sans antialiased;
  }

  h1, h2, h3, h4, h5, h6 {
    @apply font-semibold tracking-tight;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

### Tailwind Utilities

#### File: `frontend/src/lib/cx.ts`

**Purpose:** Merge Tailwind classes without conflicts

```typescript
import { twMerge } from 'tailwind-merge';
import { type ClassValue, clsx } from 'clsx';

/**
 * Merge class names with tailwind-merge to resolve conflicts
 * Example: cx('px-2 py-1', 'px-4') => 'py-1 px-4' (px-2 is removed)
 */
export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

#### File: `frontend/src/lib/cva.ts`

**Purpose:** Create component variants (for shadcn-style components)

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from './cx';

/**
 * Example: Button component variants
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-2xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-white hover:bg-brand-600',
        secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300',
        ghost: 'hover:bg-neutral-100',
        destructive: 'bg-error-500 text-white hover:bg-error-600'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

/**
 * Usage:
 *
 * import { buttonVariants, type ButtonVariants } from '@/lib/cva';
 * import { cx } from '@/lib/cx';
 *
 * interface ButtonProps extends ButtonVariants {
 *   className?: string;
 * }
 *
 * export function Button({ variant, size, className, ...props }: ButtonProps) {
 *   return (
 *     <button
 *       className={cx(buttonVariants({ variant, size }), className)}
 *       {...props}
 *     />
 *   );
 * }
 */
```

---

## 5. Testing Setup

### Unit Tests (Vitest + Testing Library)

#### Example: Hook Test

**File: `frontend/src/hooks/__tests__/useCounter.test.ts`**

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useState } from 'react';

function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
}

describe('useCounter', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('should initialize with custom value', () => {
    const { result } = renderHook(() => useCounter(10));
    expect(result.current.count).toBe(10);
  });

  it('should increment count', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('should decrement count', () => {
    const { result } = renderHook(() => useCounter(5));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(4);
  });

  it('should reset count', () => {
    const { result } = renderHook(() => useCounter(10));

    act(() => {
      result.current.increment();
      result.current.increment();
    });

    expect(result.current.count).toBe(12);

    act(() => {
      result.current.reset();
    });

    expect(result.current.count).toBe(10);
  });
});
```

#### Example: Component Test

**File: `frontend/src/components/__tests__/Button.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

function Button({ children, onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick} disabled>Click me</Button>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

#### Example: Apollo Mock Test

**File: `frontend/src/components/__tests__/WorkPackageList.test.tsx`**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { describe, it, expect } from 'vitest';
import { gql } from '@apollo/client';

const GET_WORK_PACKAGES = gql`
  query GetWorkPackages {
    workPackages {
      id
      name
    }
  }
`;

interface WorkPackage {
  id: string;
  name: string;
}

function WorkPackageList() {
  const { data, loading, error } = useQuery<{ workPackages: WorkPackage[] }>(GET_WORK_PACKAGES);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.workPackages.map(wp => (
        <li key={wp.id}>{wp.name}</li>
      ))}
    </ul>
  );
}

describe('WorkPackageList', () => {
  it('should render loading state', () => {
    const mocks: MockedResponse[] = [];

    render(
      <MockedProvider mocks={mocks}>
        <WorkPackageList />
      </MockedProvider>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render work packages', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_WORK_PACKAGES
        },
        result: {
          data: {
            workPackages: [
              { id: '1', name: 'WP1' },
              { id: '2', name: 'WP2' }
            ]
          }
        }
      }
    ];

    render(
      <MockedProvider mocks={mocks}>
        <WorkPackageList />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('WP1')).toBeInTheDocument();
      expect(screen.getByText('WP2')).toBeInTheDocument();
    });
  });

  it('should render error state', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_WORK_PACKAGES
        },
        error: new Error('Network error')
      }
    ];

    render(
      <MockedProvider mocks={mocks}>
        <WorkPackageList />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/error: network error/i)).toBeInTheDocument();
    });
  });
});
```

### E2E Tests (Playwright)

#### File: `frontend/e2e/workPackage.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Work Package Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should display work packages list', async ({ page }) => {
    await page.goto('/work-packages');

    // Wait for list to load
    await expect(page.getByRole('heading', { name: /work packages/i })).toBeVisible();

    // Check if list contains items
    const items = page.getByRole('listitem');
    await expect(items).toHaveCount.greaterThan(0);
  });

  test('should create new work package', async ({ page }) => {
    await page.goto('/work-packages');

    // Click create button
    await page.getByRole('button', { name: /create work package/i }).click();

    // Fill form
    await page.getByLabel(/name/i).fill('Test Work Package');
    await page.getByLabel(/description/i).fill('Test description');

    // Submit
    await page.getByRole('button', { name: /save/i }).click();

    // Verify success message
    await expect(page.getByText(/work package created/i)).toBeVisible();

    // Verify new item in list
    await expect(page.getByText('Test Work Package')).toBeVisible();
  });

  test('should update work package', async ({ page }) => {
    await page.goto('/work-packages');

    // Click first item
    await page.getByRole('listitem').first().click();

    // Click edit button
    await page.getByRole('button', { name: /edit/i }).click();

    // Update name
    const nameInput = page.getByLabel(/name/i);
    await nameInput.clear();
    await nameInput.fill('Updated Name');

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Verify update
    await expect(page.getByText('Updated Name')).toBeVisible();
  });

  test('should subscribe to real-time updates', async ({ page }) => {
    // Open page in two contexts to simulate multiple users
    const context2 = await page.context().browser()?.newContext();
    const page2 = await context2?.newPage();

    await page.goto('/work-packages');
    await page2?.goto('/work-packages');

    // Create work package in page1
    await page.getByRole('button', { name: /create work package/i }).click();
    await page.getByLabel(/name/i).fill('Real-time Test');
    await page.getByRole('button', { name: /save/i }).click();

    // Verify it appears in page2 via subscription
    await expect(page2!.getByText('Real-time Test')).toBeVisible({ timeout: 5000 });

    await context2?.close();
  });
});
```

---

## 6. Environment Variables

### File: `frontend/.env.example`

```bash
# GraphQL API Endpoints
VITE_GRAPHQL_HTTP=http://localhost:3000/graphql
VITE_GRAPHQL_WS=ws://localhost:3000/graphql

# Application
VITE_APP_NAME=integraPCS
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_SUBSCRIPTIONS=true

# Sentry (optional)
# VITE_SENTRY_DSN=
# VITE_SENTRY_ENVIRONMENT=development
```

**Usage:**

```typescript
// Type-safe env access
const config = {
  graphql: {
    http: import.meta.env.VITE_GRAPHQL_HTTP as string,
    ws: import.meta.env.VITE_GRAPHQL_WS as string
  },
  app: {
    name: import.meta.env.VITE_APP_NAME as string,
    version: import.meta.env.VITE_APP_VERSION as string
  },
  features: {
    devtools: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
    subscriptions: import.meta.env.VITE_ENABLE_SUBSCRIPTIONS === 'true'
  }
};

export default config;
```

---

## 7. Package Scripts

### File: `frontend/package.json` (scripts section)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit --pretty",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write . --ignore-path .gitignore",
    "clean": "rm -rf dist node_modules/.vite",
    "analyze": "vite-bundle-visualizer"
  }
}
```

---

## 8. CI/CD Integration

### GitHub Actions Example

```yaml
name: Frontend CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck -w frontend

      - name: Lint
        run: npm run lint -w frontend

      - name: Unit tests
        run: npm run test:coverage -w frontend

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info

      - name: Build
        run: npm run build -w frontend

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: E2E tests
        run: npm run test:e2e -w frontend
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:5173

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 30
```

---

## 9. Best Practices

### React 19 Considerations

1. **Use new hooks:** `useTransition`, `useDeferredValue` for better UX
2. **Suspense boundaries:** Wrap async components with `<Suspense fallback={...}>`
3. **Error boundaries:** Catch errors in component tree
4. **Server Components:** N/A (we're using Vite, not Next.js)

```typescript
import { Suspense, useTransition } from 'react';

function WorkPackageList() {
  const [isPending, startTransition] = useTransition();

  const handleFilter = (filter: string) => {
    startTransition(() => {
      // Non-urgent update
      setFilter(filter);
    });
  };

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {isPending && <div>Filtering...</div>}
      <WorkPackageItems filter={filter} />
    </Suspense>
  );
}
```

### Apollo Client Best Practices

1. **Use fragments:** Reuse field selections
2. **Enable __typename:** Required for normalized cache
3. **Optimistic updates:** Immediate UI feedback
4. **Pagination:** Use cursor-based pagination
5. **Error handling:** Use `errorPolicy: 'all'` to receive partial data

```typescript
// fragments.ts
export const WORK_PACKAGE_FIELDS = gql`
  fragment WorkPackageFields on WorkPackage {
    id
    name
    description
    createdAt
    updatedAt
  }
`;

// queries.ts
export const GET_WORK_PACKAGE = gql`
  ${WORK_PACKAGE_FIELDS}

  query GetWorkPackage($id: ID!) {
    workPackage(id: $id) {
      ...WorkPackageFields
      tasks {
        id
        title
        status
      }
    }
  }
`;

// mutations.ts with optimistic response
export const UPDATE_WORK_PACKAGE = gql`
  ${WORK_PACKAGE_FIELDS}

  mutation UpdateWorkPackage($id: ID!, $input: UpdateWorkPackageInput!) {
    updateWorkPackage(id: $id, input: $input) {
      ...WorkPackageFields
    }
  }
`;

// Component usage
function WorkPackageEditor({ id }: { id: string }) {
  const [updateWorkPackage] = useMutation(UPDATE_WORK_PACKAGE, {
    optimisticResponse: {
      updateWorkPackage: {
        __typename: 'WorkPackage',
        id,
        name: 'Updated Name', // Immediate UI update
        ...
      }
    }
  });
}
```

### Tailwind v4 Best Practices

1. **No arbitrary values:** Enforce design system via ESLint
2. **Use @theme tokens:** Single source of truth
3. **Prefer utilities over @apply:** Better for tree-shaking
4. **Use tailwind-merge:** Resolve class conflicts in components

```typescript
// ❌ Bad: Arbitrary values (ESLint will error)
<div className="bg-[#ff0000] p-[13px]" />

// ✅ Good: Design tokens
<div className="bg-error-500 p-3" />

// ✅ Good: Conditional classes with cx()
<button className={cx(
  'px-4 py-2',
  isActive && 'bg-brand-500',
  !isActive && 'bg-neutral-200'
)} />
```

---

## 10. Performance Optimization

### Code Splitting

```typescript
// Lazy load routes
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const WorkPackages = lazy(() => import('./pages/WorkPackages'));
const Tasks = lazy(() => import('./pages/Tasks'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/work-packages" element={<WorkPackages />} />
          <Route path="/tasks" element={<Tasks />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### Bundle Analysis

```bash
# Install
npm install -D vite-bundle-visualizer

# Add to vite.config.ts
import { visualizer } from 'vite-bundle-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true })
  ]
});

# Run build to see bundle analysis
npm run build
```

---

## Summary

✅ **Vite 6** with React 19 JSX transform and fast refresh
✅ **Apollo Client 3.14** with HTTP/WS split links for subscriptions
✅ **Tailwind v4** configless setup with @theme tokens
✅ **TypeScript 5.9** with strict mode and path aliases
✅ **Vitest 3** for fast unit/component tests
✅ **Playwright 1.56** for reliable e2e tests
✅ **Production patterns:** Error handling, optimistic updates, code splitting
✅ **CI/CD ready:** GitHub Actions example with coverage uploads

**Next Steps:**
1. Generate GraphQL types with `graphql-codegen` (see GRAPHQL_LAYER.md)
2. Implement authentication flow with JWT tokens
3. Add error boundaries and Suspense fallbacks
4. Configure Sentry for error tracking
5. Set up Storybook for component development
