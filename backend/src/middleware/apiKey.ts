import { Request, Response, NextFunction } from 'express';
import { apiResponse } from './response';

const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY;

/**
 * Requires x-api-key header to match PUBLIC_API_KEY.
 * Use for /api/v1/public routes only. Returns 403 with { success, data, message } if missing or wrong.
 */
export function publicApiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
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
