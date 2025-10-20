export interface AppEnv {
  GRAPHQL_PORT: number;
  GRAPHQL_PATH: string;
  SUBSCRIPTIONS_PATH: string;
  FRONTEND_ORIGIN: string;
}

function normalizePath(p: string): string {
  if (!p.startsWith('/')) return `/${p}`;
  return p;
}

export function loadEnv(): AppEnv {
  const portRaw = process.env.GRAPHQL_PORT;
  const port = portRaw ? Number.parseInt(portRaw, 10) : 3000;

  const GRAPHQL_PATH = normalizePath(process.env.GRAPHQL_PATH || '/graphql');
  const SUBSCRIPTIONS_PATH = normalizePath(process.env.SUBSCRIPTIONS_PATH || GRAPHQL_PATH);
  const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

  return {
    GRAPHQL_PORT: Number.isFinite(port) ? port : 3000,
    GRAPHQL_PATH,
    SUBSCRIPTIONS_PATH,
    FRONTEND_ORIGIN
  };
}