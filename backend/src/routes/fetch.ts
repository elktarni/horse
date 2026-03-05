import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

/** GET /api/v1/fetch?url=https://... - Proxy fetch to bypass CORS. Auth required. */
router.get(
  '/',
  [query('url').notEmpty().trim().isURL({ protocols: ['http', 'https'] }).withMessage('valid url required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const url = (req.query.url as string).trim();
      const headers: Record<string, string> = { Accept: 'application/json' };
      // Forward user's auth token so they can fetch their own API (e.g. public routes now accept Bearer)
      const auth = req.headers.authorization;
      if (auth && typeof auth === 'string') headers['Authorization'] = auth;
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const text = await response.text();
      if (!response.ok) {
        // Always return 200 so the client doesn't treat 401 as auth failure and log the user out
        apiResponse(res, false, { status: response.status, body: text.slice(0, 500) }, `HTTP ${response.status}: ${text.slice(0, 200)}`);
        return;
      }
      try {
        const json = JSON.parse(text);
        apiResponse(res, true, json, 'OK');
      } catch {
        apiResponse(res, true, { raw: text }, 'OK');
      }
    } catch (err) {
      console.error('Fetch proxy error:', err);
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      apiResponse(res, false, null, msg, 500);
    }
  }
);

export default router;
