import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import RedisStore from 'rate-limit-redis';

import type { RequestHandler as ExpressRequestHandler } from 'express';
import type { RequestHandler as CoreRequestHandler } from 'express-serve-static-core';
import type { RedisReply } from 'rate-limit-redis';

// Initialize Redis client for rate limiting
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3
});

redis.on('error', err => {
  console.error('[Rate Limiter] Redis error:', err);
});

/**
 * General API rate limiter (100 requests per 15 minutes)
 *
 * Applied to: All GraphQL endpoints
 */
export const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: async (...args: [command: string, ...params: string[]]): Promise<RedisReply> =>
      redis.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
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
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/healthz' || req.path === '/ready';
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
    sendCommand: async (...args: [command: string, ...params: string[]]): Promise<RedisReply> =>
      redis.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
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
    sendCommand: async (...args: [command: string, ...params: string[]]): Promise<RedisReply> =>
      redis.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
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

// Adapter bridging express-serve-static-core v5 handler to Express 4 RequestHandler
const asExpressHandler = (h: CoreRequestHandler): ExpressRequestHandler =>
  ((req, res, next) => (h as any)(req, res, next)) as ExpressRequestHandler;

// Wrapped limiters with Express 4-compatible handler signatures
const apiLimiterMW: ExpressRequestHandler = asExpressHandler(apiLimiter as unknown as CoreRequestHandler);
const loginLimiterMW: ExpressRequestHandler = asExpressHandler(loginLimiter as unknown as CoreRequestHandler);
const mutationLimiterMW: ExpressRequestHandler = asExpressHandler(mutationLimiter as unknown as CoreRequestHandler);

/**
 * Middleware to apply rate limiting based on GraphQL operation
 *
 * Usage:
 * ```typescript
 * app.use('/graphql', graphqlRateLimitMiddleware);
 * ```
 */
export const graphqlRateLimitMiddleware: ExpressRequestHandler = (req, res, next) => {
  const body = (req.body ?? {}) as { operationName?: string; query?: string };
  const operationName = body.operationName;
  const query = body.query ?? '';

  // Apply stricter rate limit for authentication
  if (operationName === 'Login' || operationName === 'Register') {
    return loginLimiterMW(req, res, next);
  }

  // Apply mutation rate limit
  if (typeof query === 'string' && query.trim().startsWith('mutation')) {
    return mutationLimiterMW(req, res, next);
  }

  // Default: API rate limit
  return apiLimiterMW(req, res, next);
};

/**
 * Close Redis connection on shutdown
 */
export const closeRateLimiterRedis = async (): Promise<void> => {
  await redis.quit();
  console.warn('[Rate Limiter] Redis connection closed');
};
