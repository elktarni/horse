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
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      const text = await response.text();
      if (!response.ok) {
        apiResponse(res, false, null, `HTTP ${response.status}: ${text.slice(0, 300)}`, response.status);
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
