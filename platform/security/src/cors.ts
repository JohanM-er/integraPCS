import cors from 'cors';

/**
 * CORS configuration with allowlist
 *
 * Security best practices:
 * - Never use wildcard (*) in production
 * - Maintain explicit allowlist of trusted origins
 * - Enable credentials for cookie-based auth
 * - Limit allowed methods and headers
 */

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  process.env.PRODUCTION_ORIGIN,
  process.env.STAGING_ORIGIN
].filter(Boolean) as string[];

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowlist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true, // Allow cookies and Authorization header
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Apollo-Require-Preflight',
    'X-Request-ID'
  ],
  exposedHeaders: ['Content-Length', 'X-Request-ID'],
  maxAge: 86400, // 24 hours (browsers cache preflight response)
  optionsSuccessStatus: 204 // Legacy browsers (IE11) choke on 204
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;