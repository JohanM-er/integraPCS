export type ResolverMap = Record<string, any>;

export interface GraphQLModule {
  typeDefs: string;
  resolvers: ResolverMap;
}

export async function* serverTimeGenerator(): AsyncGenerator<{ serverTime: string }> {
  // Emit current ISO time every second
  while (true) {
    yield { serverTime: new Date().toISOString() };
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export const baseTypeDefs = /* GraphQL */ `
  type Query {
    health: String!
  }

  type Subscription {
    serverTime: String!
  }
`;

export const baseResolvers: ResolverMap = {
  Query: {
    health: () => 'ok'
  },
  Subscription: {
    serverTime: {
      // Async generator that yields { serverTime }
      subscribe: serverTimeGenerator,
      resolve: (payload: { serverTime: string }) => payload.serverTime
    }
  }
};

/**
 * Merge an array of SDL strings into a single SDL string.
 */
export function mergeTypeDefs(typeDefsList: Array<string | undefined | null>): string {
  return typeDefsList.filter(Boolean).join('\n');
}

/**
 * Deep-merge resolver maps. Later modules override earlier keys.
 */
export function mergeResolvers(resolversList: Array<ResolverMap | undefined | null>): ResolverMap {
  const result: ResolverMap = {};
  for (const res of resolversList) {
    if (!res || typeof res !== 'object') continue;
    deepMerge(result, res);
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): void {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      deepMerge(tgtVal, srcVal);
    } else {
      target[key] = srcVal;
    }
  }
}