import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import Admin from '../models/Admin';
import { apiResponse } from '../middleware/response';
import { AuthPayload } from '../middleware/auth';

const router = Router();

const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }

      const { email, password } = req.body;
      const admin = await Admin.findOne({ email });
      if (!admin) {
        apiResponse(res, false, null, 'Invalid email or password', 401);
        return;
      }

      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) {
        apiResponse(res, false, null, 'Invalid email or password', 401);
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        apiResponse(res, false, null, 'Server configuration error', 500);
        return;
      }

      const payload: AuthPayload = { adminId: admin._id.toString(), email: admin.email };
      const token = jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);

      apiResponse(res, true, { token, email: admin.email }, 'Login successful');
    } catch (err) {
      console.error('Login error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

export default router;
