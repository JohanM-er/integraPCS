import { Express } from 'express';
import helmet from 'helmet';

/**
 * Apply security headers using Helmet
 *
 * Headers configured:
 * - Content-Security-Policy: Prevents XSS attacks
 * - X-Frame-Options: DENY - Prevents clickjacking
 * - X-Content-Type-Options: nosniff - Prevents MIME sniffing
 * - Strict-Transport-Security: Enforces HTTPS (1 year)
 * - Referrer-Policy: no-referrer - Protects user privacy
 * - X-XSS-Protection: Enables XSS filter
 */
export function applySecurityHeaders(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // GraphQL Playground needs unsafe-inline in dev
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: 'no-referrer' }
    })
  );
}
