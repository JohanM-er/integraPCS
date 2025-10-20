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
            connected: () => console.log('[GraphQL WS] Connected'),
            closed: () => console.log('[GraphQL WS] Closed'),
            error: (error) => console.error('[GraphQL WS] Error:', error)
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
        console.warn('[Apollo] Unauthenticated request, redirecting to login');
        // window.location.href = '/login';
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
        merge(existing = { edges: [] as any[], pageInfo: {} }, incoming) {
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
