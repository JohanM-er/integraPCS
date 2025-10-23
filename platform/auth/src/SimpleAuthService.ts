export type User = {
  id: string;
  roles: string[];
};

export class SimpleAuthService {
  verify(token?: string | null): User | null {
    if (!token) return null;
    // Placeholder: decode token and return roles
    return { id: 'demo-user', roles: ['user'] };
  }
}