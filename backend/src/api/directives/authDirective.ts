import { GraphQLContext } from '../context';

export function requireRole(requiredRole: string) {
  return function authorize<TArgs, TResult>(
    resolver: (parent: unknown, args: TArgs, context: GraphQLContext) => Promise<TResult> | TResult
  ) {
    return async (parent: unknown, args: TArgs, context: GraphQLContext): Promise<TResult> => {
      const roles = context.user?.roles ?? [];
      if (!roles.includes(requiredRole)) {
        throw new Error('Forbidden');
      }
      return resolver(parent, args, context);
    };
  };
}


