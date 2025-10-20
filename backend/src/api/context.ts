import { SimpleAuthService, User } from '../infrastructure/auth/SimpleAuthService';

export type GraphQLContext = {
  user: User | null;
};

const auth = new SimpleAuthService();

export function createContext({ req }: { req: { headers?: Record<string, string | undefined> } }): GraphQLContext {
  const authHeader = req.headers?.authorization ?? req.headers?.Authorization as unknown as string | undefined;
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? null;
  const user = auth.verify(token);
  return { user };
}


