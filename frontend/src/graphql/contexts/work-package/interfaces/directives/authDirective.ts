export type AuthLikeContext = {
  user?: { roles?: string[] | null } | null;
};

export function requireRole(requiredRole: string) {
  return function authorize<TArgs, TResult>(
    resolver: (parent: unknown, args: TArgs, context: AuthLikeContext) => Promise<TResult> | TResult
  ) {
    return async (parent: unknown, args: TArgs, context: AuthLikeContext): Promise<TResult> => {
      const roles = (context.user?.roles ?? []) as string[];
      if (!roles.includes(requiredRole)) {
        throw new Error('Forbidden');
      }
      return resolver(parent, args, context);
    };
  };
}