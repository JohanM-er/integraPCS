import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
  from,
  type TypePolicy,
  type NormalizedCacheObject
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient as createWsClient } from 'graphql-ws';

const httpUri = import.meta.env.VITE_GRAPHQL_HTTP as string;
const wsUri = import.meta.env.VITE_GRAPHQL_WS as string;

// HTTP link for queries and mutations
const httpLink = new HttpLink({
  uri: httpUri,
  credentials: 'include',
  headers: {
    'Apollo-Require-Preflight': 'true'
  }
});

// WebSocket link for subscriptions
const wsLink =
  typeof window !== 'undefined' && wsUri
    ? new GraphQLWsLink(
        createWsClient({
          url: wsUri,
          connectionParams: async () => {
            const token = localStorage.getItem('auth_token');
            return token ? { authorization: `Bearer ${token}` } : {};
          },
          retryAttempts: Infinity,
          shouldRetry: () => true,
          on: {
            connected: () => console.log('[GraphQL WS] Connected'),
            closed: () => console.log('[GraphQL WS] Closed'),
            error: error => console.error('[GraphQL WS] Error:', error)
          }
        })
      )
    : null;

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        extensions
      );

      if (extensions?.code === 'UNAUTHENTICATED') {
        console.warn('[Apollo] Unauthenticated request, redirecting to login');
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${'message' in networkError ? (networkError as any).message : String(networkError)}`);
  }
});

// Split link: subscriptions via WS, queries/mutations via HTTP
const splitLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
      },
      wsLink,
      httpLink
    )
  : httpLink;

// Type policies for normalized cache
const typePolicies: Record<string, TypePolicy> = {
  Query: {
    fields: {
      workPackages: {
        keyArgs: ['filter', 'orderBy'],
        merge(existing = { edges: [] as unknown[], pageInfo: {} }, incoming) {
          if (!existing?.edges?.length) return incoming;
          return {
            ...incoming,
            edges: [...existing.edges, ...incoming.edges],
            pageInfo: incoming.pageInfo
          };
        }
      }
    }
  },
  WorkPackage: { keyFields: ['id'] },
  Task: { keyFields: ['id'] },
  Project: { keyFields: ['id'] },
  User: { keyFields: ['id'] }
};

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