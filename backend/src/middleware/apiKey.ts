import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { apiResponse } from './response';

const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY;

/**
 * Requires x-api-key header OR valid Bearer token (logged-in user).
 * Use for /api/v1/public routes. Logged-in dashboard users can access without API key.
 */
export function publicApiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow logged-in users (valid Bearer token) to access public API without API key
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        jwt.verify(token, secret);
        next();
        return;
      }
    } catch {
      // Token invalid, fall through to API key check
    }
  }

  // Otherwise require x-api-key (for mobile app, external clients)
  if (!PUBLIC_API_KEY || PUBLIC_API_KEY.length < 1) {
    apiResponse(res, false, null, 'Public API key not configured', 503);
    return;
  }
  const key = req.headers['x-api-key'];
  const provided = typeof key === 'string' ? key.trim() : '';
  if (!provided || provided !== PUBLIC_API_KEY) {
    apiResponse(res, false, null, 'Invalid or missing API key', 403);
    return;
  }
  next();
}
