import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import RedisStore from 'rate-limit-redis';

/**
 * Initialize Redis client for rate limiting
 */
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3
});

redis.on('error', (err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Rate Limiter] Redis error:', err);
});

/**
 * General API rate limiter (100 requests per 15 minutes)
 *
 * Applied to: All GraphQL endpoints
 */
export const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: async (...args: [command: string, ...params: string[]]) =>
      (redis as any).call(args[0], ...args.slice(1)),
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req: any) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/ready';
  }
});

/**
 * Strict rate limiter for authentication (5 attempts per 15 minutes)
 *
 * Applied to: Login, Register mutations
 * Features: Skip successful requests (only count failures)
 */
export const loginLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: async (...args: [command: string, ...params: string[]]) =>
      (redis as any).call(args[0], ...args.slice(1)),
    prefix: 'rl:login:'
  }),
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    error: 'Too many login attempts from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Mutation rate limiter (30 mutations per 5 minutes)
 *
 * Applied to: All GraphQL mutations (except Login/Register)
 * Prevents: Abuse of create/update/delete operations
 */
export const mutationLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: async (...args: [command: string, ...params: string[]]) =>
      (redis as any).call(args[0], ...args.slice(1)),
    prefix: 'rl:mutation:'
  }),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: {
    error: 'Too many mutations from this IP, please slow down.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware to apply rate limiting based on GraphQL operation
 *
 * Usage:
 * ```typescript
 * app.use('/graphql', graphqlRateLimitMiddleware);
 * ```
 */
export const graphqlRateLimitMiddleware = ((req: any, res: any, next: any): void => {
  const body = (req.body ?? {}) as { operationName?: string; query?: string };
  const operationName = body.operationName;
  const query = body.query ?? '';

  // Apply stricter rate limit for authentication
  if (operationName === 'Login' || operationName === 'Register') {
    (loginLimiter as any)(req, res, next);
    return;
  }

  // Apply mutation rate limit
  if (typeof query === 'string' && query.trim().startsWith('mutation')) {
    (mutationLimiter as any)(req, res, next);
    return;
  }

  // Default: API rate limit
  (apiLimiter as any)(req, res, next);
  return;
}) as any;

/**
 * Close Redis connection on shutdown
 */
export const closeRateLimiterRedis = async (): Promise<void> => {
  await redis.quit();
  // eslint-disable-next-line no-console
  console.warn('[Rate Limiter] Redis connection closed');
};